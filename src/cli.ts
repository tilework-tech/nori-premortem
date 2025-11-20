#!/usr/bin/env node

import minimist from "minimist";
import winston from "winston";

import { loadConfig } from "@/config.js";
import { startDaemon } from "@/daemon.js";

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

const showHelp = () => {
  console.log(`
Nori Premortem - System monitoring and intelligent diagnostics

Usage:
  nori-premortem --config <path>

Options:
  --config <path>   Path to configuration file (required)
  --help            Show this help message
  --version         Show version information

Example:
  nori-premortem --config ./config.json
`);
};

const showVersion = () => {
  console.log("nori-premortem v1.0.0");
};

export const main = async (argv: Array<string>): Promise<void> => {
  const args = minimist(argv.slice(2));

  if (args.help || args.h) {
    showHelp();
    return;
  }

  if (args.version || args.v) {
    showVersion();
    return;
  }

  if (!args.config) {
    logger.error("Error: --config argument is required");
    showHelp();
    process.exit(1);
  }

  try {
    logger.info(`Loading configuration from ${args.config}`);
    const config = loadConfig({ path: args.config });

    logger.info("Configuration loaded successfully");
    logger.info(`Webhook URL: ${config.webhookUrl}`);
    logger.info(`Polling interval: ${config.pollingInterval}ms`);

    await startDaemon({ config });
  } catch (error) {
    logger.error(`Failed to start daemon: ${error}`);
    process.exit(1);
  }
};

// Run if called directly (checking if this is the main module)
// Note: We can't use import.meta.url === `file://${process.argv[1]}` because
// it fails when run through npm's symlink. Instead, we check if we're in a test environment.
if (process.env.NODE_ENV !== "test" && process.env.VITEST !== "true") {
  main(process.argv).catch((error) => {
    logger.error(`Fatal error: ${error}`);
    process.exit(1);
  });
}
