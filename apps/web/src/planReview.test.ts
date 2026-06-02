import { describe, expect, it, vi } from "vitest";
import {
  buildAnnotationMarkdown,
  buildCommentWithQuote,
  buildPlanReviewComposerMarkdown,
  createPlanAnnotation,
  formatQuoteForComment,
  updatePlanAnnotation,
} from "./planReview";

describe("createPlanAnnotation", () => {
  it("creates an annotation with comment only", () => {
    const annotation = createPlanAnnotation("a1", "Looks good");
    expect(annotation.id).toBe("a1");
    expect(annotation.comment).toBe("Looks good");
    expect(annotation.quote).toBeNull();
    expect(annotation.createdAt).toBe(annotation.updatedAt);
  });

  it("creates an annotation with quote and comment", () => {
    const annotation = createPlanAnnotation("a2", "Needs work", "Step 3: refactor");
    expect(annotation.comment).toBe("Needs work");
    expect(annotation.quote).toBe("Step 3: refactor");
  });

  it("trims comment and quote whitespace", () => {
    const annotation = createPlanAnnotation("a3", "  trim me  ", "  quoted  ");
    expect(annotation.comment).toBe("trim me");
    expect(annotation.quote).toBe("quoted");
  });

  it("rejects empty comments", () => {
    expect(() => createPlanAnnotation("a-empty", "   ")).toThrow(
      "Plan annotation comment cannot be empty.",
    );
  });

  it("converts empty quote to null", () => {
    const annotation = createPlanAnnotation("a4", "comment", "");
    expect(annotation.quote).toBeNull();
  });
});

describe("updatePlanAnnotation", () => {
  it("updates comment", () => {
    vi.useFakeTimers();
    const base = createPlanAnnotation("a1", "Old comment", "Quote");
    vi.advanceTimersByTime(10);
    const updated = updatePlanAnnotation(base, { comment: "New comment" });
    vi.useRealTimers();
    expect(updated.comment).toBe("New comment");
    expect(updated.quote).toBe("Quote");
    expect(updated.updatedAt).not.toBe(base.updatedAt);
  });

  it("rejects empty comment updates", () => {
    const base = createPlanAnnotation("a1", "Old comment", "Quote");
    expect(() => updatePlanAnnotation(base, { comment: "   " })).toThrow(
      "Plan annotation comment cannot be empty.",
    );
  });

  it("updates quote to null", () => {
    const base = createPlanAnnotation("a1", "comment", "Quote");
    const updated = updatePlanAnnotation(base, { quote: null });
    expect(updated.quote).toBeNull();
  });

  it("updates quote to new value", () => {
    const base = createPlanAnnotation("a1", "comment", "Old quote");
    const updated = updatePlanAnnotation(base, { quote: "New quote" });
    expect(updated.quote).toBe("New quote");
  });

  it("converts empty quote to null", () => {
    const base = createPlanAnnotation("a1", "comment", "Quote");
    const updated = updatePlanAnnotation(base, { quote: "   " });
    expect(updated.quote).toBeNull();
  });
});

describe("buildAnnotationMarkdown", () => {
  it("renders comment-only annotation", () => {
    const annotation = createPlanAnnotation("a1", "LGTM");
    expect(buildAnnotationMarkdown(annotation)).toBe("LGTM");
  });

  it("renders annotation with single-line quote", () => {
    const annotation = createPlanAnnotation("a1", "Check this", "Important step");
    expect(buildAnnotationMarkdown(annotation)).toBe("> Important step\n\nCheck this");
  });

  it("renders annotation with multi-line quote", () => {
    const annotation = createPlanAnnotation("a1", "Review", "Line 1\nLine 2");
    expect(buildAnnotationMarkdown(annotation)).toBe("> Line 1\n> Line 2\n\nReview");
  });
});

describe("buildPlanReviewComposerMarkdown", () => {
  it("renders empty review", () => {
    const md = buildPlanReviewComposerMarkdown("My Plan", []);
    expect(md).toContain("## Review: My Plan");
    expect(md).toContain("No comments.");
  });

  it("renders review with annotations", () => {
    const annotations = [
      createPlanAnnotation("a1", "Looks good", "Step 1"),
      createPlanAnnotation("a2", "Needs revision"),
    ];
    const md = buildPlanReviewComposerMarkdown("My Plan", annotations);
    expect(md).toContain("## Review: My Plan");
    expect(md).toContain("> Step 1\n\nLooks good");
    expect(md).toContain("Needs revision");
  });

  it("uses default title when planTitle is null", () => {
    const md = buildPlanReviewComposerMarkdown(null, []);
    expect(md).toContain("## Review: Plan");
  });
});

describe("formatQuoteForComment", () => {
  it("returns empty string for empty quote", () => {
    expect(formatQuoteForComment("")).toBe("");
  });

  it("returns empty string for whitespace-only quote", () => {
    expect(formatQuoteForComment("   ")).toBe("");
  });

  it("formats single-line quote", () => {
    expect(formatQuoteForComment("Hello")).toBe("> Hello\n\n");
  });

  it("formats multi-line quote", () => {
    expect(formatQuoteForComment("Line 1\nLine 2")).toBe("> Line 1\n> Line 2\n\n");
  });

  it("trims whitespace", () => {
    expect(formatQuoteForComment("  Hello  ")).toBe("> Hello\n\n");
  });
});

describe("buildCommentWithQuote", () => {
  it("returns comment only when quote is null", () => {
    expect(buildCommentWithQuote("Comment", null)).toBe("Comment");
  });

  it("returns comment only when quote is empty", () => {
    expect(buildCommentWithQuote("Comment", "")).toBe("Comment");
  });

  it("combines quote and comment", () => {
    expect(buildCommentWithQuote("Check this", "Important")).toBe("> Important\n\nCheck this");
  });
});
