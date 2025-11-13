import fetch from "node-fetch";

export const validateHeartbeatEndpoint = async (args: {
  url: string;
  webhookKey: string;
  processName: string;
}): Promise<void> => {
  const { url, webhookKey, processName } = args;

  const fullUrl = `${url}/${webhookKey}`;

  const response = await fetch(fullUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      processName,
      timestamp: new Date().toISOString(),
      uptime: 0,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Heartbeat validation failed: ${response.status} ${response.statusText}`,
    );
  }
};

export const startHeartbeat = (args: {
  url: string;
  webhookKey: string;
  processName: string;
  interval: number;
}): (() => void) => {
  const { url, webhookKey, processName, interval } = args;

  const sendHeartbeat = async () => {
    try {
      const fullUrl = `${url}/${webhookKey}`;

      await fetch(fullUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          processName,
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
        }),
      });
    } catch (error) {
      console.warn(`Heartbeat failed: ${error}`);
    }
  };

  // Send initial heartbeat immediately (don't await, fire-and-forget)
  void sendHeartbeat();

  // Set up periodic heartbeats
  const intervalId = setInterval(() => {
    void sendHeartbeat();
  }, interval);

  // Return cleanup function
  return () => {
    clearInterval(intervalId);
  };
};

export const stopHeartbeat = (cleanup: () => void): void => {
  cleanup();
};
