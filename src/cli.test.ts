import {
  writeFileSync,
  unlinkSync,
  mkdtempSync,
  symlinkSync,
  existsSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";

import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("CLI symlink execution", () => {
  let tmpDir: string;
  let symlinkPath: string;
  const cliPath = join(process.cwd(), "build/cli.js");

  beforeEach(() => {
    // Ensure build exists
    if (!existsSync(cliPath)) {
      throw new Error("build/cli.js does not exist. Run npm run build first.");
    }

    tmpDir = mkdtempSync(join(tmpdir(), "cli-symlink-test-"));
    symlinkPath = join(tmpDir, "nori-premortem");
  });

  afterEach(() => {
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("should execute and show help when called through symlink with no arguments", () => {
    symlinkSync(cliPath, symlinkPath);

    let output = "";
    let errorThrown = false;

    try {
      execSync(`node ${symlinkPath}`, { encoding: "utf-8" });
    } catch (error: any) {
      errorThrown = true;
      output = error.stdout || error.stderr || "";
    }

    // Should fail with exit code 1 because --config is required
    expect(errorThrown).toBe(true);
    // But should show help message
    expect(output).toContain("Nori Premortem");
    expect(output).toContain("Usage:");
    expect(output).toContain("--config");
  });

  it("should execute and show help when called through symlink with --help", () => {
    symlinkSync(cliPath, symlinkPath);

    const output = execSync(`node ${symlinkPath} --help`, {
      encoding: "utf-8",
    });

    expect(output).toContain("Nori Premortem");
    expect(output).toContain("Usage:");
    expect(output).toContain("--config");
    expect(output).toContain("Options:");
  });

  it("should execute and show version when called through symlink with --version", () => {
    symlinkSync(cliPath, symlinkPath);

    const output = execSync(`node ${symlinkPath} --version`, {
      encoding: "utf-8",
    });

    expect(output).toContain("nori-premortem v1.0.0");
  });
});
