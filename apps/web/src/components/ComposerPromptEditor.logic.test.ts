import { describe, expect, it } from "vitest";

import { shouldConsumeComposerEnterDuringComposition } from "./ComposerPromptEditor";

describe("composer prompt keyboard composition", () => {
  it("consumes Enter while an IME composition is active", () => {
    expect(
      shouldConsumeComposerEnterDuringComposition("Enter", {
        isComposing: true,
        keyCode: 13,
      }),
    ).toBe(true);
  });

  it("consumes Enter for legacy IME keyCode 229 events", () => {
    expect(
      shouldConsumeComposerEnterDuringComposition("Enter", {
        isComposing: false,
        keyCode: 229,
      }),
    ).toBe(true);
  });

  it("does not consume non-composing Enter or other command keys", () => {
    expect(
      shouldConsumeComposerEnterDuringComposition("Enter", {
        isComposing: false,
        keyCode: 13,
      }),
    ).toBe(false);
    expect(
      shouldConsumeComposerEnterDuringComposition("Tab", {
        isComposing: true,
        keyCode: 9,
      }),
    ).toBe(false);
  });
});
