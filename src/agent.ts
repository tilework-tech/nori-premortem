import * as os from "os";

import { query } from "@anthropic-ai/claude-agent-sdk";
import winston from "winston";

import type { AgentConfig } from "@/config.js";
import type { ThresholdBreach, SystemMetrics } from "@/monitor.js";

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

export type AgentMessage = {
  type: string;
  [key: string]: unknown;
};

export const generatePrompt = (args: {
  breach: ThresholdBreach;
  metrics: SystemMetrics;
  customPrompt?: string | null;
}): string => {
  const { breach, metrics, customPrompt } = args;

  const breachDescription = `CRITICAL: ${breach.type} usage at ${breach.currentValue}% (threshold: ${breach.thresholdValue}%)`;

  const metricsFormatted = `
System Metrics at ${breach.timestamp.toISOString()}:
- Operating System: ${os.platform()} (${os.release()})
- Memory: ${metrics.memoryPercent}%
- Disk: ${metrics.diskPercent}%
- CPU: ${metrics.cpuPercent}%
- Processes: ${metrics.processCount}
`;

  const diagnosticRequest = `
The system has breached a critical threshold. Please diagnose what is happening on this machine:

${breachDescription}

${metricsFormatted}

Investigate and provide a detailed analysis of what might be causing this issue. Do NOT stop to ask for permission or ask questions -- there is not enough time. This is extremely urgent. Your investigation should:
- identify which processes are running that are causing problems
- get as granular as possible, down to specific function calls
- use tools like os tools like strace, dtruss, and lsof
- use tools like py-spy or node inspect

Produce a paragraph detailing what is happening with as much context as possible`;

  if (customPrompt) {
    return `${customPrompt}\n\n${diagnosticRequest}`;
  }

  return diagnosticRequest;
};

export const runAgent = async (args: {
  prompt: string;
  apiKey: string;
  config: AgentConfig;
  archiveDir: string;
  onMessage: (msg: AgentMessage) => void;
  onComplete: () => void;
}): Promise<void> => {
  const { prompt, apiKey, config, archiveDir, onMessage, onComplete } = args;

  // Set API key in environment
  process.env.ANTHROPIC_API_KEY = apiKey;

  logger.info("Starting Claude agent...");

  try {
    const messages = query({
      prompt,
      options: {
        cwd: archiveDir,
        hooks: {
          PostToolUse: [
            {
              hooks: [
                async (input: any) => {
                  logger.info(`Tool used: ${input.tool_name}`);
                  return { continue: true };
                },
              ],
            },
          ],
          SessionStart: [
            {
              hooks: [
                async () => {
                  logger.info("Agent session started");
                  return { continue: true };
                },
              ],
            },
          ],
          SessionEnd: [
            {
              hooks: [
                async () => {
                  logger.info("Agent session ended");
                  return { continue: true };
                },
              ],
            },
          ],
        },
      },
    });

    for await (const msg of messages) {
      onMessage(msg as AgentMessage);

      if (msg.type === "result") {
        logger.info("Agent completed");
        onComplete();
      }
    }
  } catch (error) {
    logger.error(`Agent error: ${error}`);
    throw error;
  }
};
