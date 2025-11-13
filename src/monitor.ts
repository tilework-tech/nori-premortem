import * as si from "systeminformation";

import type { ThresholdConfig } from "@/config.js";

export type SystemMetrics = {
  memoryPercent: number;
  diskPercent: number;
  cpuPercent: number;
  processCount: number;
};

export type ThresholdBreach = {
  type: "memory" | "disk" | "cpu" | "process";
  currentValue: number;
  thresholdValue: number;
  timestamp: Date;
};

export const fetchSystemMetrics = async (): Promise<SystemMetrics> => {
  const [memory, disk, cpu, processes] = await Promise.all([
    si.mem(),
    si.fsSize(),
    si.currentLoad(),
    si.processes(),
  ]);

  const memoryPercent =
    ((memory.total - memory.available) / memory.total) * 100;
  const diskPercent = disk.length > 0 ? disk[0].use : 0;
  const cpuPercent = cpu.currentLoad;
  const processCount = processes.all;

  return {
    memoryPercent: Math.round(memoryPercent),
    diskPercent: Math.round(diskPercent),
    cpuPercent: Math.round(cpuPercent),
    processCount,
  };
};

export const checkThresholds = (args: {
  metrics: SystemMetrics;
  thresholds: ThresholdConfig;
}): ThresholdBreach | null => {
  const { metrics, thresholds } = args;

  // Check in deterministic order: memory > disk > cpu > process
  if (
    thresholds.memoryPercent != null &&
    metrics.memoryPercent > thresholds.memoryPercent
  ) {
    return {
      type: "memory",
      currentValue: metrics.memoryPercent,
      thresholdValue: thresholds.memoryPercent,
      timestamp: new Date(),
    };
  }

  if (
    thresholds.diskPercent != null &&
    metrics.diskPercent > thresholds.diskPercent
  ) {
    return {
      type: "disk",
      currentValue: metrics.diskPercent,
      thresholdValue: thresholds.diskPercent,
      timestamp: new Date(),
    };
  }

  if (
    thresholds.cpuPercent != null &&
    metrics.cpuPercent > thresholds.cpuPercent
  ) {
    return {
      type: "cpu",
      currentValue: metrics.cpuPercent,
      thresholdValue: thresholds.cpuPercent,
      timestamp: new Date(),
    };
  }

  // Process name check would go here if implemented
  // For now, we only support percentage-based thresholds

  return null;
};
