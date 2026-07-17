import type { ProviderKind } from "@jcode/contracts";

import { getModelCapabilities, normalizeModelSlug } from "./model";

export type ModelCompatibility =
  | { readonly selectable: true }
  | { readonly selectable: false; readonly reason: string };

export type ModelCompatibilityInput = {
  readonly provider: ProviderKind;
  readonly model: string;
  readonly providerVersion: string | null | undefined;
};

type ParsedProviderVersion = {
  readonly major: string;
  readonly minor: string;
  readonly patch: string;
  readonly prerelease: boolean;
};

const PROVIDER_VERSION_PATTERN =
  /^v?(?<major>0|[1-9]\d*)\.(?<minor>0|[1-9]\d*)\.(?<patch>0|[1-9]\d*)(?:-(?<prerelease>[0-9A-Za-z.-]+))?(?:\+(?<build>[0-9A-Za-z.-]+))?$/u;
const VERSION_IDENTIFIER_PATTERN = /^[0-9A-Za-z-]+$/u;
const NUMERIC_IDENTIFIER_PATTERN = /^\d+$/u;

function hasValidIdentifiers(value: string | undefined, rejectLeadingZero: boolean): boolean {
  if (value === undefined) return true;
  return value.split(".").every((identifier) => {
    if (!VERSION_IDENTIFIER_PATTERN.test(identifier)) return false;
    return !(
      rejectLeadingZero &&
      identifier.length > 1 &&
      identifier.startsWith("0") &&
      NUMERIC_IDENTIFIER_PATTERN.test(identifier)
    );
  });
}

function parseProviderVersion(value: string | null | undefined): ParsedProviderVersion | null {
  const groups = typeof value === "string" ? PROVIDER_VERSION_PATTERN.exec(value)?.groups : null;
  const major = groups?.["major"];
  const minor = groups?.["minor"];
  const patch = groups?.["patch"];
  if (major === undefined || minor === undefined || patch === undefined) {
    return null;
  }
  if (
    !hasValidIdentifiers(groups?.["prerelease"], true) ||
    !hasValidIdentifiers(groups?.["build"], false)
  ) {
    return null;
  }

  return {
    major,
    minor,
    patch,
    prerelease: groups?.["prerelease"] !== undefined,
  };
}

function compareNumericIdentifier(left: string, right: string): number {
  if (left.length !== right.length) return left.length < right.length ? -1 : 1;
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function isVersionBelow(current: ParsedProviderVersion, minimum: ParsedProviderVersion): boolean {
  const majorComparison = compareNumericIdentifier(current.major, minimum.major);
  if (majorComparison !== 0) return majorComparison < 0;
  const minorComparison = compareNumericIdentifier(current.minor, minimum.minor);
  if (minorComparison !== 0) return minorComparison < 0;
  const patchComparison = compareNumericIdentifier(current.patch, minimum.patch);
  if (patchComparison !== 0) return patchComparison < 0;
  return current.prerelease && !minimum.prerelease;
}

export function resolveModelCompatibility(input: ModelCompatibilityInput): ModelCompatibility {
  const model = normalizeModelSlug(input.model, input.provider);
  const minimumProviderVersion = getModelCapabilities(input.provider, model).minimumProviderVersion;
  if (model !== "claude-sonnet-5" || minimumProviderVersion === undefined) {
    return { selectable: true };
  }

  const current = parseProviderVersion(input.providerVersion);
  const minimum = parseProviderVersion(minimumProviderVersion);
  if (current === null || minimum === null || !isVersionBelow(current, minimum)) {
    return { selectable: true };
  }

  return {
    selectable: false,
    reason: `Update Claude Code to ${minimumProviderVersion} or newer to use Claude Sonnet 5.`,
  };
}
