import { describe, expect, it } from "vitest";
import { PROVIDER_OPTIONS } from "../../session-logic";
import { AVAILABLE_PROVIDER_OPTIONS } from "./ProviderModelPicker.logic";

describe("AVAILABLE_PROVIDER_OPTIONS", () => {
  it("contains only providers marked available in the composer provider list", () => {
    expect(AVAILABLE_PROVIDER_OPTIONS).toEqual(PROVIDER_OPTIONS.filter((option) => option.available));
    expect(AVAILABLE_PROVIDER_OPTIONS.every((option) => option.available)).toBe(true);
  });
});
