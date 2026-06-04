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

  it("parses entries without URLs", () => {
    const output = `owner/analyze-tools@analyze  12 installs`;

    expect(parseSkillsFindOutput(output)).toEqual([
      {
        packageRef: "owner/analyze-tools",
        skillName: "analyze",
        installCount: 12,
      },
    ]);
  });

  it("parses M-suffix install counts", () => {
    const output = `owner/popular-tools@analyze  1.5M installs`;

    expect(parseSkillsFindOutput(output)).toEqual([
      {
        packageRef: "owner/popular-tools",
        skillName: "analyze",
        installCount: 1_500_000,
      },
    ]);
  });

  it("skips malformed catalog lines but keeps entries with unparsable install counts", () => {
    const output = `not a valid skills line
owner/analyze-tools@analyze  many installs
vendor/review-kit@code-review  92 installs`;

    expect(parseSkillsFindOutput(output)).toEqual([
      {
        packageRef: "owner/analyze-tools",
        skillName: "analyze",
      },
      {
        packageRef: "vendor/review-kit",
        skillName: "code-review",
        installCount: 92,
      },
    ]);
  });

  it("ignores URL lines that are not HTTP URLs", () => {
    const output = `owner/analyze-tools@analyze  12 installs
└ skills.sh/owner/analyze-tools/analyze`;

    expect(parseSkillsFindOutput(output)).toEqual([
      {
        packageRef: "owner/analyze-tools",
        skillName: "analyze",
        installCount: 12,
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

  it("omits --skill when add arguments do not include a skill name", () => {
    expect(
      buildSkillsAddArgs({
        agent: "opencode",
        packageRef: "owner/repo",
      }),
    ).toEqual(["skills", "add", "owner/repo", "--agent", "opencode", "-y"]);
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
