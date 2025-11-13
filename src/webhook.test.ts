import { describe, it, expect, vi, beforeEach } from "vitest";

import { sendWebhook } from "@/webhook.js";

// Mock node-fetch
vi.mock("node-fetch", () => ({
  default: vi.fn(),
}));

describe("sendWebhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should POST raw message as JSON to webhook URL", async () => {
    const fetch = (await import("node-fetch")).default;

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
    } as any);

    const message = {
      type: "assistant",
      session_id: "session-123",
      message: { content: "Analyzing system..." },
    };

    await sendWebhook({
      url: "https://example.com/webhook",
      message,
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://example.com/webhook",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
      }),
    );
  });

  it("should not throw error on fetch failure (fire-and-forget)", async () => {
    const fetch = (await import("node-fetch")).default;

    vi.mocked(fetch).mockRejectedValue(new Error("Network error"));

    const message = {
      type: "assistant",
      message: { content: "Test" },
    };

    // Should not throw
    await expect(
      sendWebhook({
        url: "https://example.com/webhook",
        message,
      }),
    ).resolves.toBeUndefined();
  });

  it("should not throw error on HTTP error response", async () => {
    const fetch = (await import("node-fetch")).default;

    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    } as any);

    const message = {
      type: "result",
      result: "Complete",
    };

    // Should not throw
    await expect(
      sendWebhook({
        url: "https://example.com/webhook",
        message,
      }),
    ).resolves.toBeUndefined();
  });
});
