import winston from "winston";

import type { AgentMessage } from "@/agent.js";
import type { Config } from "@/config.js";

import { generatePrompt, runAgent } from "@/agent.js";
import { validateHeartbeatEndpoint, startHeartbeat } from "@/heartbeat.js";
import { fetchSystemMetrics, checkThresholds } from "@/monitor.js";
import { sendWebhook } from "@/webhook.js";

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level}]: ${message}`;
    }),
  ),
  transports: [new winston.transports.Console()],
});

type DaemonState = {
  running: boolean;
  agentRunning: boolean;
  breachDetected: boolean;
  sessionId: string | null;
};

let state: DaemonState = {
  running: false,
  agentRunning: false,
  breachDetected: false,
  sessionId: null,
};

let monitoringInterval: NodeJS.Timeout | null = null;
let heartbeatCleanup: (() => void) | null = null;

export const startDaemon = async (args: { config: Config }): Promise<void> => {
  const { config } = args;

  state = {
    running: true,
    agentRunning: false,
    breachDetected: false,
    sessionId: null,
  };

  logger.info("Premortem daemon starting...");

  // Validate and start heartbeat if configured
  if (config.heartbeat) {
    await validateHeartbeatEndpoint({
      url: config.heartbeat.url,
      processName: config.heartbeat.processName,
    });

    heartbeatCleanup = startHeartbeat({
      url: config.heartbeat.url,
      processName: config.heartbeat.processName,
      interval: config.heartbeat.interval || 60000,
    });
  }

  // Use webhook URL directly (key is embedded in URL)
  const webhookUrl = config.webhookUrl;

  // Start monitoring loop
  const monitor = async () => {
    if (!state.running) return;

    try {
      const metrics = await fetchSystemMetrics();
      const breach = checkThresholds({
        metrics,
        thresholds: config.thresholds,
      });

      if (breach && !state.agentRunning) {
        logger.warn(
          `Threshold breach detected: ${breach.type} at ${breach.currentValue}% (threshold: ${breach.thresholdValue}%)`,
        );

        state.breachDetected = true;
        state.agentRunning = true;

        // Generate prompt and run agent
        const prompt = generatePrompt({
          breach,
          metrics,
          customPrompt: config.agentConfig?.customPrompt,
        });

        let vitalsMessageSent = false;

        const onMessage = async (msg: AgentMessage) => {
          // Extract session ID if available
          if ("session_id" in msg && typeof msg.session_id === "string") {
            state.sessionId = msg.session_id;

            // Send system vitals as the first message when we get session_id
            if (!vitalsMessageSent) {
              vitalsMessageSent = true;
              await sendWebhook({
                url: webhookUrl,
                message: {
                  type: "system",
                  session_id: state.sessionId,
                  message: {
                    role: "system",
                    content: `System Vitals at Breach Detection:\n\nBreach Type: ${breach.type}\nCurrent Value: ${breach.currentValue}%\nThreshold: ${breach.thresholdValue}%\n\nSystem Metrics:\n- Memory: ${metrics.memoryPercent}%\n- Disk: ${metrics.diskPercent}%\n- CPU: ${metrics.cpuPercent}%\n- Processes: ${metrics.processCount}`,
                  },
                },
              });
            }
          }

          // Send raw message to webhook immediately
          await sendWebhook({
            url: webhookUrl,
            message: msg,
          });
        };

        const onComplete = () => {
          logger.info("Agent completed - resetting daemon state");
          state.agentRunning = false;
          state.breachDetected = false;
          state.sessionId = null;
        };

        // Run agent (non-blocking, continues in background)
        runAgent({
          prompt,
          apiKey: config.anthropicApiKey,
          config: config.agentConfig || {},
          onMessage,
          onComplete,
        }).catch((error) => {
          logger.error(`Agent error: ${error}`);
          // Reset state on error
          state.agentRunning = false;
          state.breachDetected = false;
          state.sessionId = null;
        });
      }
    } catch (error) {
      logger.error(`Monitoring error: ${error}`);
    }
  };

  // Initial check
  await monitor();

  // Set up interval
  monitoringInterval = setInterval(monitor, config.pollingInterval || 10000);

  logger.info(
    `Daemon monitoring started (interval: ${
      config.pollingInterval || 10000
    }ms)`,
  );

  // Handle shutdown signals
  const shutdown = async () => {
    logger.info("Shutdown signal received");
    await stopDaemon();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

export const stopDaemon = async (): Promise<void> => {
  state.running = false;

  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
  }

  if (heartbeatCleanup) {
    heartbeatCleanup();
    heartbeatCleanup = null;
  }

  logger.info("Daemon stopped");
};

export const getDaemonState = (): DaemonState => {
  return { ...state };
};
