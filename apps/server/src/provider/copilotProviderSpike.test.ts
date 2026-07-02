import assert from "node:assert/strict";

import { it } from "@effect/vitest";

import {
  COPILOT_MODEL_SOURCE_ID,
  makeCopilotModelSourceRegistryEntry,
  makeCopilotOfflineAuthMissingSnapshot,
} from "./copilotProviderSpike";

it("frames Copilot as an OpenCode-backed model source candidate", () => {
  const entry = makeCopilotModelSourceRegistryEntry();

  assert.equal(entry.sourceId, COPILOT_MODEL_SOURCE_ID);
  assert.equal(entry.hostProvider, "opencode");
  assert.equal(entry.runtimeProviderKind, null);
  assert.equal(entry.firstClassProvider, false);
  assert.deepEqual(entry.requiredFollowUps, [
    "OpenCode runtime profile or model-source capability detection",
    "Offline auth/status probe with no stored Copilot secret material",
    "Canonical provider-runtime event mapping before turn execution",
  ]);
});

it("returns typed missing-auth status and no fake models without network or secrets", () => {
  const snapshot = makeCopilotOfflineAuthMissingSnapshot({
    checkedAt: "2026-06-30T00:00:00.000Z",
  });

  assert.equal(snapshot.status.provider, "opencode");
  assert.equal(snapshot.status.status, "warning");
  assert.equal(snapshot.status.available, false);
  assert.equal(snapshot.status.authStatus, "unauthenticated");
  assert.equal(snapshot.status.authType, "github-copilot");
  assert.match(snapshot.status.message ?? "", /Copilot/i);
  assert.deepEqual(snapshot.models, []);
  assert.equal(snapshot.modelsSource, "auth-missing");
  assert.equal(snapshot.networkAccess, "disabled");
});
