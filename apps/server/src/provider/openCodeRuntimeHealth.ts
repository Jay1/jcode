import { existsSync } from "node:fs";

import type {
  OpenCodeRuntimeCapabilitySummary,
  OpenCodeRuntimeHealth,
  OpenCodeRuntimeMismatch,
  OpenCodeRuntimeMismatchSeverity,
  OpenCodeRuntimeModelCapabilitySummary,
  ServerSettings,
} from "@jcode/contracts";
import { Cause, Effect, Exit } from "effect";

import {
  type OpenCodeCompatibleCliSpec,
  type OpenCodeInventory,
  type OpenCodeRuntimeShape,
  openCodeRuntimeErrorDetail,
} from "./opencodeRuntime.ts";
import {
  resolveOpenCodeRuntimeConnectionConfig,
  resolveOpenCodeRuntimeProfile,
  type ResolvedOpenCodeRuntimeProfile,
} from "./openCodeRuntimeProfiles.ts";

function trimToNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function valueName(value: unknown): string | null {
  if (typeof value === "string") return trimToNull(value);
  const record = asRecord(value);
  if (!record) return null;
  return (
    trimToNull(record.name) ??
    trimToNull(record.id) ??
    trimToNull(record.key) ??
    trimToNull(record.title) ??
    null
  );
}

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set([...values].map((value) => value.trim()).filter(Boolean))].sort(
    (left, right) => left.localeCompare(right),
  );
}

function summarizeNames(names: Iterable<string>): OpenCodeRuntimeCapabilitySummary {
  const sorted = uniqueSorted(names);
  return { count: sorted.length, names: sorted };
}

function summarizeModels(slugs: Iterable<string>): OpenCodeRuntimeModelCapabilitySummary {
  const sorted = uniqueSorted(slugs);
  return { count: sorted.length, slugs: sorted };
}

function extractNamedCollection(root: unknown, keys: readonly string[]): string[] {
  const queue: unknown[] = [root];
  const names: string[] = [];
  const visited = new Set<unknown>();
  const keySet = new Set(keys);

  while (queue.length > 0) {
    const value = queue.shift();
    if (!value || visited.has(value)) continue;
    if (typeof value === "object") visited.add(value);

    if (Array.isArray(value)) {
      for (const item of value) {
        const name = valueName(item);
        if (name) names.push(name);
        queue.push(item);
      }
      continue;
    }

    const record = asRecord(value);
    if (!record) continue;
    for (const [key, child] of Object.entries(record)) {
      if (keySet.has(key)) {
        if (Array.isArray(child)) {
          for (const item of child) {
            const name = valueName(item);
            if (name) names.push(name);
          }
        } else {
          const childRecord = asRecord(child);
          if (childRecord) {
            for (const [childKey, childValue] of Object.entries(childRecord)) {
              names.push(valueName(childValue) ?? childKey);
            }
          }
        }
      }
      queue.push(child);
    }
  }

  return uniqueSorted(names);
}

function inventoryModelSlugs(inventory: OpenCodeInventory): string[] {
  const slugs: string[] = [];
  const providerList = asRecord(inventory.providerList);
  const allProviders = providerList?.all;
  if (Array.isArray(allProviders)) {
    for (const provider of allProviders) {
      const providerRecord = asRecord(provider);
      const providerID = trimToNull(providerRecord?.id) ?? trimToNull(providerRecord?.providerID);
      const models = providerRecord?.models;
      if (!providerID || !models) continue;
      if (Array.isArray(models)) {
        for (const model of models) {
          const modelID = valueName(model);
          if (modelID) slugs.push(`${providerID}/${modelID}`);
        }
      } else {
        const modelRecord = asRecord(models);
        if (modelRecord) {
          for (const modelID of Object.keys(modelRecord)) slugs.push(`${providerID}/${modelID}`);
        }
      }
    }
  }
  return uniqueSorted(slugs);
}

function requirementSeverity(
  resolved: ResolvedOpenCodeRuntimeProfile,
): OpenCodeRuntimeMismatchSeverity {
  switch (resolved.profile.capabilityPolicy) {
    case "blockAll":
      return "blocking";
    case "blockNewThreads":
      return "error";
    case "warn":
      return "warning";
  }
}

function addMissingCapabilityMismatches(input: {
  readonly mismatches: OpenCodeRuntimeMismatch[];
  readonly resolved: ResolvedOpenCodeRuntimeProfile;
  readonly kind: "command" | "skill" | "plugin" | "agent" | "model";
  readonly required: readonly string[];
  readonly available: readonly string[] | undefined;
}) {
  if (input.required.length === 0) return;
  if (!input.available) {
    input.mismatches.push({
      id: `capability-${input.kind}-unknown`,
      severity: requirementSeverity(input.resolved),
      message: `OpenCode did not expose ${input.kind} discovery for this runtime.`,
      expected: input.required,
    });
    return;
  }
  const available = new Set(input.available.map((value) => value.toLowerCase()));
  for (const required of input.required) {
    if (available.has(required.toLowerCase())) continue;
    input.mismatches.push({
      id: `missing-${input.kind}-${required}`,
      severity: requirementSeverity(input.resolved),
      message: `Required OpenCode ${input.kind} not found: ${required}`,
      expected: required,
      actual: input.available,
    });
  }
}

