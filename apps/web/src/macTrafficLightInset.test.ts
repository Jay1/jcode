import { describe, expect, it } from "vitest";

import { resolveMacTrafficLightInset } from "./macTrafficLightInset";

describe("macOS traffic-light inset", () => {
  it.each([
    { kind: "titlebar", expected: 90 },
    { kind: "collapsed-sidebar-trigger", expected: 76 },
  ] as const)("keeps the $expected px $kind inset only in a windowed Mac desktop", (testCase) => {
    expect(
      resolveMacTrafficLightInset({
        kind: testCase.kind,
        isElectron: true,
        isMac: true,
        isFullscreen: false,
      }),
    ).toBe(testCase.expected);
  });

  it.each([
    { isElectron: false, isMac: true, isFullscreen: false },
    { isElectron: true, isMac: false, isFullscreen: false },
    { isElectron: true, isMac: true, isFullscreen: true },
  ])(
    "returns no inset outside a windowed Mac desktop: $isElectron/$isMac/$isFullscreen",
    (input) => {
      expect(resolveMacTrafficLightInset({ kind: "titlebar", ...input })).toBe(0);
      expect(resolveMacTrafficLightInset({ kind: "collapsed-sidebar-trigger", ...input })).toBe(0);
    },
  );
});
