import { describe, expect, it } from "vitest";

import {
  isInitialModelDiscoveryPending,
  providerSkillsQueryOptions,
} from "./providerDiscoveryReactQuery";

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

describe("providerSkillsQueryOptions", () => {
  it("keys skill discovery by thread when thread context is supplied", () => {
    const firstThread = providerSkillsQueryOptions({
      provider: "opencode",
      cwd: "/repo",
      threadId: "thread-a",
      query: "",
    });
    const secondThread = providerSkillsQueryOptions({
      provider: "opencode",
      cwd: "/repo",
      threadId: "thread-b",
      query: "",
    });

    expect(firstThread.queryKey).not.toEqual(secondThread.queryKey);
  });
});