function profilePathMismatches(
  resolved: ResolvedOpenCodeRuntimeProfile,
): OpenCodeRuntimeMismatch[] {
  const profile = resolved.profile;
  const checks = [
    ["homePath", profile.homePath],
    ["opencodeConfigDir", profile.opencodeConfigDir],
    ["opencodeDataDir", profile.opencodeDataDir],
    ...profile.skillRoots.map((path) => ["skillRoot", path] as const),
    ...profile.pluginRoots.map((path) => ["pluginRoot", path] as const),
  ] as const;
  return checks.flatMap(([kind, path]) =>
    path && !existsSync(path)
      ? [
          {
            id: `missing-path-${kind}-${path}`,
            severity: "warning" as const,
            message: `Expected OpenCode ${kind} path does not exist on this host: ${path}`,
            expected: path,
            actual: "missing",
          },
        ]
      : [],
  );
}

function buildStatus(
  mismatches: readonly OpenCodeRuntimeMismatch[],
): OpenCodeRuntimeHealth["status"] {
  if (mismatches.some((mismatch) => mismatch.severity === "blocking")) return "misconfigured";
  if (mismatches.some((mismatch) => mismatch.severity === "error")) return "degraded";
  if (mismatches.length > 0) return "degraded";
  return "healthy";
}

function baseHealth(input: {
  readonly resolved: ResolvedOpenCodeRuntimeProfile;
  readonly binaryPath?: string;
  readonly serverUrl?: string;
  readonly status: OpenCodeRuntimeHealth["status"];
  readonly external: boolean;
  readonly mismatches: OpenCodeRuntimeMismatch[];
}): OpenCodeRuntimeHealth {
  const profile = input.resolved.profile;
  return {
    provider: "opencode",
    profileId: profile.id,
    profileLabel: profile.label,
    mode: profile.mode,
    configMode: profile.configMode,
    status: input.status,
    ...(input.serverUrl ? { serverUrl: input.serverUrl } : {}),
    external: input.external,
    ...(input.binaryPath ? { binaryPath: input.binaryPath } : {}),
    resolvedPaths: {
      ...(profile.homePath ? { home: profile.homePath } : {}),
      ...(profile.configHome ? { xdgConfigHome: profile.configHome } : {}),
      ...(profile.opencodeConfigDir ? { opencodeConfigDir: profile.opencodeConfigDir } : {}),
      ...(profile.opencodeDataDir ? { opencodeDataDir: profile.opencodeDataDir } : {}),
      ...(profile.cwdDefault ? { cwdDefault: profile.cwdDefault } : {}),
    },
    capabilities: {},
    mismatches: input.mismatches,
    checkedAt: new Date().toISOString(),
  };
}

