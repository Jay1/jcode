import { describe, expect, it } from "vitest";

import { shouldAutoRefreshThreadRecap } from "./useAutoThreadRecapRefresh";

describe("shouldAutoRefreshThreadRecap", () => {
  it("refreshes when idle and the derived source signature is new", () => {
    expect(
      shouldAutoRefreshThreadRecap({
        hasThread: true,
        hasNewMaterial: true,
        isGenerating: false,
        sessionRunning: false,
        sourceSignature: "next",
        recapSourceSignature: "previous",
      }),
    ).toBe(true);
  });

  it("does not refresh while a session is running", () => {
    expect(
      shouldAutoRefreshThreadRecap({
        hasThread: true,
        hasNewMaterial: true,
        isGenerating: false,
        sessionRunning: true,
        sourceSignature: "next",
        recapSourceSignature: "previous",
      }),
    ).toBe(false);
  });

  it("does not refresh when the source signature is already covered", () => {
    expect(
      shouldAutoRefreshThreadRecap({
        hasThread: true,
        hasNewMaterial: true,
        isGenerating: false,
        sessionRunning: false,
        sourceSignature: "same",
        recapSourceSignature: "same",
      }),
    ).toBe(false);
  });

  it("does not refresh while another recap generation is active", () => {
    expect(
      shouldAutoRefreshThreadRecap({
        hasThread: true,
        hasNewMaterial: true,
        isGenerating: true,
        sessionRunning: false,
        sourceSignature: "next",
        recapSourceSignature: "previous",
      }),
    ).toBe(false);
  });
});
