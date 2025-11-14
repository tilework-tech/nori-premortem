import { query } from "@anthropic-ai/claude-agent-sdk";

export const validateApiKey = async (args: {
  apiKey: string;
}): Promise<void> => {
  const { apiKey } = args;

  // Validate API key is not empty
  if (apiKey == null || apiKey.trim() === "") {
    throw new Error(
      "API key cannot be empty. Please check your configuration.",
    );
  }

  // Set API key in environment for the SDK
  process.env.ANTHROPIC_API_KEY = apiKey;

  try {
    // Make a minimal API call to validate the key
    const messages = query({
      prompt: "test",
      options: {
        model: "claude-3-haiku-20240307",
        maxTurns: 1,
      },
    });

    // Consume the async generator to trigger the API call
    for await (const msg of messages) {
      if (msg.type === "result") {
        // Check if the result indicates an error
        if (msg.is_error) {
          // For subtype 'success' with is_error: true, error message is in 'result' field
          if (msg.subtype === "success") {
            throw new Error(msg.result);
          }
          // For error subtypes, errors are in 'errors' array
          throw new Error(msg.errors.join(", "));
        }
        break;
      }
    }
  } catch (error: any) {
    // Handle authentication errors
    if (error.status === 401) {
      throw new Error(
        "Invalid Anthropic API key. Please check your configuration.",
      );
    }

    // Handle service unavailable errors
    if (error.status === 503) {
      throw new Error(
        "Anthropic API is currently unavailable. Please try again later.",
      );
    }

    // Re-throw other errors
    throw error;
  }
};
