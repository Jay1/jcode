import type { ProviderListModelsResult, ServerProviderStatus } from "@jcode/contracts";

export const COPILOT_MODEL_SOURCE_ID = "github-copilot" as const;

export interface CopilotModelSourceRegistryEntry {
  readonly sourceId: typeof COPILOT_MODEL_SOURCE_ID;
  readonly label: "GitHub Copilot";
  readonly hostProvider: "opencode";
  readonly runtimeProviderKind: null;
  readonly firstClassProvider: false;
  readonly requiredFollowUps: readonly [string, string, string];
}

export interface CopilotOfflineAuthMissingSnapshot {
  readonly status: ServerProviderStatus;
  readonly models: ProviderListModelsResult["models"];
  readonly modelsSource: "auth-missing";
  readonly networkAccess: "disabled";
}

export function makeCopilotModelSourceRegistryEntry(): CopilotModelSourceRegistryEntry {
  return {
    sourceId: COPILOT_MODEL_SOURCE_ID,
    label: "GitHub Copilot",
    hostProvider: "opencode",
    runtimeProviderKind: null,
    firstClassProvider: false,
    requiredFollowUps: [
      "OpenCode runtime profile or model-source capability detection",
      "Offline auth/status probe with no stored Copilot secret material",
      "Canonical provider-runtime event mapping before turn execution",
    ],
  };
}

export function makeCopilotOfflineAuthMissingSnapshot(input: {
  readonly checkedAt: string;
}): CopilotOfflineAuthMissingSnapshot {
  return {
    status: {
      provider: "opencode",
      status: "warning",
      available: false,
      authStatus: "unauthenticated",
      authType: COPILOT_MODEL_SOURCE_ID,
      authLabel: "GitHub Copilot",
      checkedAt: input.checkedAt,
      message:
        "GitHub Copilot is not available until an offline auth probe proves an OpenCode-backed model source can use existing user credentials.",
    },
    models: [],
    modelsSource: "auth-missing",
    networkAccess: "disabled",
  };
}
