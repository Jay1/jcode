import { describe, expect, it } from "vitest";

import {
  buildSkillsAddArgs,
  buildSkillsFindArgs,
  buildSkillsRemoveArgs,
  deriveSkillNameFromPath,
  parseSkillsFindOutput,
} from "../Services/SkillManagementService.ts";

describe("parseSkillsFindOutput", () => {
  it("parses skills.sh find output into catalog entries", () => {
    const output = `owner/analyze-tools@analyze  12.4K installs
└ https://skills.sh/owner/analyze-tools/analyze

vendor/review-kit@code-review  92 installs
└ https://skills.sh/vendor/review-kit/code-review
`;

    expect(parseSkillsFindOutput(output)).toEqual([
      {
        packageRef: "owner/analyze-tools",
        skillName: "analyze",
        installCount: 12_400,
        url: "https://skills.sh/owner/analyze-tools/analyze",
      },
      {
        packageRef: "vendor/review-kit",
        skillName: "code-review",
        installCount: 92,
        url: "https://skills.sh/vendor/review-kit/code-review",
      },
    ]);
  });
});

describe("skills CLI argument builders", () => {
  it("builds noninteractive add, remove, and find commands", () => {
    expect(
      buildSkillsAddArgs({
        agent: "opencode",
        packageRef: "owner/repo",
        skillName: "analyze",
      }),
    ).toEqual(["skills", "add", "owner/repo", "--agent", "opencode", "--skill", "analyze", "-y"]);
    expect(buildSkillsRemoveArgs({ agent: "codex", skillName: "analyze" })).toEqual([
      "skills",
      "remove",
      "analyze",
      "--agent",
      "codex",
      "-y",
    ]);
    expect(buildSkillsFindArgs("code review")).toEqual(["skills", "find", "code review"]);
  });
});

describe("deriveSkillNameFromPath", () => {
  it("derives skill names from local skill files and provider URIs", () => {
    expect(deriveSkillNameFromPath("/home/me/.agents/skills/analyze/SKILL.md")).toBe("analyze");
    expect(deriveSkillNameFromPath("/home/me/.agents/skills/analyze.disabled/SKILL.md")).toBe(
      "analyze",
    );
    expect(deriveSkillNameFromPath("opencode://skill/code-review")).toBe("code-review");
  });
});
