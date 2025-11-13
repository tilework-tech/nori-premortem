import * as si from "systeminformation";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { ThresholdConfig } from "@/config.js";

import { fetchSystemMetrics, checkThresholds } from "@/monitor.js";

vi.mock("systeminformation");

describe("fetchSystemMetrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch system metrics and calculate percentages", async () => {
    vi.mocked(si.mem).mockResolvedValue({
      total: 16000000000,
      used: 8000000000,
      active: 8000000000,
      available: 8000000000,
      free: 8000000000,
      swaptotal: 0,
      swapused: 0,
      swapfree: 0,
      buffcache: 0,
    });

    vi.mocked(si.fsSize).mockResolvedValue([
      {
        fs: "/dev/sda1",
        type: "ext4",
        size: 500000000000,
        used: 400000000000,
        available: 100000000000,
        use: 80,
        mount: "/",
        rw: true,
      },
    ]);

    vi.mocked(si.currentLoad).mockResolvedValue({
      avgLoad: 2.5,
      currentLoad: 75,
      currentLoadUser: 50,
      currentLoadSystem: 25,
      currentLoadNice: 0,
      currentLoadIdle: 25,
      currentLoadIrq: 0,
      currentLoadSteal: 0,
      currentLoadGuest: 0,
      rawCurrentLoad: 750,
      rawCurrentLoadUser: 500,
      rawCurrentLoadSystem: 250,
      rawCurrentLoadNice: 0,
      rawCurrentLoadIdle: 250,
      rawCurrentLoadIrq: 0,
      rawCurrentLoadSteal: 0,
      rawCurrentLoadGuest: 0,
      cpus: [],
    });

    vi.mocked(si.processes).mockResolvedValue({
      all: 200,
      running: 5,
      blocked: 0,
      sleeping: 195,
      unknown: 0,
      list: [],
    });

    const metrics = await fetchSystemMetrics();

    expect(metrics.memoryPercent).toBe(50);
    expect(metrics.diskPercent).toBe(80);
    expect(metrics.cpuPercent).toBe(75);
    expect(metrics.processCount).toBe(200);
  });

  it("should correctly calculate memory using available field to avoid cache false positives", async () => {
    // Realistic Linux scenario: high "used" due to buffers/cache, but plenty available
    vi.mocked(si.mem).mockResolvedValue({
      total: 16074132000, // ~16GB
      free: 1327384000, // ~1.3GB (8% - looks terrible!)
      used: 14746748000, // ~14.7GB (92% - looks worse!)
      active: 9476116000, // ~9.5GB active
      available: 6598016000, // ~6.6GB (41% - actually fine!)
      swaptotal: 4194300000,
      swapused: 854520000,
      swapfree: 3339780000,
      buffcache: 5270632000,
    });

    vi.mocked(si.fsSize).mockResolvedValue([]);
    vi.mocked(si.currentLoad).mockResolvedValue({
      avgLoad: 1.0,
      currentLoad: 50,
      currentLoadUser: 30,
      currentLoadSystem: 20,
      currentLoadNice: 0,
      currentLoadIdle: 50,
      currentLoadIrq: 0,
      currentLoadSteal: 0,
      currentLoadGuest: 0,
      rawCurrentLoad: 500,
      rawCurrentLoadUser: 300,
      rawCurrentLoadSystem: 200,
      rawCurrentLoadNice: 0,
      rawCurrentLoadIdle: 500,
      rawCurrentLoadIrq: 0,
      rawCurrentLoadSteal: 0,
      rawCurrentLoadGuest: 0,
      cpus: [],
    });
    vi.mocked(si.processes).mockResolvedValue({
      all: 150,
      running: 3,
      blocked: 0,
      sleeping: 147,
      unknown: 0,
      list: [],
    });

    const metrics = await fetchSystemMetrics();

    // Should calculate based on available, not used
    // (16074132000 - 6598016000) / 16074132000 * 100 = 59%
    expect(metrics.memoryPercent).toBe(59);
  });

  it("should handle edge case when available field is zero", async () => {
    vi.mocked(si.mem).mockResolvedValue({
      total: 16000000000,
      free: 0,
      used: 16000000000,
      active: 16000000000,
      available: 0, // Edge case - no memory available
      swaptotal: 0,
      swapused: 0,
      swapfree: 0,
      buffcache: 0,
    });

    vi.mocked(si.fsSize).mockResolvedValue([]);
    vi.mocked(si.currentLoad).mockResolvedValue({
      avgLoad: 3.0,
      currentLoad: 95,
      currentLoadUser: 70,
      currentLoadSystem: 25,
      currentLoadNice: 0,
      currentLoadIdle: 5,
      currentLoadIrq: 0,
      currentLoadSteal: 0,
      currentLoadGuest: 0,
      rawCurrentLoad: 950,
      rawCurrentLoadUser: 700,
      rawCurrentLoadSystem: 250,
      rawCurrentLoadNice: 0,
      rawCurrentLoadIdle: 50,
      rawCurrentLoadIrq: 0,
      rawCurrentLoadSteal: 0,
      rawCurrentLoadGuest: 0,
      cpus: [],
    });
    vi.mocked(si.processes).mockResolvedValue({
      all: 300,
      running: 10,
      blocked: 2,
      sleeping: 288,
      unknown: 0,
      list: [],
    });

    const metrics = await fetchSystemMetrics();

    // When available is 0, should treat as 100% used
    expect(metrics.memoryPercent).toBe(100);
  });
});

