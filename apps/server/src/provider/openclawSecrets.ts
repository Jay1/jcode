import * as Crypto from "node:crypto";

import { Effect } from "effect";

import { ServerSecretStore, type SecretStoreError } from "../auth/Services/ServerSecretStore";

export const OPENCLAW_SECRET_NAMES = {
  token: "provider.openclaw.token",
  password: "provider.openclaw.password",
  deviceKey: "provider.openclaw.device-key",
  deviceToken: "provider.openclaw.device-token",
} as const;

export type OpenClawSecretKind = keyof typeof OPENCLAW_SECRET_NAMES;

export interface OpenClawSecretMetadata {
  readonly hasToken: boolean;
  readonly hasPassword: boolean;
  readonly hasDeviceKey: boolean;
  readonly hasDeviceToken: boolean;
  readonly paired: boolean;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function encodeSecret(value: string): Uint8Array {
  return textEncoder.encode(value);
}

function decodeSecret(value: Uint8Array): string {
  return textDecoder.decode(value);
}

export const getOpenClawSecret = (
  kind: OpenClawSecretKind,
): Effect.Effect<string | null, SecretStoreError, ServerSecretStore> =>
  Effect.gen(function* () {
    const store = yield* ServerSecretStore;
    const value = yield* store.get(OPENCLAW_SECRET_NAMES[kind]);
    return value ? decodeSecret(value) : null;
  });

export const getOpenClawSecretBytes = (
  kind: OpenClawSecretKind,
): Effect.Effect<Uint8Array | null, SecretStoreError, ServerSecretStore> =>
  Effect.gen(function* () {
    const store = yield* ServerSecretStore;
    return yield* store.get(OPENCLAW_SECRET_NAMES[kind]);
  });

export function deriveOpenClawDeviceId(deviceKey: Uint8Array): string {
  const digest = Crypto.createHash("sha256").update(deviceKey).digest("base64url");
  return `jcode:${digest}`;
}

const setOpenClawTextSecret = (kind: OpenClawSecretKind, value: string) =>
  Effect.gen(function* () {
    const store = yield* ServerSecretStore;
    yield* store.set(OPENCLAW_SECRET_NAMES[kind], encodeSecret(value));
  });

const removeOpenClawSecret = (kind: OpenClawSecretKind) =>
  Effect.gen(function* () {
    const store = yield* ServerSecretStore;
    yield* store.remove(OPENCLAW_SECRET_NAMES[kind]);
  });

export const setOpenClawToken = (value: string) => setOpenClawTextSecret("token", value);

export const setOpenClawPassword = (value: string) => setOpenClawTextSecret("password", value);

export const clearOpenClawToken = removeOpenClawSecret("token");

export const clearOpenClawPassword = removeOpenClawSecret("password");

export const setOpenClawPairedToken = (value: string) =>
  setOpenClawTextSecret("deviceToken", value);

export const clearOpenClawAuthSecrets = Effect.all([
  clearOpenClawToken,
  clearOpenClawPassword,
]).pipe(Effect.asVoid);

export const clearOpenClawPairedToken = removeOpenClawSecret("deviceToken");

export const clearOpenClawDeviceIdentity = Effect.all([
  removeOpenClawSecret("deviceKey"),
  removeOpenClawSecret("deviceToken"),
]).pipe(Effect.asVoid);

export const rotateOpenClawDeviceKey: Effect.Effect<
  Uint8Array,
  SecretStoreError,
  ServerSecretStore
> = Effect.gen(function* () {
  const store = yield* ServerSecretStore;
  const key = Uint8Array.from(Crypto.randomBytes(32));
  yield* store.set(OPENCLAW_SECRET_NAMES.deviceKey, key);
  yield* store.remove(OPENCLAW_SECRET_NAMES.deviceToken);
  return key;
});

export const readOpenClawSecretMetadata: Effect.Effect<
  OpenClawSecretMetadata,
  SecretStoreError,
  ServerSecretStore
> = Effect.gen(function* () {
  const store = yield* ServerSecretStore;
  const token = yield* store.get(OPENCLAW_SECRET_NAMES.token);
  const password = yield* store.get(OPENCLAW_SECRET_NAMES.password);
  const deviceKey = yield* store.get(OPENCLAW_SECRET_NAMES.deviceKey);
  const deviceToken = yield* store.get(OPENCLAW_SECRET_NAMES.deviceToken);
  return {
    hasToken: token !== null,
    hasPassword: password !== null,
    hasDeviceKey: deviceKey !== null,
    hasDeviceToken: deviceToken !== null,
    paired: deviceToken !== null,
  };
});
