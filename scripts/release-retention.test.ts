import { assert, describe, it } from "@effect/vitest";

import { planGitHubReleasePrune } from "./release-retention.ts";

describe("release retention", () => {
  it("keeps the current stable release and latest prerelease, pruning older releases", () => {
    const plan = planGitHubReleasePrune({
      currentTag: "v1.2.3",
      releases: [
        {
          id: 1,
          tagName: "v1.2.3",
          draft: false,
          prerelease: false,
          publishedAt: "2026-05-24T10:00:00Z",
        },
        {
          id: 2,
          tagName: "v1.2.2",
          draft: false,
          prerelease: false,
          publishedAt: "2026-05-20T10:00:00Z",
        },
        {
          id: 3,
          tagName: "v1.2.4-alpha.2",
          draft: false,
          prerelease: true,
          publishedAt: "2026-05-23T10:00:00Z",
        },
        {
          id: 4,
          tagName: "v1.2.4-alpha.1",
          draft: false,
          prerelease: true,
          publishedAt: "2026-05-22T10:00:00Z",
        },
        { id: 5, tagName: "draft", draft: true, prerelease: false, publishedAt: null },
      ],
    });

    assert.deepStrictEqual(
      plan.keep.map((release) => release.tagName),
      ["v1.2.3", "v1.2.4-alpha.2", "draft"],
    );
    assert.deepStrictEqual(
      plan.delete.map((release) => release.tagName),
      ["v1.2.2", "v1.2.4-alpha.1"],
    );
  });

  it("keeps the latest stable when publishing a prerelease", () => {
    const plan = planGitHubReleasePrune({
      currentTag: "v1.2.4-alpha.2",
      releases: [
        {
          id: 1,
          tagName: "v1.2.3",
          draft: false,
          prerelease: false,
          publishedAt: "2026-05-24T10:00:00Z",
        },
        {
          id: 2,
          tagName: "v1.2.4-alpha.2",
          draft: false,
          prerelease: true,
          publishedAt: "2026-05-25T10:00:00Z",
        },
        {
          id: 3,
          tagName: "v1.2.4-alpha.1",
          draft: false,
          prerelease: true,
          publishedAt: "2026-05-23T10:00:00Z",
        },
      ],
    });

    assert.deepStrictEqual(
      plan.keep.map((release) => release.tagName),
      ["v1.2.3", "v1.2.4-alpha.2"],
    );
    assert.deepStrictEqual(
      plan.delete.map((release) => release.tagName),
      ["v1.2.4-alpha.1"],
    );
  });
});
