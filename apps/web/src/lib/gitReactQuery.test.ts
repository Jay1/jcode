import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import {
  gitMutationKeys,
  gitPreparePullRequestThreadMutationOptions,
  gitPullMutationOptions,
  gitSummarizeDiffQueryOptions,
  gitRunStackedActionMutationOptions,
} from "./gitReactQuery";

describe("gitMutationKeys", () => {
  it("scopes stacked action keys by cwd", () => {
    expect(gitMutationKeys.runStackedAction("/repo/a")).not.toEqual(
      gitMutationKeys.runStackedAction("/repo/b"),
    );
  });

  it("scopes pull keys by cwd", () => {
    expect(gitMutationKeys.pull("/repo/a")).not.toEqual(gitMutationKeys.pull("/repo/b"));
  });

  it("scopes pull request thread preparation keys by cwd", () => {
    expect(gitMutationKeys.preparePullRequestThread("/repo/a")).not.toEqual(
      gitMutationKeys.preparePullRequestThread("/repo/b"),
    );
  });
});

describe("git mutation options", () => {
  const queryClient = new QueryClient();

  it("attaches cwd-scoped mutation key for runStackedAction", () => {
    const options = gitRunStackedActionMutationOptions({ cwd: "/repo/a", queryClient });
    expect(options.mutationKey).toEqual(gitMutationKeys.runStackedAction("/repo/a"));
  });

  it("attaches cwd-scoped mutation key for pull", () => {
    const options = gitPullMutationOptions({ cwd: "/repo/a", queryClient });
    expect(options.mutationKey).toEqual(gitMutationKeys.pull("/repo/a"));
  });

  it("attaches cwd-scoped mutation key for preparePullRequestThread", () => {
    const options = gitPreparePullRequestThreadMutationOptions({
      cwd: "/repo/a",
      queryClient,
    });
    expect(options.mutationKey).toEqual(gitMutationKeys.preparePullRequestThread("/repo/a"));
  });
});

describe("gitSummarizeDiffQueryOptions", () => {
  it("keys summaries by Codex provider options without leaking unrelated provider secrets", () => {
    const options = gitSummarizeDiffQueryOptions({
      cwd: "/repo/a",
      patch: "diff --git a/file.ts b/file.ts",
      providerOptions: {
        codex: {
          binaryPath: "/bin/custom-codex",
          homePath: "/tmp/custom-codex-home",
          launchArgs: "--profile custom",
        },
        kilo: {
          serverPassword: "kilo-secret-password",
        },
        opencode: {
          serverPassword: "opencode-secret-password",
        },
      },
    });

    const keyText = JSON.stringify(options.queryKey);
    expect(keyText).toContain("/bin/custom-codex");
    expect(keyText).toContain("/tmp/custom-codex-home");
    expect(keyText).toContain("--profile custom");
    expect(keyText).not.toContain("kilo-secret-password");
    expect(keyText).not.toContain("opencode-secret-password");
    expect(keyText).not.toContain("serverPassword");
  });
});
