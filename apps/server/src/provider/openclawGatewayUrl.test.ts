import { describe, expect, it } from "vitest";

import { normalizeOpenClawGatewayUrl, redactOpenClawGatewayUrl } from "./openclawGatewayUrl";

describe("openclawGatewayUrl", () => {
  it("normalizes HTTP(S) gateway URLs to WebSocket URLs", () => {
    expect(normalizeOpenClawGatewayUrl("http://127.0.0.1:18789").websocketUrl).toBe(
      "ws://127.0.0.1:18789/",
    );
    expect(normalizeOpenClawGatewayUrl("https://gateway.example.test/openclaw").websocketUrl).toBe(
      "wss://gateway.example.test/openclaw",
    );
  });

  it("allows insecure WebSocket only for loopback gateways by default", () => {
    expect(normalizeOpenClawGatewayUrl("ws://localhost:18789").websocketUrl).toBe(
      "ws://localhost:18789/",
    );
    expect(normalizeOpenClawGatewayUrl("ws://[::1]:18789").websocketUrl).toBe("ws://[::1]:18789/");
    expect(normalizeOpenClawGatewayUrl("ws://127.42.0.1:18789").websocketUrl).toBe(
      "ws://127.42.0.1:18789/",
    );
    expect(() => normalizeOpenClawGatewayUrl("ws://127.evil.test:18789")).toThrow(/requires wss/i);
    expect(() => normalizeOpenClawGatewayUrl("ws://gateway.example.test")).toThrow(/requires wss/i);
    expect(
      normalizeOpenClawGatewayUrl("ws://gateway.example.test", { allowInsecureRemote: true })
        .websocketUrl,
    ).toBe("ws://gateway.example.test/");
  });

  it("redacts URL userinfo, query, and fragment values", () => {
    const normalized = normalizeOpenClawGatewayUrl(
      "https://user:pass@gateway.example.test/path?token=secret#fragment",
    );

    expect(normalized.websocketUrl).toBe("wss://gateway.example.test/path");
    expect(normalized.redactedUrl).toBe("wss://gateway.example.test/path");
    expect(redactOpenClawGatewayUrl("ws://user:pass@127.0.0.1:18789/?token=secret")).toBe(
      "ws://127.0.0.1:18789/",
    );
  });

  it("redacts sensitive URL parts from rejection details", () => {
    expect(() =>
      normalizeOpenClawGatewayUrl("ws://user:pass@gateway.example.test/path?token=secret#hash"),
    ).toThrow("ws://gateway.example.test/path");
    expect(() =>
      normalizeOpenClawGatewayUrl("ws://user:pass@gateway.example.test/path?token=secret#hash"),
    ).not.toThrow(/user|pass|token=secret|hash/);
  });
});
