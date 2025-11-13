import fetch from "node-fetch";
import winston from "winston";

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level}]: ${message}`;
    }),
  ),
  transports: [new winston.transports.Console()],
});

export const sendWebhook = async (args: {
  url: string;
  message: unknown;
}): Promise<void> => {
  const { url, message } = args;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      logger.warn(
        `Webhook POST failed with status ${response.status}: ${response.statusText}`,
      );
    } else {
      logger.info(`Webhook sent successfully`);
    }
  } catch (error) {
    logger.error(`Webhook POST error: ${error}`);
    // Fire-and-forget: do not throw, just log
  }
};
