import type { ManagedSidecarDiagnostics } from "@jcode/contracts";
import { describe, expect, it } from "vitest";

import {
  formatManagedSidecarDiagnosticsSupportSummary,
  formatRuntimeCapabilityLine,
  formatRuntimeMismatchSummary,
} from "./OpenCodeRuntimeSettingsPanel.logic";

const SUPPORT_DIAGNOSTICS: ManagedSidecarDiagnostics = {
  generatedAt: "2026-06-07T12:02:00.000Z",
  health: {
    status: "repairing",
    sidecarState: "error",
    binaryPath: "/tmp/jcode/opencode",
    binaryExists: true,
    binaryValid: false,
    serverUrl: "http://127.0.0.1:4096",
    serverReachable: false,
    error: "probe failed",
    checkedAt: "2026-06-07T12:01:00.000Z",
  },
  platform: {
    os: "linux",
    arch: "x64",
    nodeVersion: "v26.2.0",
  },
  binaryVersion: "0.10.1",
  logs: ["serverPassword=test-password", "Authorization: Bearer secret-token"],
  report: {
    summary: "Managed sidecar degraded: server unreachable.",
    generatedAt: "2026-06-07T12:02:00.000Z",
    healthStatus: "repairing",
    sidecarState: "error",
    binaryPath: "/tmp/jcode/opencode",
    binaryVersion: "0.10.1",
    binaryExists: true,
    binaryValid: false,
    serverUrl: "http://127.0.0.1:4096",
    serverReachable: false,
    platform: {
      os: "linux",
      arch: "x64",
      nodeVersion: "v26.2.0",
    },
    issue: "Server probe failed after launch.",
  },
  sidecarSnapshot: {
    state: "error",
    binaryPath: "/tmp/jcode/opencode",
    serverUrl: "http://127.0.0.1:4096",
  },
};

describe("formatManagedSidecarDiagnosticsSupportSummary", () => {
  it("includes useful report fields without copying secret-bearing diagnostics payload fields", () => {
    const text = formatManagedSidecarDiagnosticsSupportSummary(SUPPORT_DIAGNOSTICS);

    expect(text).toContain("JCode OpenCode diagnostics support summary");
    expect(text).toContain("Managed sidecar degraded: server unreachable.");
    expect(text).toContain("Health: repairing");
    expect(text).toContain("Sidecar state: error");
    expect(text).toContain("Binary version: 0.10.1");
    expect(text).toContain("Binary valid: no");
    expect(text).toContain("Server reachable: no");
    expect(text).toContain("Platform: linux x64, Node v26.2.0");
    expect(text).toContain("Issue: Server probe failed after launch.");
    expect(text).not.toContain("test-password");
    expect(text).not.toContain("secret-token");
    expect(text).not.toContain("serverPassword");
    expect(text).not.toContain("Authorization");
  });
});

describe("formatRuntimeCapabilityLine", () => {
  it("distinguishes available zero-count capability surfaces from unavailable surfaces", () => {
    expect(formatRuntimeCapabilityLine("Commands", { count: 2, names: ["init", "run"] })).toBe(
      "Commands: available (2)",
    );
    expect(formatRuntimeCapabilityLine("Skills", { count: 0, names: [] })).toBe(
      "Skills: available (0)",
    );
    expect(formatRuntimeCapabilityLine("Plugins", undefined)).toBe("Plugins: unavailable");
    expect(formatRuntimeCapabilityLine("Models", { count: 0, slugs: [] })).toBe(
      "Models: available (0)",
    );
  });
});

describe("formatRuntimeMismatchSummary", () => {
  it("summarizes mismatch state by severity", () => {
    expect(formatRuntimeMismatchSummary([])).toBe("Mismatches: none");
    expect(
      formatRuntimeMismatchSummary([
        { id: "command-rg", severity: "blocking", message: "Required command rg is unavailable." },
        { id: "skill-review", severity: "warning", message: "Review skill is unavailable." },
        { id: "model-gpt", severity: "warning", message: "Model is unavailable." },
      ]),
    ).toBe("Mismatches: 3 (1 blocking, 2 warnings)");
  });
});
