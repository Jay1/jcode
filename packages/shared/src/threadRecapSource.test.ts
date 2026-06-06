import { describe, expect, it } from "vitest";

import {
  buildThreadRecapPrompt,
  deriveThreadRecapSource,
  sanitizeThreadRecap,
} from "./threadRecapSource";

const FIXTURE_MESSAGES = [
  { id: "m1", role: "system" as const, text: "system prompt" },
  { id: "m2", role: "user" as const, text: "hello" },
  { id: "m3", role: "assistant" as const, text: "hi there" },
  { id: "m4", role: "user" as const, text: "build a feature" },
  { id: "m5", role: "assistant" as const, text: "sure, here's the plan" },
  { id: "m6", role: "user" as const, text: "looks good" },
  { id: "m7", role: "assistant" as const, text: "implementing now" },
] as const;

const FIXTURE_ACTIVITIES = [
  {
    kind: "file.write",
    summary: "Wrote src/foo.ts",
    createdAt: "2026-01-01T00:01:00Z",
  },
  {
    kind: "command.run",
    summary: "Ran bun test",
    createdAt: "2026-01-01T00:02:00Z",
  },
  {
    kind: "approval.requested",
    summary: "Approval requested for command",
    createdAt: "2026-01-01T00:03:00Z",
  },
];

describe("deriveThreadRecapSource", () => {
  it("builds newMaterial from user+assistant messages only", () => {
    const result = deriveThreadRecapSource({
      messages: [...FIXTURE_MESSAGES],
      activities: [],
      title: "Test thread",
    });

    expect(result.hasNewMaterial).toBe(true);
    expect(result.newMaterial).not.toContain("[system]");
    expect(result.newMaterial).toContain("[user] hello");
    expect(result.newMaterial).toContain("[assistant] hi there");
  });

  it("skips system messages", () => {
    const result = deriveThreadRecapSource({
      messages: [
        { id: "s1", role: "system", text: "sys" },
        { id: "u1", role: "user", text: "hi" },
      ],
      activities: [],
      title: "Test",
    });

    expect(result.newMaterial).toBe("[user] hi");
    expect(result.latestMessageId).toBe("u1");
  });

  it("truncates long messages", () => {
    const longText = "a".repeat(800);
    const result = deriveThreadRecapSource({
      messages: [{ id: "u1", role: "user", text: longText }],
      activities: [],
      title: "Test",
    });

    const expectedLen = 600 - 1 + "…".length;
    expect(result.newMaterial.startsWith("[user] " + "a".repeat(599) + "…")).toBe(true);
    expect(result.newMaterial).toHaveLength("[user] ".length + expectedLen);
  });

  it("returns empty material when no user-facing messages exist", () => {
    const result = deriveThreadRecapSource({
      messages: [{ id: "s1", role: "system", text: "sys" }],
      activities: [],
      title: "Test",
    });

    expect(result.hasNewMaterial).toBe(false);
    expect(result.newMaterial).toBe("");
    expect(result.latestMessageId).toBeNull();
  });

  it("builds currentState from activity summaries", () => {
    const result = deriveThreadRecapSource({
      messages: [{ id: "u1", role: "user", text: "hi" }],
      activities: FIXTURE_ACTIVITIES,
      title: "Test",
    });

    expect(result.currentState).toContain("Wrote src/foo.ts");
    expect(result.currentState).toContain("Ran bun test");
    expect(result.currentState).toContain("Approval requested for command");
  });

  describe("delta material", () => {
    it("uses only messages after previousCoveredMessageId", () => {
      const result = deriveThreadRecapSource({
        messages: [...FIXTURE_MESSAGES],
        activities: [],
        title: "Test",
        previousCoveredMessageId: "m4",
      });

      expect(result.newMaterial).not.toContain("[user] hello");
      expect(result.newMaterial).not.toContain("[assistant] hi there");
      expect(result.newMaterial).not.toContain("[user] build a feature");
      expect(result.newMaterial).toContain("[assistant] sure, here's the plan");
      expect(result.newMaterial).toContain("[user] looks good");
      expect(result.newMaterial).toContain("[assistant] implementing now");
      expect(result.latestMessageId).toBe("m7");
    });

    it("falls back to recent messages when covered ID is not found", () => {
      const result = deriveThreadRecapSource({
        messages: [...FIXTURE_MESSAGES],
        activities: [],
        title: "Test",
        previousCoveredMessageId: "nonexistent",
      });

      const userFacing = FIXTURE_MESSAGES.filter(
        (m) => m.role === "user" || m.role === "assistant",
      );
      const expectedLast4 = userFacing.slice(-4);
      expect(result.latestMessageId).toBe(expectedLast4[expectedLast4.length - 1]!.id);
    });

    it("respects MAX_DELTA_MESSAGES limit", () => {
      const manyMessages = Array.from({ length: 20 }, (_, i) => ({
        id: `u${i}`,
        role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
        text: `msg ${i}`,
      }));

      const result = deriveThreadRecapSource({
        messages: manyMessages,
        activities: [],
        title: "Test",
        previousCoveredMessageId: "u5",
      });

      const lines = result.newMaterial.split("\n");
      expect(lines.length).toBeLessThanOrEqual(4);
    });
  });

  it("limits initial recap to MAX_RECAP_MESSAGES (6)", () => {
    const manyMessages = Array.from({ length: 20 }, (_, i) => ({
      id: `u${i}`,
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      text: `msg ${i}`,
    }));

    const result = deriveThreadRecapSource({
      messages: manyMessages,
      activities: [],
      title: "Test",
    });

    const lines = result.newMaterial.split("\n");
    expect(lines.length).toBe(6);
  });
});

