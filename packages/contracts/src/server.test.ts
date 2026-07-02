import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { ServerListWorktreesResult } from "./server";

describe("ServerListWorktreesResult", () => {
  it("decodes managed worktree cleanup safety metadata", () => {
    const decoded = Schema.decodeUnknownSync(ServerListWorktreesResult)({
      worktrees: [
        {
          path: "/tmp/jcode/worktrees/project/feature-a",
          workspaceRoot: "/tmp/project",
          branch: "feature-a",
          isDirty: false,
          hasUnmergedCommits: false,
          cleanupStatus: "safe",
          cleanupExplanation: "Safe to remove.",
        },
      ],
    });

    expect(decoded.worktrees[0]?.cleanupStatus).toBe("safe");
  });
});
