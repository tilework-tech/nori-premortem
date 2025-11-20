import { execFileSync } from "node:child_process";
import { join } from "node:path";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { main } from "@/cli.js";

describe("CLI main function", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    processExitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  it("should display help message when --help flag is provided", async () => {
    const argv = ["node", "/path/to/cli.js", "--help"];

    await main(argv);

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls.join("\n");
    expect(output).toContain("Nori Premortem");
    expect(output).toContain("Usage:");
    expect(output).toContain("--config");
  });

  it("should display help message when -h flag is provided", async () => {
    const argv = ["node", "/path/to/cli.js", "-h"];

    await main(argv);

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls.join("\n");
    expect(output).toContain("Nori Premortem");
    expect(output).toContain("Usage:");
  });

  it("should display version when --version flag is provided", async () => {
    const argv = ["node", "/path/to/cli.js", "--version"];

    await main(argv);

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls.join("\n");
    expect(output).toContain("nori-premortem");
    expect(output).toContain("1.0.0");
  });

  it("should display version when -v flag is provided", async () => {
    const argv = ["node", "/path/to/cli.js", "-v"];

    await main(argv);

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls.join("\n");
    expect(output).toContain("nori-premortem");
    expect(output).toContain("1.0.0");
  });

  it("should exit with error when no --config argument is provided", async () => {
    const argv = ["node", "/path/to/cli.js"];

    await main(argv);

    expect(processExitSpy).toHaveBeenCalledWith(1);
    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls.join("\n");
    expect(output).toContain("Usage:");
  });
});

describe("CLI script execution", () => {
  it("should execute main() when built CLI is run directly with --help", () => {
    const cliPath = join(process.cwd(), "build", "cli.js");

    const output = execFileSync(cliPath, ["--help"], {
      encoding: "utf-8",
      env: { ...process.env, NODE_ENV: "production", VITEST: undefined },
    });

    expect(output).toContain("Nori Premortem");
    expect(output).toContain("Usage:");
    expect(output).toContain("--config");
  });

  it("should execute main() when built CLI is run directly with --version", () => {
    const cliPath = join(process.cwd(), "build", "cli.js");

    const output = execFileSync(cliPath, ["--version"], {
      encoding: "utf-8",
      env: { ...process.env, NODE_ENV: "production", VITEST: undefined },
    });

    expect(output).toContain("nori-premortem");
    expect(output).toContain("1.0.0");
  });
});
