import { describe, it, vi, beforeEach, afterEach } from "vitest";

import type { Config } from "@/config.js";

import { startDaemon, stopDaemon } from "@/daemon.js";

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: vi.fn(async function* () {
    yield { type: "result", session_id: "test-id" };
  }),
}));

vi.mock("@/monitor.js", () => ({
  fetchSystemMetrics: vi.fn(async () => ({
    memoryPercent: 50,
    diskPercent: 50,
    cpuPercent: 50,
    processCount: 100,
  })),
  checkThresholds: vi.fn(() => null), // No breach by default
}));

vi.mock("@/webhook.js", () => ({
  sendWebhook: vi.fn(async () => {
    // Mock webhook sending
    return Promise.resolve();
  }),
}));

vi.mock("@/heartbeat.js", () => ({
  validateHeartbeatEndpoint: vi.fn(async () => {
    // Mock validation - succeeds by default
    return Promise.resolve();
  }),
  startHeartbeat: vi.fn(() => {
    // Mock heartbeat start - returns cleanup function
    return vi.fn();
  }),
}));

describe("daemon", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await stopDaemon();
  });

  describe("stopDaemon", () => {
    it("should stop the monitoring loop", async () => {
      const config: Config = {
        webhookUrl: "http://localhost:3000/webhook",
        anthropicApiKey: "test-api-key",
        thresholds: {
          memoryPercent: 90,
          diskPercent: null,
          cpuPercent: null,
          processName: null,
        },
        pollingInterval: 1000,
        agentConfig: null,
      };

      // Start daemon
      await startDaemon({ config });

      // Stop daemon
      await stopDaemon();

      // The daemon should be stopped - lack of error indicates success
    });
  });

  describe("heartbeat integration", () => {
    it("should validate and start heartbeat when config is present", async () => {
      const { validateHeartbeatEndpoint, startHeartbeat } = await import(
        "@/heartbeat.js"
      );

      const config: Config = {
        webhookUrl: "http://localhost:3000/webhook",
        anthropicApiKey: "test-api-key",
        thresholds: {
          memoryPercent: 90,
          diskPercent: null,
          cpuPercent: null,
          processName: null,
        },
        pollingInterval: 1000,
        agentConfig: null,
        heartbeat: {
          url: "http://localhost:3000/heartbeat",
          interval: 60000,
          processName: "test-daemon",
        },
      };

      await startDaemon({ config });

      // Should validate the endpoint
      expect(validateHeartbeatEndpoint).toHaveBeenCalledWith({
        url: "http://localhost:3000/heartbeat",
        processName: "test-daemon",
      });

      // Should start heartbeat
      expect(startHeartbeat).toHaveBeenCalledWith({
        url: "http://localhost:3000/heartbeat",
        processName: "test-daemon",
        interval: 60000,
      });

      await stopDaemon();
    });

    it("should fail startup if heartbeat validation fails", async () => {
      const { validateHeartbeatEndpoint } = await import("@/heartbeat.js");
      vi.mocked(validateHeartbeatEndpoint).mockRejectedValueOnce(
        new Error("Heartbeat endpoint unreachable"),
      );

      const config: Config = {
        webhookUrl: "http://localhost:3000/webhook",
        anthropicApiKey: "test-api-key",
        thresholds: {
          memoryPercent: 90,
          diskPercent: null,
          cpuPercent: null,
          processName: null,
        },
        pollingInterval: 1000,
        agentConfig: null,
        heartbeat: {
          url: "http://unreachable:3000/heartbeat",
          interval: 60000,
          processName: "test-daemon",
        },
      };

      await expect(startDaemon({ config })).rejects.toThrow(
        "Heartbeat endpoint unreachable",
      );
    });

    it("should work normally when heartbeat config is omitted", async () => {
      const { validateHeartbeatEndpoint, startHeartbeat } = await import(
        "@/heartbeat.js"
      );

      const config: Config = {
        webhookUrl: "http://localhost:3000/webhook",
        anthropicApiKey: "test-api-key",
        thresholds: {
          memoryPercent: 90,
          diskPercent: null,
          cpuPercent: null,
          processName: null,
        },
        pollingInterval: 1000,
        agentConfig: null,
        heartbeat: null,
      };

      await startDaemon({ config });

      // Should not call heartbeat functions
      expect(validateHeartbeatEndpoint).not.toHaveBeenCalled();
      expect(startHeartbeat).not.toHaveBeenCalled();

      await stopDaemon();
    });

    it("should stop heartbeat when daemon stops", async () => {
      const { startHeartbeat } = await import("@/heartbeat.js");
      const mockCleanup = vi.fn();
      vi.mocked(startHeartbeat).mockReturnValueOnce(mockCleanup);

      const config: Config = {
        webhookUrl: "http://localhost:3000/webhook",
        anthropicApiKey: "test-api-key",
        thresholds: {
          memoryPercent: 90,
          diskPercent: null,
          cpuPercent: null,
          processName: null,
        },
        pollingInterval: 1000,
        agentConfig: null,
        heartbeat: {
          url: "http://localhost:3000/heartbeat",
          interval: 60000,
          processName: "test-daemon",
        },
      };

      await startDaemon({ config });
      await stopDaemon();

      // Cleanup should have been called
      expect(mockCleanup).toHaveBeenCalled();
    });
  });
});
