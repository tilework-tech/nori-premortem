import fetch from "node-fetch";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { validateHeartbeatEndpoint, startHeartbeat } from "@/heartbeat.js";

vi.mock("node-fetch");

describe("validateHeartbeatEndpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should succeed when endpoint returns 200", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
    } as any);

    await expect(
      validateHeartbeatEndpoint({
        url: "https://example.com/heartbeat",
        webhookKey: "test-key",
        processName: "test-daemon",
      }),
    ).resolves.toBeUndefined();

    expect(fetch).toHaveBeenCalledWith(
      "https://example.com/heartbeat/test-key",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });

  it("should throw when endpoint returns 401", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    } as any);

    await expect(
      validateHeartbeatEndpoint({
        url: "https://example.com/heartbeat",
        webhookKey: "wrong-key",
        processName: "test-daemon",
      }),
    ).rejects.toThrow("401");
  });

  it("should throw when endpoint is unreachable", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("Network error"));

    await expect(
      validateHeartbeatEndpoint({
        url: "https://unreachable.example.com/heartbeat",
        webhookKey: "test-key",
        processName: "test-daemon",
      }),
    ).rejects.toThrow("Network error");
  });
});

describe("startHeartbeat and stopHeartbeat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should send initial heartbeat immediately", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
    } as any);

    const cleanup = startHeartbeat({
      url: "https://example.com/heartbeat",
      webhookKey: "test-key",
      processName: "my-daemon",
      interval: 60000,
    });

    // Wait for async tasks to complete
    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://example.com/heartbeat/test-key",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("my-daemon"),
      }),
    );

    cleanup();
  });

  it("should send periodic heartbeats at configured interval", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
    } as any);

    const cleanup = startHeartbeat({
      url: "https://example.com/heartbeat",
      webhookKey: "test-key",
      processName: "my-daemon",
      interval: 30000,
    });

    // Wait for initial heartbeat
    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    vi.advanceTimersByTime(30000);
    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    vi.advanceTimersByTime(30000);
    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(3);
    });

    cleanup();
  });

  it("should include processName, timestamp, and uptime in payload", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
    } as any);

    const cleanup = startHeartbeat({
      url: "https://example.com/heartbeat",
      webhookKey: "test-key",
      processName: "my-daemon",
      interval: 60000,
    });

    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining("my-daemon"),
      }),
    );

    const callArgs = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(callArgs[1]?.body as string);

    expect(body.processName).toBe("my-daemon");
    expect(body.timestamp).toBeDefined();
    expect(typeof body.uptime).toBe("number");

    cleanup();
  });

  it("should stop sending heartbeats when cleanup is called", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
    } as any);

    const cleanup = startHeartbeat({
      url: "https://example.com/heartbeat",
      webhookKey: "test-key",
      processName: "my-daemon",
      interval: 30000,
    });

    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    cleanup();

    vi.advanceTimersByTime(30000);
    expect(fetch).toHaveBeenCalledTimes(1); // Should not increase
  });

  it("should not throw when heartbeat fails during runtime", async () => {
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
      // Mock implementation
    });
    vi.mocked(fetch).mockRejectedValue(new Error("Network error"));

    const cleanup = startHeartbeat({
      url: "https://example.com/heartbeat",
      webhookKey: "test-key",
      processName: "my-daemon",
      interval: 60000,
    });

    // Wait for initial heartbeat attempt
    await vi.waitFor(() => {
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Heartbeat failed"),
      );
    });

    cleanup();
    consoleWarnSpy.mockRestore();
  });
});
