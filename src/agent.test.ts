import { describe, it, expect, vi, beforeEach } from "vitest";

import type { AgentConfig } from "@/config.js";
import type { ThresholdBreach, SystemMetrics } from "@/monitor.js";

import { generatePrompt, runAgent } from "@/agent.js";

// Mock the Agent SDK
vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: vi.fn(),
}));

describe("generatePrompt", () => {
  it("should format breach details into natural language", () => {
    const breach: ThresholdBreach = {
      type: "memory",
      currentValue: 95,
      thresholdValue: 90,
      timestamp: new Date("2025-01-01T00:00:00Z"),
    };

    const metrics: SystemMetrics = {
      memoryPercent: 95,
      diskPercent: 60,
      cpuPercent: 40,
      processCount: 150,
    };

    const prompt = generatePrompt({ breach, metrics, customPrompt: null });

    expect(prompt).toContain("CRITICAL");
    expect(prompt).toContain("memory");
    expect(prompt).toContain("95");
    expect(prompt).toContain("90");
    expect(prompt).toContain("Memory: 95%");
    expect(prompt).toContain("Disk: 60%");
    expect(prompt).toContain("CPU: 40%");
    expect(prompt).toContain("Processes: 150");
  });

  it("should prepend custom prompt when provided", () => {
    const breach: ThresholdBreach = {
      type: "disk",
      currentValue: 90,
      thresholdValue: 85,
      timestamp: new Date(),
    };

    const metrics: SystemMetrics = {
      memoryPercent: 50,
      diskPercent: 90,
      cpuPercent: 40,
      processCount: 100,
    };

    const customPrompt = "Please focus on analyzing disk space usage patterns.";

    const prompt = generatePrompt({ breach, metrics, customPrompt });

    expect(prompt).toContain(customPrompt);
    expect(prompt.indexOf(customPrompt)).toBeLessThan(
      prompt.indexOf("CRITICAL"),
    );
  });

  it("should include timestamp in prompt", () => {
    const timestamp = new Date("2025-01-01T12:30:45Z");
    const breach: ThresholdBreach = {
      type: "cpu",
      currentValue: 85,
      thresholdValue: 80,
      timestamp,
    };

    const metrics: SystemMetrics = {
      memoryPercent: 50,
      diskPercent: 60,
      cpuPercent: 85,
      processCount: 100,
    };

    const prompt = generatePrompt({ breach, metrics, customPrompt: null });

    expect(prompt).toContain("2025");
  });

  it("should include operating system information in prompt", () => {
    const breach: ThresholdBreach = {
      type: "memory",
      currentValue: 95,
      thresholdValue: 90,
      timestamp: new Date("2025-01-01T00:00:00Z"),
    };

    const metrics: SystemMetrics = {
      memoryPercent: 95,
      diskPercent: 60,
      cpuPercent: 40,
      processCount: 150,
    };

    const prompt = generatePrompt({ breach, metrics, customPrompt: null });

    expect(prompt).toContain("Operating System:");
  });
});

describe("runAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("should set ANTHROPIC_API_KEY from config before invoking query", async () => {
    const { query } = await import("@anthropic-ai/claude-agent-sdk");

    // Mock query to return empty async generator
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    vi.mocked(query).mockReturnValue((async function* () {})());

    const config: AgentConfig = {
      model: "claude-sonnet-4",
      customPrompt: null,
      maxTurns: null,
      allowedTools: null,
    };

    const onMessage = vi.fn();
    const onComplete = vi.fn();

    await runAgent({
      prompt: "Test prompt",
      apiKey: "sk-test-key-456",
      config,
      onMessage,
      onComplete,
    });

    expect(process.env.ANTHROPIC_API_KEY).toBe("sk-test-key-456");
  });

  it("should call query with correct options", async () => {
    const { query } = await import("@anthropic-ai/claude-agent-sdk");

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    vi.mocked(query).mockReturnValue((async function* () {})());

    const config: AgentConfig = {
      customPrompt: null,
    };

    const archiveDir = "/test/archive";

    const onMessage = vi.fn();
    const onComplete = vi.fn();

    await runAgent({
      prompt: "Diagnose the issue",
      apiKey: "sk-test-key",
      config,
      archiveDir,
      onMessage,
      onComplete,
    });

    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "Diagnose the issue",
        options: expect.objectContaining({
          cwd: archiveDir,
        }),
      }),
    );
  });

  it("should register hooks for PostToolUse, SessionStart, SessionEnd", async () => {
    const { query } = await import("@anthropic-ai/claude-agent-sdk");

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    vi.mocked(query).mockReturnValue((async function* () {})());

    const config: AgentConfig = {
      customPrompt: null,
    };

    await runAgent({
      prompt: "Test",
      apiKey: "sk-key",
      config,
      onMessage: vi.fn(),
      onComplete: vi.fn(),
    });

    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          hooks: expect.objectContaining({
            PostToolUse: expect.any(Array),
            SessionStart: expect.any(Array),
            SessionEnd: expect.any(Array),
          }),
        }),
      }),
    );
  });

  it("should invoke onMessage for each message from query", async () => {
    const { query } = await import("@anthropic-ai/claude-agent-sdk");

    // Mock query to return messages
    vi.mocked(query).mockReturnValue(
      (async function* () {
        yield { type: "system", model: "claude-sonnet-4" };
        yield { type: "assistant", message: { content: "Analyzing..." } };
        yield {
          type: "result",
          result: "Complete",
          total_cost_usd: 0.01,
          duration_ms: 1000,
          usage: { input_tokens: 100, output_tokens: 50 },
        };
      })() as any,
    );

    const onMessage = vi.fn();
    const onComplete = vi.fn();

    await runAgent({
      prompt: "Test",
      apiKey: "sk-key",
      config: { model: "claude-sonnet-4" },
      onMessage,
      onComplete,
    });

    expect(onMessage).toHaveBeenCalledTimes(3);
    expect(onMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ type: "system" }),
    );
    expect(onMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ type: "assistant" }),
    );
    expect(onMessage).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ type: "result" }),
    );
  });

  it("should invoke onComplete when result message is received", async () => {
    const { query } = await import("@anthropic-ai/claude-agent-sdk");

    vi.mocked(query).mockReturnValue(
      (async function* () {
        yield { type: "system", model: "claude-sonnet-4" };
        yield {
          type: "result",
          result: "Complete",
          total_cost_usd: 0.01,
          duration_ms: 1000,
          usage: { input_tokens: 100, output_tokens: 50 },
        };
      })() as any,
    );

    const onMessage = vi.fn();
    const onComplete = vi.fn();

    await runAgent({
      prompt: "Test",
      apiKey: "sk-key",
      config: { model: "claude-sonnet-4" },
      onMessage,
      onComplete,
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
