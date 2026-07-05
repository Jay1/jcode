import type { ProviderListSkillsResult } from "@jcode/contracts";

import type { OpenCodeInventory } from "../opencodeRuntime.ts";

type OpenCodeSkillDescriptor = ProviderListSkillsResult["skills"][number];

const BUILT_IN_SKILL_UNINSTALL_REASON = "Built-in skills cannot be uninstalled.";
const VIRTUAL_SKILL_UNINSTALL_REASON = "Provider did not report a filesystem skill location.";

function trimNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isPlainRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readFirstNonEmptyString(
  record: Readonly<Record<string, unknown>> | undefined,
  keys: readonly string[],
): string | undefined {
  if (!record) return undefined;
  for (const key of keys) {
    const value = trimNonEmptyString(record[key]);
    if (value) return value;
  }
  return undefined;
}

function readOpenCodeSkillLocation(
  record: Readonly<Record<string, unknown>> | undefined,
): string | undefined {
  const directPath = readFirstNonEmptyString(record, ["path", "file", "filename", "location"]);
  if (directPath) return directPath;
  const source = record?.source;
  return readFirstNonEmptyString(isPlainRecord(source) ? source : undefined, [
    "path",
    "file",
    "filename",
    "location",
  ]);
}

function openCodeSkillProviderUri(name: string): string {
  return `opencode://skill/${encodeURIComponent(name)}`;
}

function isOpenCodeBuiltinSkillLocation(location: string | undefined): boolean {
  return location === "<built-in>" || location?.startsWith("/builtin/") === true;
}

function resolveOpenCodeSkillIdentity(input: {
  readonly name: string;
  readonly location?: string;
}): Pick<OpenCodeSkillDescriptor, "actions" | "path" | "source"> {
  if (isOpenCodeBuiltinSkillLocation(input.location)) {
    return {
      path: openCodeSkillProviderUri(input.name),
      source: {
        origin: "builtin",
        ...(input.location ? { location: input.location } : {}),
      },
      actions: {
        uninstall: { available: false, reason: BUILT_IN_SKILL_UNINSTALL_REASON },
      },
    };
  }

  if (input.location) {
    return {
      path: input.location,
      source: {
        origin: "filesystem",
        location: input.location,
      },
      actions: {
        uninstall: { available: true },
      },
    };
  }

  return {
    path: openCodeSkillProviderUri(input.name),
    source: {
      origin: "virtual",
    },
    actions: {
      uninstall: { available: false, reason: VIRTUAL_SKILL_UNINSTALL_REASON },
    },
  };
}

function readOpenCodeSkillEnabled(record: Readonly<Record<string, unknown>> | undefined): boolean {
  if (record?.enabled === false || record?.disabled === true) {
    return false;
  }
  return true;
}

export function normalizeOpenCodeSkillDescriptor(
  value: unknown,
  fallbackName?: string,
): OpenCodeSkillDescriptor | undefined {
  if (typeof value === "boolean" || value == null) {
    return undefined;
  }

  if (typeof value === "string") {
    const name = trimNonEmptyString(value);
    return name ? { name, ...resolveOpenCodeSkillIdentity({ name }), enabled: true } : undefined;
  }

  if (!isPlainRecord(value)) return undefined;
  const interfaceRecord = isPlainRecord(value.interface) ? value.interface : undefined;
  const name =
    readFirstNonEmptyString(value, ["name", "id", "key"]) ?? trimNonEmptyString(fallbackName);
  if (!name) return undefined;

  const description = readFirstNonEmptyString(value, [
    "description",
    "shortDescription",
    "summary",
  ]);
  const displayName =
    readFirstNonEmptyString(interfaceRecord, ["displayName"]) ??
    readFirstNonEmptyString(value, ["displayName", "title"]);
  const shortDescription =
    readFirstNonEmptyString(interfaceRecord, ["shortDescription"]) ??
    readFirstNonEmptyString(value, ["shortDescription", "summary"]);
  const skillInterface =
    displayName || shortDescription || description
      ? {
          ...(displayName ? { displayName } : {}),
          ...((shortDescription ?? description)
            ? { shortDescription: shortDescription ?? description }
            : {}),
        }
      : undefined;
  const scope = readFirstNonEmptyString(value, ["scope"]);
  const location = readOpenCodeSkillLocation(value);
  const identity = resolveOpenCodeSkillIdentity({
    name,
    ...(location ? { location } : {}),
  });

  return {
    name,
    ...identity,
    enabled: readOpenCodeSkillEnabled(value),
    ...(description ? { description } : {}),
    ...(scope ? { scope } : {}),
    ...(skillInterface ? { interface: skillInterface } : {}),
  };
}

export function normalizeOpenCodeSkillDescriptors(
  inventory: OpenCodeInventory,
): OpenCodeSkillDescriptor[] {
  const consoleState = isPlainRecord(inventory.consoleState) ? inventory.consoleState : undefined;
  const visited = new Set<unknown>();
  const descriptors: OpenCodeSkillDescriptor[] = [];

  const collectSkills = (value: unknown) => {
    if (!value || visited.has(value)) return;
    if (typeof value === "object") visited.add(value);

    if (Array.isArray(value)) {
      for (const item of value) collectSkills(item);
      return;
    }

    if (!isPlainRecord(value)) return;

    for (const [key, child] of Object.entries(value)) {
      if (key === "skills") {
        descriptors.push(...normalizeOpenCodeSkillCollection(child));
      }
      collectSkills(child);
    }
  };

  collectSkills(consoleState);
  return descriptors;
}

function normalizeOpenCodeSkillCollection(skills: unknown): OpenCodeSkillDescriptor[] {
  if (Array.isArray(skills)) {
    return skills.flatMap((skill) => {
      const descriptor = normalizeOpenCodeSkillDescriptor(skill);
      return descriptor ? [descriptor] : [];
    });
  }

  if (!isPlainRecord(skills)) return [];
  return Object.entries(skills).flatMap(([key, value]) => {
    const descriptor = normalizeOpenCodeSkillDescriptor(value, key);
    return descriptor ? [descriptor] : [];
  });
}
