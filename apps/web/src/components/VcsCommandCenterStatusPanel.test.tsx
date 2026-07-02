import type { GitListBranchesResult, GitStatusResult } from "@jcode/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  VcsCommandCenterStatusPanel,
  buildVcsCommandCenterStatusModel,
} from "./VcsCommandCenterStatusPanel";

function gitStatus(overrides: Partial<GitStatusResult> = {}): GitStatusResult {
  return {
    branch: "feature/read-only-vcs",
    hasWorkingTreeChanges: true,
    workingTree: {
      files: [
        { path: "src/changed.ts", insertions: 12, deletions: 3 },
        { path: "src/other.ts", insertions: 2, deletions: 0 },
      ],
      insertions: 14,
      deletions: 3,
    },
    hasUpstream: true,
    upstreamBranch: "origin/feature/read-only-vcs",
    aheadCount: 2,
    behindCount: 1,
    pr: {
      number: 42,
      title: "Read-only VCS status",
      url: "https://github.com/Jay1/jcode/pull/42",
      baseBranch: "main",
      headBranch: "feature/read-only-vcs",
      state: "open",
    },
    ...overrides,
  };
}

function branches(overrides: Partial<GitListBranchesResult> = {}): GitListBranchesResult {
  return {
    isRepo: true,
    hasOriginRemote: true,
    branches: [
      {
        name: "feature/read-only-vcs",
        current: true,
        isDefault: false,
        worktreePath: null,
      },
      {
        name: "main",
        current: false,
        isDefault: true,
        worktreePath: null,
      },
    ],
    ...overrides,
  };
}

describe("VcsCommandCenterStatusPanel", () => {
  it("renders branch, dirty status, sync, PR, provider, and read-only state", () => {
    // Given: normalized git status, branch, PR, provider, and repository availability data.
    const model = buildVcsCommandCenterStatusModel({
      gitCwd: "/repo",
      gitStatus: gitStatus(),
      branchList: branches(),
      gitStatusErrorMessage: null,
      providerName: "codex",
      isGitStatusOutOfSync: false,
    });

    // When: the command-center status surface is rendered.
    const html = renderToStaticMarkup(<VcsCommandCenterStatusPanel model={model} />);

    // Then: it is an informational read-only status surface, not a git action surface.
    expect(html).toContain("Version control command center");
    expect(html).toContain("Read-only status");
    expect(html).toContain("feature/read-only-vcs");
    expect(html).toContain("2 files changed");
    expect(html).toContain("+14 / -3");
    expect(html).toContain("Diverged: 2 ahead, 1 behind");
    expect(html).toContain("PR #42 open");
    expect(html).toContain("codex");
    expect(html).not.toContain("<button");
    expect(html).not.toMatch(/commit|push|merge|rebase|stage|stash|discard/i);
  });

  it("renders an unavailable source-control disabled reason without action buttons", () => {
    // Given: the source-control provider cannot deliver normalized git status.
    const model = buildVcsCommandCenterStatusModel({
      gitCwd: "/repo",
      gitStatus: null,
      branchList: branches(),
      gitStatusErrorMessage: "fatal: not a git repository",
      providerName: null,
      isGitStatusOutOfSync: false,
    });

    // When: the command-center status surface is rendered.
    const html = renderToStaticMarkup(<VcsCommandCenterStatusPanel model={model} />);

    // Then: the unavailable state explains the disabled status instead of exposing controls.
    expect(html).toContain("Source control unavailable");
    expect(html).toContain("Git status failed: fatal: not a git repository");
    expect(html).toContain("No provider selected");
    expect(html).toContain("Provider unavailable: no active provider is attached to this thread.");
    expect(html).not.toContain("<button");
    expect(html).not.toMatch(/commit|push|merge|rebase|stage|stash|discard/i);
  });
});
