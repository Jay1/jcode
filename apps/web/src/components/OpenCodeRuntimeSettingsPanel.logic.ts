import type { ManagedSidecarDiagnostics, OpenCodeRuntimeMismatch } from "@jcode/contracts";

interface RuntimeCapabilitySummary {
  readonly count: number;
  readonly names?: readonly string[];
  readonly slugs?: readonly string[];
}

const MISMATCH_SEVERITIES = [
  "blocking",
  "error",
  "warning",
  "info",
] as const satisfies readonly OpenCodeRuntimeMismatch["severity"][];

function yesNo(value: boolean): string {
  return value ? "yes" : "no";
}

function pluralize(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`;
}

export function formatRuntimeCapabilityLine(
  label: string,
  summary: RuntimeCapabilitySummary | undefined,
): string {
  if (!summary) return `${label}: unavailable`;
  return `${label}: available (${summary.count})`;
}

export function formatRuntimeMismatchSummary(
  mismatches: readonly OpenCodeRuntimeMismatch[],
): string {
  if (mismatches.length === 0) return "Mismatches: none";

  const severityParts = MISMATCH_SEVERITIES.flatMap((severity) => {
    const count = mismatches.filter((mismatch) => mismatch.severity === severity).length;
    return count === 0 ? [] : [`${count} ${pluralize(count, severity)}`];
  });

  return `Mismatches: ${mismatches.length} (${severityParts.join(", ")})`;
}

export function formatManagedSidecarDiagnosticsSupportSummary(
  diagnostics: ManagedSidecarDiagnostics,
): string {
  const { report } = diagnostics;
  const lines = [
    "JCode OpenCode diagnostics support summary",
    `Generated: ${report.generatedAt}`,
    `Summary: ${report.summary}`,
    `Health: ${report.healthStatus}`,
    `Sidecar state: ${report.sidecarState}`,
    `Binary version: ${report.binaryVersion}`,
    `Binary exists: ${yesNo(report.binaryExists)}`,
    `Binary valid: ${yesNo(report.binaryValid)}`,
    `Server reachable: ${yesNo(report.serverReachable)}`,
    `Platform: ${report.platform.os} ${report.platform.arch}, Node ${report.platform.nodeVersion}`,
  ];

  if (report.binaryPath) {
    lines.push(`Binary path: ${report.binaryPath}`);
  }

  if (report.serverUrl) {
    lines.push(`Server URL: ${report.serverUrl}`);
  }

  if (report.issue) {
    lines.push(`Issue: ${report.issue}`);
  }

  return lines.join("\n");
}

export function downloadManagedSidecarDiagnostics(diagnostics: ManagedSidecarDiagnostics): void {
  const payload = JSON.stringify(diagnostics, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const objectUrl = URL.createObjectURL(blob);
  const generatedAt = diagnostics.generatedAt.replace(/[:.]/g, "-");

  try {
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `jcode-managed-sidecar-diagnostics-${generatedAt}.json`;
    link.rel = "noopener";
    link.click();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
