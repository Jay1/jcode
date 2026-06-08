import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";

import { ServerSecretStore, type SecretStoreError } from "../auth/Services/ServerSecretStore";
import { ServerSecretStoreLive } from "../auth/Layers/ServerSecretStore";
import { ServerConfig } from "../config";
import { applyOpenClawSecretUpdate } from "./openclawSecretUpdate";
import {
  OPENCLAW_SECRET_NAMES,
  clearOpenClawAuthSecrets,
  clearOpenClawDeviceIdentity,
  clearOpenClawPairedToken,
  deriveOpenClawDeviceId,
  getOpenClawSecretBytes,
  getOpenClawSecret,
  readOpenClawSecretMetadata,
  rotateOpenClawDeviceKey,
  setOpenClawPassword,
  setOpenClawPairedToken,
  setOpenClawToken,
} from "./openclawSecrets";

const makeLayer = () =>
  ServerSecretStoreLive.pipe(
    Layer.provide(
      ServerConfig.layerTest(process.cwd(), {
        prefix: "jcode-openclaw-secrets-test-",
      }),
    ),
    Layer.provide(NodeServices.layer),
  );

const runWithSecretStore = (effect: Effect.Effect<void, SecretStoreError, ServerSecretStore>) =>
  effect.pipe(Effect.provide(makeLayer()), Effect.scoped, Effect.runPromise);

describe("openclawSecrets", () => {
  it("stores text secrets as UTF-8 bytes under deterministic names", async () => {
    await runWithSecretStore(
      Effect.gen(function* () {
        const store = yield* ServerSecretStore;
        yield* setOpenClawToken("token-secret");
        yield* setOpenClawPassword("pass-✓");

        expect(Array.from((yield* store.get(OPENCLAW_SECRET_NAMES.token)) ?? [])).toEqual(
          Array.from(new TextEncoder().encode("token-secret")),
        );
        expect(Array.from((yield* store.get(OPENCLAW_SECRET_NAMES.password)) ?? [])).toEqual(
          Array.from(new TextEncoder().encode("pass-✓")),
        );
      }),
    );
  });

  it("stores auth secrets while exposing only redacted metadata", async () => {
    await runWithSecretStore(
      Effect.gen(function* () {
        yield* setOpenClawToken("token-secret");
        yield* setOpenClawPassword("password-secret");

        const metadata = yield* readOpenClawSecretMetadata;

        expect(metadata).toEqual({
          hasToken: true,
          hasPassword: true,
          hasDeviceKey: false,
          hasDeviceToken: false,
          paired: false,
        });
        expect(Object.values(metadata)).not.toContain("token-secret");
        expect(yield* getOpenClawSecret("token")).toBe("token-secret");
      }),
    );
  });

  it("clears token and password secrets without touching device identity", async () => {
    await runWithSecretStore(
      Effect.gen(function* () {
        yield* setOpenClawToken("token-secret");
        yield* setOpenClawPassword("password-secret");
        yield* rotateOpenClawDeviceKey;
        yield* clearOpenClawAuthSecrets;

        const metadata = yield* readOpenClawSecretMetadata;

        expect(metadata.hasToken).toBe(false);
        expect(metadata.hasPassword).toBe(false);
        expect(metadata.hasDeviceKey).toBe(true);
      }),
    );
  });

  it("rotates and clears device identity plus stale paired tokens", async () => {
    await runWithSecretStore(
      Effect.gen(function* () {
        const firstKey = yield* rotateOpenClawDeviceKey;
        yield* setOpenClawPairedToken("paired-token");
        const secondKey = yield* rotateOpenClawDeviceKey;

        let metadata = yield* readOpenClawSecretMetadata;
        expect(Array.from(secondKey)).not.toEqual(Array.from(firstKey));
        expect(metadata.hasDeviceKey).toBe(true);
        expect(metadata.hasDeviceToken).toBe(false);
        expect(metadata.paired).toBe(false);

        yield* setOpenClawPairedToken("paired-token");
        yield* clearOpenClawPairedToken;
        metadata = yield* readOpenClawSecretMetadata;
        expect(metadata.hasDeviceToken).toBe(false);
        expect(metadata.paired).toBe(false);

        yield* clearOpenClawDeviceIdentity;
        metadata = yield* readOpenClawSecretMetadata;
        expect(metadata.hasDeviceKey).toBe(false);
        expect(metadata.hasDeviceToken).toBe(false);
      }),
    );
  });

  it("reads device keys as binary bytes and derives a stable non-secret device id", async () => {
    await runWithSecretStore(
      Effect.gen(function* () {
        const key = yield* rotateOpenClawDeviceKey;
        const storedKey = yield* getOpenClawSecretBytes("deviceKey");

        expect(storedKey).not.toBeNull();
        expect(Array.from(storedKey ?? [])).toEqual(Array.from(key));
        expect(yield* getOpenClawSecret("deviceKey")).not.toBe(deriveOpenClawDeviceId(key));
        expect(deriveOpenClawDeviceId(key)).toBe(deriveOpenClawDeviceId(key));
      }),
    );
  });

  it("applies secret updates while returning only metadata", async () => {
    await runWithSecretStore(
      Effect.gen(function* () {
        let metadata = yield* applyOpenClawSecretUpdate({
          token: "token-secret",
          password: "password-secret",
          rotateDeviceKey: true,
          deviceToken: "paired-token",
        });

        expect(metadata).toEqual({
          hasToken: true,
          hasPassword: true,
          hasDeviceKey: true,
          hasDeviceToken: true,
          paired: true,
        });
        expect(Object.values(metadata)).not.toContain("token-secret");
        expect(yield* getOpenClawSecret("token")).toBe("token-secret");
        expect(yield* getOpenClawSecret("password")).toBe("password-secret");

        metadata = yield* applyOpenClawSecretUpdate({
          token: null,
          password: null,
          clearDeviceIdentity: true,
        });

        expect(metadata).toEqual({
          hasToken: false,
          hasPassword: false,
          hasDeviceKey: false,
          hasDeviceToken: false,
          paired: false,
        });
      }),
    );
  });
});
