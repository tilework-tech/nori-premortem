import { readFileSync } from "node:fs";

export type ThresholdConfig = {
  memoryPercent?: number | null;
  diskPercent?: number | null;
  cpuPercent?: number | null;
  processName?: string | null;
};

export type AgentConfig = {
  model?: string | null;
  customPrompt?: string | null;
  maxTurns?: number | null;
  allowedTools?: Array<string> | null;
};

export type HeartbeatConfig = {
  url: string;
  interval?: number | null;
  processName: string;
};

export type Config = {
  webhookUrl: string;
  anthropicApiKey: string;
  thresholds: ThresholdConfig;
  pollingInterval?: number | null;
  agentConfig?: AgentConfig | null;
  heartbeat?: HeartbeatConfig | null;
};

const DEFAULT_POLLING_INTERVAL = 10000;
const DEFAULT_MODEL = "claude-sonnet-4";
const DEFAULT_HEARTBEAT_INTERVAL = 60000;

export const loadConfig = (args: { path: string }): Config => {
  const { path } = args;

  let rawConfig: unknown;
  try {
    const fileContents = readFileSync(path, "utf-8");
    rawConfig = JSON.parse(fileContents);
  } catch (error) {
    throw new Error(`Failed to read or parse config file at ${path}: ${error}`);
  }

  if (typeof rawConfig !== "object" || rawConfig === null) {
    throw new Error("Config file must contain a valid JSON object");
  }

  const config = rawConfig as Record<string, unknown>;

  // Validate required fields
  if (typeof config.webhookUrl !== "string") {
    throw new Error('Config must include "webhookUrl" as a string');
  }

  if (typeof config.anthropicApiKey !== "string") {
    throw new Error('Config must include "anthropicApiKey" as a string');
  }

  if (typeof config.thresholds !== "object" || config.thresholds === null) {
    throw new Error('Config must include "thresholds" as an object');
  }

  // Apply defaults
  const pollingInterval =
    typeof config.pollingInterval === "number"
      ? config.pollingInterval
      : DEFAULT_POLLING_INTERVAL;

  const agentConfig: AgentConfig = {
    model: DEFAULT_MODEL,
    customPrompt: null,
    maxTurns: null,
    allowedTools: null,
  };

  if (typeof config.agentConfig === "object" && config.agentConfig !== null) {
    const userAgentConfig = config.agentConfig as Record<string, unknown>;
    if (typeof userAgentConfig.model === "string") {
      agentConfig.model = userAgentConfig.model;
    }
    if (typeof userAgentConfig.customPrompt === "string") {
      agentConfig.customPrompt = userAgentConfig.customPrompt;
    }
    if (typeof userAgentConfig.maxTurns === "number") {
      agentConfig.maxTurns = userAgentConfig.maxTurns;
    }
    if (Array.isArray(userAgentConfig.allowedTools)) {
      agentConfig.allowedTools = userAgentConfig.allowedTools as Array<string>;
    }
  }

  // Parse heartbeat config
  let heartbeat: HeartbeatConfig | null = null;
  if (typeof config.heartbeat === "object" && config.heartbeat !== null) {
    const userHeartbeat = config.heartbeat as Record<string, unknown>;

    if (
      typeof userHeartbeat.url === "string" &&
      typeof userHeartbeat.processName === "string"
    ) {
      const interval =
        typeof userHeartbeat.interval === "number"
          ? userHeartbeat.interval
          : DEFAULT_HEARTBEAT_INTERVAL;

      heartbeat = {
        url: userHeartbeat.url,
        interval,
        processName: userHeartbeat.processName,
      };
    }
  }

  return {
    webhookUrl: config.webhookUrl,
    anthropicApiKey: config.anthropicApiKey,
    thresholds: config.thresholds as ThresholdConfig,
    pollingInterval,
    agentConfig,
    heartbeat,
  };
};
