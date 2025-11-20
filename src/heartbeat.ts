import fetch from "node-fetch";

export const validateHeartbeatEndpoint = async (args: {
  url: string;
  processName: string;
}): Promise<void> => {
  const { url, processName } = args;

  const response = await fetch(url, {
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
  processName: string;
  interval: number;
}): (() => void) => {
  const { url, processName, interval } = args;

  const sendHeartbeat = async () => {
    try {
      await fetch(url, {
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
      console.log("Sent heartbeat...");
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