describe("checkThresholds", () => {
  it("should return null when no thresholds are breached", () => {
    const metrics = {
      memoryPercent: 50,
      diskPercent: 60,
      cpuPercent: 40,
      processCount: 100,
    };

    const thresholds: ThresholdConfig = {
      memoryPercent: 90,
      diskPercent: 85,
      cpuPercent: 80,
    };

    const breach = checkThresholds({ metrics, thresholds });

    expect(breach).toBeNull();
  });

  it("should detect memory threshold breach", () => {
    const metrics = {
      memoryPercent: 95,
      diskPercent: 60,
      cpuPercent: 40,
      processCount: 100,
    };

    const thresholds: ThresholdConfig = {
      memoryPercent: 90,
    };

    const breach = checkThresholds({ metrics, thresholds });

    expect(breach).not.toBeNull();
    expect(breach?.type).toBe("memory");
    expect(breach?.currentValue).toBe(95);
    expect(breach?.thresholdValue).toBe(90);
  });

  it("should detect disk threshold breach", () => {
    const metrics = {
      memoryPercent: 50,
      diskPercent: 90,
      cpuPercent: 40,
      processCount: 100,
    };

    const thresholds: ThresholdConfig = {
      diskPercent: 85,
    };

    const breach = checkThresholds({ metrics, thresholds });

    expect(breach).not.toBeNull();
    expect(breach?.type).toBe("disk");
    expect(breach?.currentValue).toBe(90);
    expect(breach?.thresholdValue).toBe(85);
  });

  it("should detect CPU threshold breach", () => {
    const metrics = {
      memoryPercent: 50,
      diskPercent: 60,
      cpuPercent: 85,
      processCount: 100,
    };

    const thresholds: ThresholdConfig = {
      cpuPercent: 80,
    };

    const breach = checkThresholds({ metrics, thresholds });

    expect(breach).not.toBeNull();
    expect(breach?.type).toBe("cpu");
    expect(breach?.currentValue).toBe(85);
    expect(breach?.thresholdValue).toBe(80);
  });

  it("should return only the first breach when multiple thresholds breached", () => {
    const metrics = {
      memoryPercent: 95,
      diskPercent: 90,
      cpuPercent: 85,
      processCount: 100,
    };

    const thresholds: ThresholdConfig = {
      memoryPercent: 90,
      diskPercent: 85,
      cpuPercent: 80,
    };

    const breach = checkThresholds({ metrics, thresholds });

    // Should return memory breach (first in deterministic order)
    expect(breach).not.toBeNull();
    expect(breach?.type).toBe("memory");
  });

  it("should follow deterministic order: memory > disk > cpu", () => {
    const metricsAllBreach = {
      memoryPercent: 95,
      diskPercent: 90,
      cpuPercent: 85,
      processCount: 100,
    };

    const thresholdsAll: ThresholdConfig = {
      memoryPercent: 90,
      diskPercent: 85,
      cpuPercent: 80,
    };

    // All breached - should return memory
    expect(
      checkThresholds({ metrics: metricsAllBreach, thresholds: thresholdsAll })
        ?.type,
    ).toBe("memory");

    // Only disk and CPU breached - should return disk
    const metricsDiskCpu = { ...metricsAllBreach, memoryPercent: 50 };
    expect(
      checkThresholds({ metrics: metricsDiskCpu, thresholds: thresholdsAll })
        ?.type,
    ).toBe("disk");

    // Only CPU breached - should return cpu
    const metricsCpuOnly = {
      ...metricsAllBreach,
      memoryPercent: 50,
      diskPercent: 50,
    };
    expect(
      checkThresholds({ metrics: metricsCpuOnly, thresholds: thresholdsAll })
        ?.type,
    ).toBe("cpu");
  });
});
