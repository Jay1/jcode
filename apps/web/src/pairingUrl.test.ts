import { describe, expect, it } from "vitest";

import {
  getPairingTokenFromUrl,
  setPairingTokenOnUrl,
  stripPairingTokenFromUrl,
} from "./pairingUrl";

describe("pairingUrl", () => {
  it("reads pairing tokens from the hash before the query string", () => {
    const url = new URL("https://app.example.com/pair?token=query-token#token=hash-token");

    expect(getPairingTokenFromUrl(url)).toBe("hash-token");
  });

  it("falls back to query-string tokens for older pairing URLs", () => {
    const url = new URL("https://app.example.com/pair?token=query-token");

    expect(getPairingTokenFromUrl(url)).toBe("query-token");
  });

  it("strips pairing tokens from both hash and query string", () => {
    const url = new URL("https://app.example.com/pair?token=query-token&x=1#token=hash-token&y=2");

    const stripped = stripPairingTokenFromUrl(url);

    expect(stripped.toString()).toBe("https://app.example.com/pair?x=1#y=2");
  });

  it("sets generated pairing tokens in the hash", () => {
    const url = new URL("https://app.example.com/pair?token=old-token&x=1");

    const next = setPairingTokenOnUrl(url, "new-token");

    expect(next.toString()).toBe("https://app.example.com/pair?x=1#token=new-token");
  });

  it("accepts string URLs for route and settings callers", () => {
    const url = "https://app.example.com/pair?token=query-token#token=hash-token";

    expect(getPairingTokenFromUrl(url)).toBe("hash-token");
    expect(stripPairingTokenFromUrl(url).toString()).toBe("https://app.example.com/pair");
    expect(setPairingTokenOnUrl("https://app.example.com/pair", "new-token").toString()).toBe(
      "https://app.example.com/pair#token=new-token",
    );
  });
});
