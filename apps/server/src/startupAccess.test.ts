import { describe, expect, it } from "vitest";

import {
  formatHostForUrl,
  isExplicitLoopbackHost,
  isLoopbackHost,
  isLoopbackRemoteAddress,
  isSameOriginLoopbackRequest,
  isWildcardHost,
  resolveListeningPort,
} from "./startupAccess";

describe("startupAccess", () => {
  it("detects wildcard hosts", () => {
    expect(isWildcardHost("0.0.0.0")).toBe(true);
    expect(isWildcardHost("::")).toBe(true);
    expect(isWildcardHost("127.0.0.1")).toBe(false);
  });

  it("detects loopback hosts", () => {
    expect(isLoopbackHost(undefined)).toBe(true);
    expect(isLoopbackHost("localhost")).toBe(true);
    expect(isLoopbackHost("127.0.0.1")).toBe(true);
    expect(isLoopbackHost("[::1]")).toBe(true);
    expect(isLoopbackHost("0.0.0.0")).toBe(false);
    expect(isLoopbackHost("192.168.1.50")).toBe(false);
  });

  it("requires explicit loopback hosts for dev automation access", () => {
    expect(isExplicitLoopbackHost(undefined)).toBe(false);
    expect(isExplicitLoopbackHost("localhost")).toBe(true);
    expect(isExplicitLoopbackHost("127.0.0.1")).toBe(true);
    expect(isExplicitLoopbackHost("::1")).toBe(true);
    expect(isExplicitLoopbackHost("0.0.0.0")).toBe(false);
    expect(isExplicitLoopbackHost("100.88.10.4")).toBe(false);
  });

  it("detects loopback remote addresses", () => {
    expect(isLoopbackRemoteAddress("127.0.0.1")).toBe(true);
    expect(isLoopbackRemoteAddress("::1")).toBe(true);
    expect(isLoopbackRemoteAddress("::ffff:127.0.0.1")).toBe(true);
    expect(isLoopbackRemoteAddress(undefined)).toBe(false);
    expect(isLoopbackRemoteAddress("192.168.1.50")).toBe(false);
  });

  it("requires loopback host and same-origin origin when origin is present", () => {
    expect(
      isSameOriginLoopbackRequest({
        host: "127.0.0.1:3773",
        origin: "http://127.0.0.1:3773",
      }),
    ).toBe(true);
    expect(
      isSameOriginLoopbackRequest({
        host: "[::1]:3773",
        origin: "http://[::1]:3773",
      }),
    ).toBe(true);
    expect(
      isSameOriginLoopbackRequest({
        host: "127.0.0.1:3773",
        origin: undefined,
      }),
    ).toBe(true);
    expect(
      isSameOriginLoopbackRequest({
        host: "127.0.0.1:3773",
        origin: "http://localhost:3773",
      }),
    ).toBe(false);
    expect(
      isSameOriginLoopbackRequest({
        host: "100.88.10.4:3773",
        origin: "http://100.88.10.4:3773",
      }),
    ).toBe(false);
  });

  it("formats IPv6 hosts for URLs", () => {
    expect(formatHostForUrl("::1")).toBe("[::1]");
    expect(formatHostForUrl("127.0.0.1")).toBe("127.0.0.1");
  });

  it("prefers the actual bound port when an HTTP server address is available", () => {
    expect(resolveListeningPort({ port: 4123 }, 3773)).toBe(4123);
    expect(resolveListeningPort("pipe", 3773)).toBe(3773);
    expect(resolveListeningPort(null, 3773)).toBe(3773);
  });
});
