import { writeFileSync, unlinkSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { loadConfig } from "@/config.js";

describe("loadConfig", () => {
  let tmpDir: string;
  let configPath: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "premortem-test-"));
    configPath = join(tmpDir, "config.json");
  });

  afterEach(() => {
    try {
      unlinkSync(configPath);
    } catch {
      // Ignore if file doesn't exist
    }
  });

  it("should load valid config from JSON file", () => {
    const validConfig = {
      webhookUrl: "https://example.com/webhook",
      anthropicApiKey: "sk-test-key-123",
      thresholds: {
        memoryPercent: 90,
      },
    };

    writeFileSync(configPath, JSON.stringify(validConfig));

    const config = loadConfig({ path: configPath });

    expect(config.webhookUrl).toBe("https://example.com/webhook");
    expect(config.anthropicApiKey).toBe("sk-test-key-123");
    expect(config.thresholds.memoryPercent).toBe(90);
  });

  it("should throw error when webhookUrl is missing", () => {
    const invalidConfig = {
      anthropicApiKey: "sk-test-key-123",
      thresholds: {},
    };

    writeFileSync(configPath, JSON.stringify(invalidConfig));

    expect(() => loadConfig({ path: configPath })).toThrow("webhookUrl");
  });

  it("should throw error when anthropicApiKey is missing", () => {
    const invalidConfig = {
      webhookUrl: "https://example.com/webhook",
      thresholds: {},
    };

    writeFileSync(configPath, JSON.stringify(invalidConfig));

    expect(() => loadConfig({ path: configPath })).toThrow("anthropicApiKey");
  });

  it("should throw error when thresholds is missing", () => {
    const invalidConfig = {
      webhookUrl: "https://example.com/webhook",
      anthropicApiKey: "sk-test-key-123",
    };

    writeFileSync(configPath, JSON.stringify(invalidConfig));

    expect(() => loadConfig({ path: configPath })).toThrow("thresholds");
  });

  it("should apply default pollingInterval when not provided", () => {
    const validConfig = {
      webhookUrl: "https://example.com/webhook",
      anthropicApiKey: "sk-test-key-123",
      thresholds: {
        memoryPercent: 90,
      },
    };

    writeFileSync(configPath, JSON.stringify(validConfig));

    const config = loadConfig({ path: configPath });

    expect(config.pollingInterval).toBe(10000);
  });

  it("should use provided pollingInterval", () => {
    const validConfig = {
      webhookUrl: "https://example.com/webhook",
      anthropicApiKey: "sk-test-key-123",
      thresholds: {
        memoryPercent: 90,
      },
      pollingInterval: 5000,
    };

    writeFileSync(configPath, JSON.stringify(validConfig));

    const config = loadConfig({ path: configPath });

    expect(config.pollingInterval).toBe(5000);
  });

  it("should apply default model when not provided", () => {
    const validConfig = {
      webhookUrl: "https://example.com/webhook",
      anthropicApiKey: "sk-test-key-123",
      thresholds: {
        memoryPercent: 90,
      },
    };

    writeFileSync(configPath, JSON.stringify(validConfig));

    const config = loadConfig({ path: configPath });

    expect(config.agentConfig?.model).toBe("claude-sonnet-4");
  });

  it("should throw error for file that does not exist", () => {
    const nonExistentPath = join(tmpDir, "nonexistent.json");

    expect(() => loadConfig({ path: nonExistentPath })).toThrow();
  });

  it("should load heartbeat config when provided", () => {
    const validConfig = {
      webhookUrl: "https://example.com/webhook",
      anthropicApiKey: "sk-test-key-123",
      thresholds: {
        memoryPercent: 90,
      },
      heartbeat: {
        url: "https://example.com/heartbeat",
        interval: 30000,
        processName: "my-daemon",
      },
    };

    writeFileSync(configPath, JSON.stringify(validConfig));

    const config = loadConfig({ path: configPath });

    expect(config.heartbeat?.url).toBe("https://example.com/heartbeat");
    expect(config.heartbeat?.interval).toBe(30000);
    expect(config.heartbeat?.processName).toBe("my-daemon");
  });

  it("should apply default heartbeat interval when not provided", () => {
    const validConfig = {
      webhookUrl: "https://example.com/webhook",
      anthropicApiKey: "sk-test-key-123",
      thresholds: {
        memoryPercent: 90,
      },
      heartbeat: {
        url: "https://example.com/heartbeat",
        processName: "my-daemon",
      },
    };

    writeFileSync(configPath, JSON.stringify(validConfig));

    const config = loadConfig({ path: configPath });

    expect(config.heartbeat?.interval).toBe(60000);
  });

  it("should allow heartbeat to be omitted entirely", () => {
    const validConfig = {
      webhookUrl: "https://example.com/webhook",
      anthropicApiKey: "sk-test-key-123",
      thresholds: {
        memoryPercent: 90,
      },
    };

    writeFileSync(configPath, JSON.stringify(validConfig));

    const config = loadConfig({ path: configPath });

    expect(config.heartbeat).toBeNull();
  });

  it("should load config with webhookUrl containing embedded key", () => {
    const validConfig = {
      webhookUrl: "https://example.com/webhook/my-secret-key-12345",
      anthropicApiKey: "sk-test-key-123",
      thresholds: {
        memoryPercent: 90,
      },
    };

    writeFileSync(configPath, JSON.stringify(validConfig));

    const config = loadConfig({ path: configPath });

    expect(config.webhookUrl).toBe(
      "https://example.com/webhook/my-secret-key-12345",
    );
    expect(config.webhookKey).toBeUndefined();
  });
});
