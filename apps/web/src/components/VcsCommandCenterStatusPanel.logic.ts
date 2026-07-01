import type { GitListBranchesResult, GitStatusResult } from "@jcode/contracts";

export type VcsAvailabilityKind = "available" | "refreshing" | "unavailable";
export type VcsStatusTone = "default" | "success" | "warning" | "error" | "muted";

export type VcsStatusField = {
  readonly label: string;
  readonly value: string;
  readonly detail: string | null;
  readonly tone: VcsStatusTone;
};

export type VcsCommandCenterStatusModel = {
  readonly availability: {
    readonly kind: VcsAvailabilityKind;
    readonly label: string;
    readonly reason: string;
  };
  readonly branch: VcsStatusField;
  readonly worktree: VcsStatusField;
  readonly sync: VcsStatusField;
  readonly pullRequest: VcsStatusField;
  readonly provider: VcsStatusField;
};

export type VcsCommandCenterStatusInput = {
  readonly gitCwd: string | null;
  readonly gitStatus: GitStatusResult | null;
  readonly branchList: GitListBranchesResult | null;
  readonly gitStatusErrorMessage: string | null;
  readonly providerName: string | null;
  readonly isGitStatusOutOfSync: boolean;
};

function pluralize(count: number, singular: string): string {
  return `${count.toLocaleString()} ${singular}${count === 1 ? "" : "s"}`;
}

function buildAvailability(input: VcsCommandCenterStatusInput) {
  if (!input.gitCwd) {
    return {
      kind: "unavailable",
      label: "Source control unavailable",
      reason: "No repository path is selected.",
    } as const;
  }
  if (input.gitStatusErrorMessage) {
    return {
      kind: "unavailable",
      label: "Source control unavailable",
      reason: `Git status failed: ${input.gitStatusErrorMessage}`,
    } as const;
  }
  if (input.branchList && !input.branchList.isRepo) {
    return {
      kind: "unavailable",
      label: "Source control unavailable",
      reason: "Selected path is not a Git repository.",
    } as const;
  }
  if (input.isGitStatusOutOfSync) {
    return {
      kind: "refreshing",
      label: "Refreshing source control",
      reason: "Thread branch is refreshing to match repository state.",
    } as const;
  }
  if (!input.gitStatus) {
    return {
      kind: "unavailable",
      label: "Source control unavailable",
      reason: "Git status is still loading.",
    } as const;
  }
  return {
    kind: "available",
    label: "Source control available",
    reason: "Git status is read-only.",
  } as const;
}

function buildBranchField(input: VcsCommandCenterStatusInput): VcsStatusField {
  const currentBranch = input.branchList?.branches.find((branch) => branch.current)?.name ?? null;
  const branch = input.gitStatus?.branch ?? currentBranch;
  if (branch) return { label: "Branch", value: branch, detail: null, tone: "default" };
  if (input.gitStatus?.branch === null) {
    return { label: "Branch", value: "Detached HEAD", detail: null, tone: "warning" };
  }
  return { label: "Branch", value: "Unknown", detail: null, tone: "muted" };
}

function buildWorktreeField(gitStatus: GitStatusResult | null): VcsStatusField {
  if (!gitStatus) return { label: "Worktree", value: "Unknown", detail: null, tone: "muted" };
  if (!gitStatus.hasWorkingTreeChanges) {
    return { label: "Worktree", value: "Clean", detail: "+0 / -0", tone: "success" };
  }
  return {
    label: "Worktree",
    value: `${pluralize(gitStatus.workingTree.files.length, "file")} changed`,
    detail: `+${gitStatus.workingTree.insertions.toLocaleString()} / -${gitStatus.workingTree.deletions.toLocaleString()}`,
    tone: "warning",
  };
}

function buildSyncField(gitStatus: GitStatusResult | null): VcsStatusField {
  if (!gitStatus) return { label: "Sync", value: "Unknown", detail: null, tone: "muted" };
  if (!gitStatus.hasUpstream) {
    return { label: "Sync", value: "No upstream", detail: null, tone: "warning" };
  }
  const detail = gitStatus.upstreamBranch;
  if (gitStatus.aheadCount > 0 && gitStatus.behindCount > 0) {
    return {
      label: "Sync",
      value: `Diverged: ${gitStatus.aheadCount.toLocaleString()} ahead, ${gitStatus.behindCount.toLocaleString()} behind`,
      detail,
      tone: "warning",
    };
  }
  if (gitStatus.aheadCount > 0) {
    return {
      label: "Sync",
      value: `${gitStatus.aheadCount.toLocaleString()} ahead`,
      detail,
      tone: "warning",
    };
  }
  if (gitStatus.behindCount > 0) {
    return {
      label: "Sync",
      value: `${gitStatus.behindCount.toLocaleString()} behind`,
      detail,
      tone: "warning",
    };
  }
  return { label: "Sync", value: "Up to date", detail, tone: "success" };
}

function buildPullRequestField(gitStatus: GitStatusResult | null): VcsStatusField {
  const pr = gitStatus?.pr ?? null;
  if (!gitStatus) return { label: "Pull request", value: "Unknown", detail: null, tone: "muted" };
  if (!pr) return { label: "Pull request", value: "No linked PR", detail: null, tone: "muted" };
  return {
    label: "Pull request",
    value: `PR #${pr.number.toLocaleString()} ${pr.state}`,
    detail: pr.title,
    tone: pr.state === "open" ? "success" : "muted",
  };
}

function buildProviderField(providerName: string | null): VcsStatusField {
  if (!providerName) {
    return {
      label: "Provider",
      value: "No provider selected",
      detail: "Provider unavailable: no active provider is attached to this thread.",
      tone: "warning",
    };
  }
  return {
    label: "Provider",
    value: providerName,
    detail: "Provider context is attached to this thread.",
    tone: "success",
  };
}

export function buildVcsCommandCenterStatusModel(
  input: VcsCommandCenterStatusInput,
): VcsCommandCenterStatusModel {
  return {
    availability: buildAvailability(input),
    branch: buildBranchField(input),
    worktree: buildWorktreeField(input.gitStatus),
    sync: buildSyncField(input.gitStatus),
    pullRequest: buildPullRequestField(input.gitStatus),
    provider: buildProviderField(input.providerName),
  };
}
