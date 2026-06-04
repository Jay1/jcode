import type {
  CatalogSkillEntry,
  ProviderInstallSkillInput,
  ProviderKind,
  ProviderSearchCatalogResult,
  ProviderUninstallSkillInput,
} from "@jcode/contracts";
import { ServiceMap } from "effect";
import type { Effect } from "effect";

import type { ProviderAdapterRequestError } from "../Errors.ts";

export type SkillManagementAgent = Extract<ProviderKind, "codex" | "opencode">;

export interface SkillManagementInstallInput extends Pick<
  ProviderInstallSkillInput,
  "cwd" | "packageRef" | "skillName" | "global"
> {
  readonly agent: SkillManagementAgent;
}

export interface SkillManagementUninstallInput extends Pick<
  ProviderUninstallSkillInput,
  "cwd" | "global"
> {
  readonly agent: SkillManagementAgent;
  readonly skillName: string;
}

export interface SkillManagementServiceShape {
  readonly install: (
    input: SkillManagementInstallInput,
  ) => Effect.Effect<void, ProviderAdapterRequestError>;
  readonly uninstall: (
    input: SkillManagementUninstallInput,
  ) => Effect.Effect<void, ProviderAdapterRequestError>;
  readonly searchCatalog: (
    query: string,
  ) => Effect.Effect<ProviderSearchCatalogResult, ProviderAdapterRequestError>;
}

export class SkillManagementService extends ServiceMap.Service<
  SkillManagementService,
  SkillManagementServiceShape
>()("jcode/provider/Services/SkillManagementService") {}

export function buildSkillsAddArgs(input: {
  readonly agent: SkillManagementAgent;
  readonly packageRef: string;
  readonly skillName?: string | undefined;
}): readonly string[] {
  return [
    "skills",
    "add",
    input.packageRef,
    "--agent",
    input.agent,
    ...(input.skillName ? ["--skill", input.skillName] : []),
    "-y",
  ];
}

export function buildSkillsRemoveArgs(input: {
  readonly agent: SkillManagementAgent;
  readonly skillName: string;
}): readonly string[] {
  return ["skills", "remove", input.skillName, "--agent", input.agent, "-y"];
}

export function buildSkillsFindArgs(query: string): readonly string[] {
  return ["skills", "find", query];
}

export function deriveSkillNameFromPath(skillPath: string): string {
  const normalized = skillPath.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  const last = parts.at(-1) ?? skillPath;
  const rawName = /^(SKILL|AGENTS)\.md$/i.test(last) ? (parts.at(-2) ?? last) : last;
  const withoutDisabledSuffix = rawName.endsWith(".disabled")
    ? rawName.slice(0, -".disabled".length)
    : rawName;
  try {
    return decodeURIComponent(withoutDisabledSuffix);
  } catch {
    return withoutDisabledSuffix;
  }
}

function parseInstallCount(raw: string): number | undefined {
  const normalized = raw.trim().toUpperCase();
  const match = normalized.match(/^(\d+(?:\.\d+)?)([KM]?)$/);
  if (!match) return undefined;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return undefined;
  if (match[2] === "M") return Math.round(value * 1_000_000);
  if (match[2] === "K") return Math.round(value * 1_000);
  return Math.round(value);
}

export function parseSkillsFindOutput(output: string): CatalogSkillEntry[] {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const entries: CatalogSkillEntry[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) continue;
    const match = line.match(/^(\S+)@(\S+)\s+(\S+)\s+installs$/i);
    const packageRef = match?.[1];
    const skillName = match?.[2];
    const rawInstallCount = match?.[3];
    if (!packageRef || !skillName || !rawInstallCount) continue;

    const urlLine = lines[index + 1]?.replace(/^└\s*/, "");
    const installCount = parseInstallCount(rawInstallCount);
    entries.push({
      packageRef,
      skillName,
      ...(installCount !== undefined ? { installCount } : {}),
      ...(urlLine && /^https?:\/\//i.test(urlLine) ? { url: urlLine } : {}),
    });
  }

  return entries;
}
