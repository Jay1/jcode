import { Schema } from "effect";

import { EnvironmentId, TrimmedNonEmptyString } from "./baseSchemas";
import { ExecutionEnvironmentDescriptor } from "./environment";

export const BackendId = TrimmedNonEmptyString.pipe(Schema.brand("BackendId"));
export type BackendId = typeof BackendId.Type;

export const WslDistroName = TrimmedNonEmptyString.pipe(Schema.brand("WslDistroName"));
export type WslDistroName = typeof WslDistroName.Type;

export const BackendKind = Schema.Literals(["local", "wsl"]);
export type BackendKind = typeof BackendKind.Type;

export const BackendLifecycleState = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("unknown") }),
  Schema.Struct({ kind: Schema.Literal("probing") }),
  Schema.Struct({ kind: Schema.Literal("healthy") }),
  Schema.Struct({ kind: Schema.Literal("degraded"), reason: TrimmedNonEmptyString }),
  Schema.Struct({ kind: Schema.Literal("removed"), reason: TrimmedNonEmptyString }),
]);
export type BackendLifecycleState = typeof BackendLifecycleState.Type;

export const BackendConnection = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("local") }),
  Schema.Struct({ kind: Schema.Literal("wsl-exe"), distro: WslDistroName }),
]);
export type BackendConnection = typeof BackendConnection.Type;

const BackendBase = Schema.Struct({
  id: BackendId,
  descriptor: ExecutionEnvironmentDescriptor,
  state: BackendLifecycleState,
});

export const Backend = Schema.Union([
  Schema.Struct({
    ...BackendBase.fields,
    kind: Schema.Literal("local"),
    connection: Schema.Struct({ kind: Schema.Literal("local") }),
  }),
  Schema.Struct({
    ...BackendBase.fields,
    kind: Schema.Literal("wsl"),
    connection: Schema.Struct({ kind: Schema.Literal("wsl-exe"), distro: WslDistroName }),
  }),
]);
export type Backend = typeof Backend.Type;

export const BackendRegistry = Schema.Struct({
  host: Backend,
  backends: Schema.Array(Backend),
});
export type BackendRegistry = typeof BackendRegistry.Type;

export const ProjectBackendResolutionSource = Schema.Literals(["path", "override", "default"]);
export type ProjectBackendResolutionSource = typeof ProjectBackendResolutionSource.Type;

export const ProjectBackendResolution = Schema.Struct({
  backend: Backend,
  workspaceRoot: TrimmedNonEmptyString,
  backendPath: TrimmedNonEmptyString,
  hostPath: TrimmedNonEmptyString,
  source: ProjectBackendResolutionSource,
});
export type ProjectBackendResolution = typeof ProjectBackendResolution.Type;

export function makeBackendId(value: string): BackendId {
  return BackendId.makeUnsafe(value);
}

export function makeWslDistroName(value: string): WslDistroName {
  return WslDistroName.makeUnsafe(value);
}

export function makeBackendEnvironmentId(value: string): EnvironmentId {
  return EnvironmentId.makeUnsafe(value);
}
