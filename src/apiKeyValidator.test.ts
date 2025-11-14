import { describe, it, expect, vi, beforeEach } from "vitest";

import { validateApiKey } from "@/apiKeyValidator.js";

// Mock the claude-agent-sdk
vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: vi.fn(),
}));

describe("validateApiKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should succeed when API key is valid", async () => {
    const { query } = await import("@anthropic-ai/claude-agent-sdk");

    // Mock successful response
    vi.mocked(query).mockReturnValue(
      (async function* () {
        yield { type: "result", content: "test response" };
      })(),
    );

    await expect(
      validateApiKey({ apiKey: "valid-key-12345" }),
    ).resolves.toBeUndefined();
  });

  it("should throw error when API returns 401 authentication error", async () => {
    const { query } = await import("@anthropic-ai/claude-agent-sdk");

    // Mock 401 authentication error
    const authError = new Error("invalid x-api-key");
    (authError as any).status = 401;
    (authError as any).type = "authentication_error";

    vi.mocked(query).mockReturnValue(
      (async function* () {
        throw authError;
      })(),
    );

    await expect(validateApiKey({ apiKey: "invalid-key" })).rejects.toThrow(
      "Invalid Anthropic API key",
    );
  });

  it("should throw error when API returns 503 service unavailable", async () => {
    const { query } = await import("@anthropic-ai/claude-agent-sdk");

    // Mock 503 service unavailable error
    const serviceError = new Error("Service Unavailable");
    (serviceError as any).status = 503;

    vi.mocked(query).mockReturnValue(
      (async function* () {
        throw serviceError;
      })(),
    );

    await expect(validateApiKey({ apiKey: "valid-key" })).rejects.toThrow(
      "Anthropic API is currently unavailable",
    );
  });

  it("should throw error when API key is empty", async () => {
    await expect(validateApiKey({ apiKey: "" })).rejects.toThrow(
      "API key cannot be empty",
    );
  });
});