export function checkOpenCodeRuntimeHealth(input: {
  readonly settings: ServerSettings;
  readonly runtime: OpenCodeRuntimeShape;
  readonly cliSpec: OpenCodeCompatibleCliSpec;
  readonly defaultBinaryPath: string;
  readonly profileId?: string | null;
  readonly cwd?: string | null;
}): Effect.Effect<OpenCodeRuntimeHealth, never> {
  return Effect.scoped(
    Effect.gen(function* () {
      const resolved = resolveOpenCodeRuntimeProfile({
        settings: input.settings,
        defaultBinaryPath: input.defaultBinaryPath,
        ...(input.profileId !== undefined ? { profileId: input.profileId } : {}),
      });
      const profile = resolved.profile;
      const connectionConfig = resolveOpenCodeRuntimeConnectionConfig({
        resolved,
        cliSpec: input.cliSpec,
        defaultBinaryPath: input.defaultBinaryPath,
        ...(input.cwd !== undefined ? { cwd: input.cwd } : {}),
      });

      if (
        (profile.mode === "external" || profile.mode === "remote") &&
        !connectionConfig.serverUrl
      ) {
        return baseHealth({
          resolved,
          binaryPath: connectionConfig.binaryPath,
          status: "misconfigured",
          external: true,
          mismatches: [
            {
              id: "runtime-server-url-missing",
              severity: "blocking",
              message: "OpenCode runtime profile requires a server URL.",
            },
          ],
        });
      }

      const serverExit = yield* Effect.exit(
        input.runtime.connectToOpenCodeServer({
          binaryPath: connectionConfig.binaryPath,
          cliSpec: connectionConfig.cliSpec,
          ...(connectionConfig.serverUrl ? { serverUrl: connectionConfig.serverUrl } : {}),
          configMode: connectionConfig.configMode,
          ...(connectionConfig.homePath ? { homePath: connectionConfig.homePath } : {}),
          ...(connectionConfig.xdgConfigHome
            ? { xdgConfigHome: connectionConfig.xdgConfigHome }
            : {}),
          ...(connectionConfig.cwd ? { cwd: connectionConfig.cwd } : {}),
        }),
      );

      if (Exit.isFailure(serverExit)) {
        return baseHealth({
          resolved,
          binaryPath: connectionConfig.binaryPath,
          status: "unreachable",
          external: profile.mode !== "managed",
          mismatches: [
            {
              id: "runtime-unreachable",
              severity: "blocking",
              message: `OpenCode runtime is unreachable: ${openCodeRuntimeErrorDetail(
                Cause.squash(serverExit.cause),
              )}`,
            },
          ],
          ...(connectionConfig.serverUrl ? { serverUrl: connectionConfig.serverUrl } : {}),
        });
      }
      const server = serverExit.value;

      const client = input.runtime.createOpenCodeSdkClient({
        baseUrl: server.url,
        directory: input.cwd ?? profile.cwdDefault ?? process.cwd(),
        cliSpec: input.cliSpec,
        ...(server.external && resolved.serverPassword
          ? { serverPassword: resolved.serverPassword }
          : {}),
      });
      const inventoryExit = yield* Effect.exit(input.runtime.loadOpenCodeInventory(client));
      if (Exit.isFailure(inventoryExit)) {
        return baseHealth({
          resolved,
          binaryPath: connectionConfig.binaryPath,
          serverUrl: server.url,
          status: "unreachable",
          external: server.external,
          mismatches: [
            {
              id: "runtime-inventory-unreachable",
              severity: "blocking",
              message: `OpenCode runtime connected but inventory failed: ${openCodeRuntimeErrorDetail(
                Cause.squash(inventoryExit.cause),
              )}`,
            },
          ],
        });
      }

      const inventory = inventoryExit.value;
      const agents = summarizeNames(
        inventory.agents.flatMap((agent) => {
          const name = valueName(agent);
          return name ? [name] : [];
        }),
      );
      const commands = summarizeNames(
        extractNamedCollection(inventory.consoleState, ["commands", "slashCommands"]),
      );
      const skills = summarizeNames(extractNamedCollection(inventory.consoleState, ["skills"]));
      const plugins = summarizeNames(extractNamedCollection(inventory.consoleState, ["plugins"]));
      const cliModels = yield* input.runtime
        .listOpenCodeCliModels({ binaryPath: connectionConfig.binaryPath, cliSpec: input.cliSpec })
        .pipe(
          Effect.map((models) => models.map((model) => model.slug)),
          Effect.catch(() => Effect.succeed([])),
        );
      const models = summarizeModels(
        cliModels.length > 0 ? cliModels : inventoryModelSlugs(inventory),
      );
      const mismatches = profilePathMismatches(resolved);

      addMissingCapabilityMismatches({
        mismatches,
        resolved,
        kind: "command",
        required: profile.requiredCommands,
        available: commands.names.length > 0 ? commands.names : undefined,
      });
      addMissingCapabilityMismatches({
        mismatches,
        resolved,
        kind: "skill",
        required: profile.requiredSkills,
        available: skills.names.length > 0 ? skills.names : undefined,
      });
      addMissingCapabilityMismatches({
        mismatches,
        resolved,
        kind: "plugin",
        required: profile.requiredPlugins,
        available: plugins.names.length > 0 ? plugins.names : undefined,
      });
      addMissingCapabilityMismatches({
        mismatches,
        resolved,
        kind: "agent",
        required: profile.requiredAgents,
        available: agents.names,
      });
      addMissingCapabilityMismatches({
        mismatches,
        resolved,
        kind: "model",
        required: profile.requiredModels,
        available: models.slugs,
      });

      for (const envName of profile.requiredEnv) {
        if (process.env[envName]) continue;
        mismatches.push({
          id: `missing-env-${envName}`,
          severity: requirementSeverity(resolved),
          message: `Required runtime environment marker is missing from the JCode process: ${envName}`,
          expected: envName,
          actual: "missing",
        });
      }

      return {
        ...baseHealth({
          resolved,
          binaryPath: connectionConfig.binaryPath,
          serverUrl: server.url,
          status: buildStatus(mismatches),
          external: server.external,
          mismatches,
        }),
        capabilities: {
          commands,
          skills,
          plugins,
          agents,
          models,
        },
      };
    }),
  ).pipe(
    Effect.catch((cause) =>
      Effect.succeed({
        provider: "opencode" as const,
        profileId: "unknown",
        profileLabel: "Unknown OpenCode runtime",
        mode: "managed" as const,
        configMode: "inherit" as const,
        status: "unreachable" as const,
        external: false,
        capabilities: {},
        mismatches: [
          {
            id: "runtime-health-failed",
            severity: "blocking" as const,
            message: `OpenCode runtime health check failed: ${openCodeRuntimeErrorDetail(cause)}`,
          },
        ],
        checkedAt: new Date().toISOString(),
      }),
    ),
  );
}