describe("sanitizeThreadRecap", () => {
  it("strips recap: prefix (case insensitive)", () => {
    expect(sanitizeThreadRecap("Recap: Working on auth")).toBe("Working on auth");
    expect(sanitizeThreadRecap("RECAP: working")).toBe("working");
    expect(sanitizeThreadRecap("recap: building feature")).toBe("building feature");
  });

  it("normalizes whitespace", () => {
    expect(sanitizeThreadRecap("  hello   world  ")).toBe("hello world");
    expect(sanitizeThreadRecap("line1\n\nline2\t\tmore")).toBe("line1 line2 more");
  });

  it("truncates to 240 chars with ellipsis", () => {
    const long = "a".repeat(300);
    const result = sanitizeThreadRecap(long);
    expect(result.length).toBeLessThanOrEqual(240);
    expect(result.endsWith("...")).toBe(true);
  });

  it("falls back to previous recap when result is empty", () => {
    expect(sanitizeThreadRecap("", "previous recap")).toBe("previous recap");
    expect(sanitizeThreadRecap("   ", "previous recap")).toBe("previous recap");
  });

  it("returns default when both are empty", () => {
    expect(sanitizeThreadRecap("")).toBe("No meaningful recap yet.");
    expect(sanitizeThreadRecap("  ")).toBe("No meaningful recap yet.");
    expect(sanitizeThreadRecap("", "")).toBe("No meaningful recap yet.");
  });

  it("preserves short valid recaps unchanged", () => {
    expect(sanitizeThreadRecap("Building the auth module")).toBe("Building the auth module");
  });
});

describe("buildThreadRecapPrompt", () => {
  it("includes key instruction phrases", () => {
    const { prompt } = buildThreadRecapPrompt({
      newMaterial: "[user] hi",
    });

    expect(prompt).toContain("JCode thread recap generator");
    expect(prompt).toContain("150-190 characters");
    expect(prompt).toContain("single paragraph");
    expect(prompt).toContain("Plain text only");
    expect(prompt).toContain("[user] hi");
  });

  it("includes previous recap when provided", () => {
    const { prompt } = buildThreadRecapPrompt({
      previousRecap: "Working on tests",
      newMaterial: "[user] continue",
    });

    expect(prompt).toContain("Previous recap: Working on tests");
  });

  it("includes current state when provided", () => {
    const { prompt } = buildThreadRecapPrompt({
      newMaterial: "[user] go",
      currentState: "File written, tests passing",
    });

    expect(prompt).toContain("Current state: File written, tests passing");
  });

  it("omits previous recap and current state sections when not provided", () => {
    const { prompt } = buildThreadRecapPrompt({
      newMaterial: "[user] go",
    });

    expect(prompt).not.toContain("Previous recap:");
    expect(prompt).not.toContain("Current state:");
  });
});
