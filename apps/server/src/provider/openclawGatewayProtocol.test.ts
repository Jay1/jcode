import { describe, expect, it } from "vitest";

import {
  OPENCLAW_CLIENT_DISPLAY_NAME,
  OPENCLAW_CLIENT_ID,
  OPENCLAW_CLIENT_MODE,
  OPENCLAW_MAX_PROTOCOL_VERSION,
  OPENCLAW_MIN_PROTOCOL_VERSION,
  OPENCLAW_REQUIRED_METHODS,
  OPENCLAW_SCOPES,
  buildOpenClawAbortRequest,
  buildOpenClawChallengeResponse,
  buildOpenClawConnectFrame,
  isOpenClawAuthFailureFrame,
  buildOpenClawHistoryRequest,
  buildOpenClawSendRequest,
  deriveOpenClawIdempotencyKey,
  validateOpenClawMethodSupport,
  waitForOpenClawChallenge,
} from "./openclawGatewayProtocol";

describe("openclawGatewayProtocol", () => {
  it("builds the canonical backend operator connect frame", () => {
    expect(buildOpenClawConnectFrame({ auth: { type: "token", token: "secret" } })).toEqual({
      type: "connect",
      minProtocol: OPENCLAW_MIN_PROTOCOL_VERSION,
      maxProtocol: OPENCLAW_MAX_PROTOCOL_VERSION,
      client: {
        id: OPENCLAW_CLIENT_ID,
        mode: OPENCLAW_CLIENT_MODE,
        displayName: OPENCLAW_CLIENT_DISPLAY_NAME,
      },
      role: "operator",
      scopes: OPENCLAW_SCOPES,
      auth: { type: "token", token: "secret" },
    });
  });

  it("creates deterministic challenge responses bound to nonce, timestamp, and client id", () => {
    const response = buildOpenClawChallengeResponse({
      challenge: { nonce: "nonce-1", timestamp: "2026-06-05T00:00:00.000Z" },
      deviceId: "device-1",
      deviceKey: new Uint8Array([1, 2, 3, 4]),
    });

    expect(response).toEqual({
      type: "connect.challenge-response",
      clientId: OPENCLAW_CLIENT_ID,
      deviceId: "device-1",
      nonce: "nonce-1",
      timestamp: "2026-06-05T00:00:00.000Z",
      signature: expect.any(String),
    });
    expect(response.signature).toBe(
      buildOpenClawChallengeResponse({
        challenge: { nonce: "nonce-1", timestamp: "2026-06-05T00:00:00.000Z" },
        deviceId: "device-1",
        deviceKey: new Uint8Array([1, 2, 3, 4]),
      }).signature,
    );
    expect(response.signature).not.toBe(
      buildOpenClawChallengeResponse({
        challenge: { nonce: "nonce-2", timestamp: "2026-06-05T00:00:00.000Z" },
        deviceId: "device-1",
        deviceKey: new Uint8Array([1, 2, 3, 4]),
      }).signature,
    );
  });

  it("waits for connect.challenge and times out with redacted details", async () => {
    await expect(
      waitForOpenClawChallenge({
        receive: () =>
          Promise.resolve({
            type: "connect.challenge",
            nonce: "nonce-1",
            timestamp: "2026-06-05T00:00:00.000Z",
          }),
        timeoutMs: 50,
        redactedGatewayUrl: "wss://gateway.example.test/path",
      }),
    ).resolves.toEqual({ nonce: "nonce-1", timestamp: "2026-06-05T00:00:00.000Z" });

    await expect(
      waitForOpenClawChallenge({
        receive: () => new Promise(() => undefined),
        timeoutMs: 1,
        redactedGatewayUrl: "wss://gateway.example.test/path",
      }),
    ).rejects.toThrow("wss://gateway.example.test/path");
    await expect(
      waitForOpenClawChallenge({
        receive: () => new Promise(() => undefined),
        timeoutMs: 1,
        redactedGatewayUrl: "wss://gateway.example.test/path?token=secret",
      }),
    ).rejects.not.toThrow(/token=secret/);
  });

  it("identifies auth failure frames that require paired-token clearing", () => {
    expect(isOpenClawAuthFailureFrame({ type: "connect.error", code: "unauthorized" })).toBe(true);
    expect(isOpenClawAuthFailureFrame({ type: "error", message: "authentication failed" })).toBe(
      true,
    );
    expect(isOpenClawAuthFailureFrame({ type: "error", message: "network unavailable" })).toBe(
      false,
    );
  });

  it("validates required gateway chat methods while allowing absent method lists for probing", () => {
    expect(validateOpenClawMethodSupport(undefined)).toEqual({ supported: true, missing: [] });
    expect(validateOpenClawMethodSupport([...OPENCLAW_REQUIRED_METHODS, "other.method"])).toEqual({
      supported: true,
      missing: [],
    });
    expect(validateOpenClawMethodSupport(["chat.history", "chat.send"])).toEqual({
      supported: false,
      missing: ["chat.abort"],
    });
  });

  it("builds chat request payloads with stable session and idempotency keys", () => {
    expect(buildOpenClawHistoryRequest({ sessionKey: "jcode:thread-1" })).toEqual({
      method: "chat.history",
      params: { sessionKey: "jcode:thread-1" },
    });
    expect(deriveOpenClawIdempotencyKey({ threadId: "thread-1", turnId: "turn-1" })).toBe(
      "jcode:thread-1:turn-1",
    );
    expect(
      buildOpenClawSendRequest({
        sessionKey: "jcode:thread-1",
        threadId: "thread-1",
        turnId: "turn-1",
        message: "hello",
      }),
    ).toEqual({
      method: "chat.send",
      params: {
        sessionKey: "jcode:thread-1",
        message: "hello",
        idempotencyKey: "jcode:thread-1:turn-1",
      },
    });
    expect(buildOpenClawAbortRequest({ sessionKey: "jcode:thread-1", runId: "run-1" })).toEqual({
      method: "chat.abort",
      params: { sessionKey: "jcode:thread-1", runId: "run-1" },
    });
  });
});
