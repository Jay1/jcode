import type {
  ManagedSidecarDiagnostics,
  ManagedSidecarDiagnosticsReport,
  ManagedSidecarHealthCheck,
} from "@jcode/contracts";

export const buildManagedSidecarDiagnosticsReport = (input: {
  generatedAt: string;
  health: ManagedSidecarHealthCheck;
  platform: ManagedSidecarDiagnostics["platform"];
  binaryVersion: string;
}): ManagedSidecarDiagnosticsReport => {
  const issue = input.health.error;
  const summary = `OpenCode managed sidecar is ${input.health.status}${issue ? `: ${issue}` : ""}`;

  return {
    summary,
    generatedAt: input.generatedAt,
    healthStatus: input.health.status,
    sidecarState: input.health.sidecarState,
    ...(input.health.binaryPath ? { binaryPath: input.health.binaryPath } : {}),
    binaryVersion: input.binaryVersion,
    binaryExists: input.health.binaryExists,
    binaryValid: input.health.binaryValid,
    ...(input.health.serverUrl ? { serverUrl: input.health.serverUrl } : {}),
    serverReachable: input.health.serverReachable,
    platform: input.platform,
    ...(issue ? { issue } : {}),
  } satisfies ManagedSidecarDiagnosticsReport;
};
