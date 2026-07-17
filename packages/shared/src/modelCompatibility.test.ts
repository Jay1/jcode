import { describe, expect, it } from "vitest";

import { resolveModelCompatibility } from "./modelCompatibility";

describe("resolveModelCompatibility", () => {
  it("disables Sonnet 5 when a known Claude Code version is below the support floor", () => {
    expect(
      resolveModelCompatibility({
        provider: "claudeAgent",
        model: "claude-sonnet-5",
        providerVersion: "2.1.196",
      }),
    ).toEqual({
      selectable: false,
      reason: "Update Claude Code to 2.1.197 or newer to use Claude Sonnet 5.",
    });
  });

  it("keeps Sonnet 5 selectable at and above the support floor", () => {
    expect(
      resolveModelCompatibility({
        provider: "claudeAgent",
        model: "claude-sonnet-5",
        providerVersion: "2.1.197",
      }),
    ).toEqual({ selectable: true });
    expect(
      resolveModelCompatibility({
        provider: "claudeAgent",
        model: "claude-sonnet-5",
        providerVersion: "2.2.0",
      }),
    ).toEqual({ selectable: true });
  });

  it("handles release prefixes, prereleases, and build metadata at the support floor", () => {
    expect(
      resolveModelCompatibility({
        provider: "claudeAgent",
        model: "claude-sonnet-5",
        providerVersion: "v2.1.197+local.1",
      }),
    ).toEqual({ selectable: true });
    expect(
      resolveModelCompatibility({
        provider: "claudeAgent",
        model: "claude-sonnet-5",
        providerVersion: "2.1.197-beta.1",
      }),
    ).toEqual({
      selectable: false,
      reason: "Update Claude Code to 2.1.197 or newer to use Claude Sonnet 5.",
    });
    expect(
      resolveModelCompatibility({
        provider: "claudeAgent",
        model: "claude-sonnet-5",
        providerVersion: "2.1.198-beta.1",
      }),
    ).toEqual({ selectable: true });
    expect(
      resolveModelCompatibility({
        provider: "claudeAgent",
        model: "claude-sonnet-5",
        providerVersion: "2.1.196+001",
      }),
    ).toEqual({
      selectable: false,
      reason: "Update Claude Code to 2.1.197 or newer to use Claude Sonnet 5.",
    });
  });

  it.each([
    "2.1.197-alpha..1",
    "2.1.197-.",
    "02.1.196",
    "2.01.196",
    "2.1.0196",
    "2.1.197-01",
    "2.1.197-alpha.01",
    "2.1.196+build..1",
    "2.1.196+.build",
    "2.1.196+build.",
    "2.1.196+build_1",
    "2.1.196+",
    " 2.1.196",
    "2.1.196 ",
    `${"0".repeat(400)}.0.0`,
  ])("fails open for malformed provider version %s", (providerVersion) => {
    expect(
      resolveModelCompatibility({
        provider: "claudeAgent",
        model: "claude-sonnet-5",
        providerVersion,
      }),
    ).toEqual({ selectable: true });
  });

  it("accepts and safely orders arbitrarily large valid core identifiers", () => {
    expect(
      resolveModelCompatibility({
        provider: "claudeAgent",
        model: "claude-sonnet-5",
        providerVersion: `${"9".repeat(400)}.0.0`,
      }),
    ).toEqual({ selectable: true });
  });

  it("keeps unknown and unparseable provider versions selectable", () => {
    expect(
      resolveModelCompatibility({
        provider: "claudeAgent",
        model: "claude-sonnet-5",
        providerVersion: null,
      }),
    ).toEqual({ selectable: true });
    expect(
      resolveModelCompatibility({
        provider: "claudeAgent",
        model: "claude-sonnet-5",
        providerVersion: "development-build",
      }),
    ).toEqual({ selectable: true });
  });

  it("does not apply the Sonnet 5 version policy to other models", () => {
    expect(
      resolveModelCompatibility({
        provider: "claudeAgent",
        model: "claude-sonnet-4-6",
        providerVersion: "2.1.196",
      }),
    ).toEqual({ selectable: true });
  });
});
