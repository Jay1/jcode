import { describe, expect, it } from "vitest";

import { resolveRemotePairingTarget } from "./remotePairingTarget";

describe("resolveRemotePairingTarget", () => {
  it("normalizes separate host and code fields into HTTP and WebSocket base URLs", () => {
    expect(
      resolveRemotePairingTarget({
        host: "backend.example.com",
        pairingCode: "PAIRCODE",
      }),
    ).toEqual({
      credential: "PAIRCODE",
      httpBaseUrl: "https://backend.example.com/",
      wsBaseUrl: "wss://backend.example.com/",
    });
  });

  it("accepts full backend pairing URLs", () => {
    expect(
      resolveRemotePairingTarget({
        pairingUrl: "http://127.0.0.1:3773/pair#token=ABC123",
      }),
    ).toEqual({
      credential: "ABC123",
      httpBaseUrl: "http://127.0.0.1:3773/",
      wsBaseUrl: "ws://127.0.0.1:3773/",
    });
  });

  it("accepts hosted pairing URLs with host and hash token", () => {
    expect(
      resolveRemotePairingTarget({
        pairingUrl: "https://app.t3.codes/pair?host=100.64.1.2:3773#token=ABC123",
      }),
    ).toEqual({
      credential: "ABC123",
      httpBaseUrl: "https://100.64.1.2:3773/",
      wsBaseUrl: "wss://100.64.1.2:3773/",
    });
  });

  it("rejects URLs without a pairing token", () => {
    expect(() =>
      resolveRemotePairingTarget({
        pairingUrl: "https://backend.example.com/pair",
      }),
    ).toThrow("Pairing URL is missing its token.");
  });
});
