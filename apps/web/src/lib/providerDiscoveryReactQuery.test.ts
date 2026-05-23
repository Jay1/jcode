import { describe, expect, it } from "vitest";

import { isInitialModelDiscoveryPending } from "./providerDiscoveryReactQuery";

describe("isInitialModelDiscoveryPending", () => {
  it("treats placeholder refetches as initial discovery", () => {
    expect(
      isInitialModelDiscoveryPending({
        isLoading: false,
        isFetching: true,
        isPlaceholderData: true,
      }),
    ).toBe(true);
  });

  it("does not treat later background refetches as initial discovery", () => {
    expect(
      isInitialModelDiscoveryPending({
        isLoading: false,
        isFetching: true,
        isPlaceholderData: false,
      }),
    ).toBe(false);
  });
});
