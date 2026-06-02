import { describe, expect, it } from "vitest";
import { Schema } from "effect";

import { WsRpcError, WsRpcGroup } from "./rpc";

describe("WS RPC contracts", () => {
  it("exports the additive Effect RPC group", () => {
    expect(WsRpcGroup).toBeDefined();
  });

  it("uses a schema-backed transport error", () => {
    expect(new WsRpcError({ message: "failed" }).message).toBe("failed");
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
