import { describe, expect, it } from "vitest";

import {
  WORKTREE_BRANCH_PREFIX,
  buildJcodeBranchName,
  buildTemporaryWorktreeBranchName,
  isTemporaryWorktreeBranch,
  resolveUniqueJcodeBranchName,
  resolveThreadBranchRegressionGuard,
} from "./git";

describe("isTemporaryWorktreeBranch", () => {
  it("matches generated temporary worktree branches", () => {
    expect(isTemporaryWorktreeBranch(buildTemporaryWorktreeBranchName())).toBe(true);
  });

  it("matches generated temporary worktree branches", () => {
    expect(isTemporaryWorktreeBranch(`${WORKTREE_BRANCH_PREFIX}/deadbeef`)).toBe(true);
    expect(isTemporaryWorktreeBranch(` ${WORKTREE_BRANCH_PREFIX}/DEADBEEF `)).toBe(true);
  });

  it("rejects semantic branch names", () => {
    expect(isTemporaryWorktreeBranch(`${WORKTREE_BRANCH_PREFIX}/feature/demo`)).toBe(false);
    expect(isTemporaryWorktreeBranch("feature/demo")).toBe(false);
  });
});

describe("resolveThreadBranchRegressionGuard", () => {
  it("keeps a semantic branch when the next branch is only a temporary worktree placeholder", () => {
    expect(
      resolveThreadBranchRegressionGuard({
        currentBranch: "feature/semantic-branch",
        nextBranch: `${WORKTREE_BRANCH_PREFIX}/deadbeef`,
      }),
    ).toBe("feature/semantic-branch");
  });

  it("accepts real branch changes", () => {
    expect(
      resolveThreadBranchRegressionGuard({
        currentBranch: "feature/old",
        nextBranch: "feature/new",
      }),
    ).toBe("feature/new");
  });

  it("allows clearing the branch", () => {
    expect(
      resolveThreadBranchRegressionGuard({
        currentBranch: "feature/old",
        nextBranch: null,
      }),
    ).toBeNull();
  });
});

describe("buildJcodeBranchName", () => {
  it("uses JCode as the branch namespace", () => {
    expect(buildJcodeBranchName("fix toast copy")).toBe("jcode/fix-toast-copy");
  });

  it("keeps non-JCode namespaces inside the JCode branch", () => {
    expect(buildJcodeBranchName("feature/refine-toolbar-actions")).toBe(
      "jcode/feature/refine-toolbar-actions",
    );
  });

  it("normalizes legacy JCode-style prefixes before rebuilding the branch", () => {
    expect(buildJcodeBranchName("t3code/refine toolbar actions")).toBe(
      "jcode/refine-toolbar-actions",
    );
  });

  it("falls back to jcode/update when no preferred name is provided", () => {
    expect(buildJcodeBranchName()).toBe("jcode/update");
  });
});

describe("resolveUniqueJcodeBranchName", () => {
  it("increments suffix when the JCode branch already exists", () => {
    expect(
      resolveUniqueJcodeBranchName(
        ["main", "jcode/fix-toast-copy", "jcode/fix-toast-copy-2"],
        "fix toast copy",
      ),
    ).toBe("jcode/fix-toast-copy-3");
  });
});
