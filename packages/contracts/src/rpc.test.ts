import { describe, expect, it } from "vitest";
import { Schema } from "effect";

import {
  WsProviderBootstrapRuntimeRpc,
  WsProviderGetRuntimeBootstrapStatusRpc,
  WsProviderRepairRuntimeRpc,
  WsRpcError,
  WsRpcGroup,
} from "./rpc";
import { WS_METHODS } from "./ws";
import { ProviderRuntimeBootstrapSnapshot } from "./providerDiscovery";

describe("WS RPC contracts", () => {
  it("exports the additive Effect RPC group", () => {
    expect(WsRpcGroup).toBeDefined();
  });

  it("uses a schema-backed transport error", () => {
    expect(new WsRpcError({ message: "failed" }).message).toBe("failed");
  });

  it("exports provider runtime bootstrap RPC methods", () => {
    expect(WsProviderGetRuntimeBootstrapStatusRpc.key).toBe(
      `effect/rpc/Rpc/${WS_METHODS.providerGetRuntimeBootstrapStatus}`,
    );
    expect(WsProviderBootstrapRuntimeRpc.key).toBe(
      `effect/rpc/Rpc/${WS_METHODS.providerBootstrapRuntime}`,
    );
    expect(WsProviderRepairRuntimeRpc.key).toBe(
      `effect/rpc/Rpc/${WS_METHODS.providerRepairRuntime}`,
    );
  });

  it("includes provider runtime bootstrap RPC methods in the group", () => {
    expect(WsRpcGroup.requests.get(WS_METHODS.providerGetRuntimeBootstrapStatus)).toBe(
      WsProviderGetRuntimeBootstrapStatusRpc,
    );
    expect(WsRpcGroup.requests.get(WS_METHODS.providerBootstrapRuntime)).toBe(
      WsProviderBootstrapRuntimeRpc,
    );
    expect(WsRpcGroup.requests.get(WS_METHODS.providerRepairRuntime)).toBe(
      WsProviderRepairRuntimeRpc,
    );
  });

  it("accepts provider runtime bootstrap snapshots with custom service names", () => {
    const decoded = Schema.decodeUnknownSync(ProviderRuntimeBootstrapSnapshot)({
      provider: "opencode",
      lane: "wsl-service",
      state: "error",
      serviceName: "jcode-opencode-dev.service",
      checkedAt: "2026-06-11T12:00:00.000Z",
    });

    expect(decoded.serviceName).toBe("jcode-opencode-dev.service");
  });

  it("preserves typed voice transcription auth-expired details", () => {
    const decoded = Schema.decodeUnknownSync(WsRpcError)({
      _tag: "WsRpcError",
      message: "Voice transcription failed",
      detail: {
        kind: "server.voice-transcription",
        code: "auth-expired",
      },
    });

    expect(decoded.detail).toEqual({
      kind: "server.voice-transcription",
      code: "auth-expired",
    });
  });
});
