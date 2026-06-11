import type { ServerUpdateOpenClawSecretsInput } from "@jcode/contracts";
import { Effect } from "effect";

import { ServerSecretStore, type SecretStoreError } from "../auth/Services/ServerSecretStore";
import {
  clearOpenClawDeviceIdentity,
  clearOpenClawPairedToken,
  clearOpenClawPassword,
  clearOpenClawToken,
  readOpenClawSecretMetadata,
  rotateOpenClawDeviceKey,
  setOpenClawPairedToken,
  setOpenClawPassword,
  setOpenClawToken,
  type OpenClawSecretMetadata,
} from "./openclawSecrets";

export const applyOpenClawSecretUpdate = (
  input: ServerUpdateOpenClawSecretsInput,
): Effect.Effect<OpenClawSecretMetadata, SecretStoreError, ServerSecretStore> =>
  Effect.gen(function* () {
    if (input.token !== undefined) {
      yield* input.token === null ? clearOpenClawToken : setOpenClawToken(input.token);
    }
    if (input.password !== undefined) {
      yield* input.password === null ? clearOpenClawPassword : setOpenClawPassword(input.password);
    }
    if (input.clearDeviceIdentity === true) {
      yield* clearOpenClawDeviceIdentity;
    } else if (input.rotateDeviceKey === true) {
      yield* rotateOpenClawDeviceKey;
    }
    if (input.deviceToken !== undefined) {
      yield* input.deviceToken === null
        ? clearOpenClawPairedToken
        : setOpenClawPairedToken(input.deviceToken);
    }
    return yield* readOpenClawSecretMetadata;
  });
