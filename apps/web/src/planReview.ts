export interface PlanAnnotation {
  id: string;
  createdAt: string;
  updatedAt: string;
  quote: string | null;
  comment: string;
}

export interface PlanReviewState {
  annotations: PlanAnnotation[];
}

export function createPlanAnnotation(
  id: string,
  comment: string,
  quote: string | null = null,
): PlanAnnotation {
  const now = new Date().toISOString();
  return {
    id,
    createdAt: now,
    updatedAt: now,
    quote: quote && quote.trim().length > 0 ? quote.trim() : null,
    comment: comment.trim(),
  };
}

export function updatePlanAnnotation(
  annotation: PlanAnnotation,
  updates: { comment?: string; quote?: string | null },
): PlanAnnotation {
  return {
    ...annotation,
    comment: updates.comment !== undefined ? updates.comment.trim() : annotation.comment,
    quote:
      updates.quote !== undefined
        ? updates.quote && updates.quote.trim().length > 0
          ? updates.quote.trim()
          : null
        : annotation.quote,
    updatedAt: new Date().toISOString(),
  };
}

export function buildAnnotationMarkdown(annotation: PlanAnnotation): string {
  const parts: string[] = [];
  if (annotation.quote) {
    parts.push("> " + annotation.quote.split("\n").join("\n> "));
    parts.push("");
  }
  parts.push(annotation.comment);
  return parts.join("\n");
}

export function buildPlanReviewComposerMarkdown(
  planTitle: string | null,
  annotations: PlanAnnotation[],
): string {
  const lines: string[] = [];
  lines.push(`## Review: ${planTitle ?? "Plan"}`);
  lines.push("");
  if (annotations.length === 0) {
    lines.push("No comments.");
    return lines.join("\n");
  }
  for (const annotation of annotations) {
    lines.push(buildAnnotationMarkdown(annotation));
    lines.push("");
  }
  return lines.join("\n").trimEnd() + "\n";
}

export function formatQuoteForComment(quote: string): string {
  const trimmed = quote.trim();
  if (trimmed.length === 0) return "";
  const lines = trimmed.split("\n");
  if (lines.length === 1) {
    return `> ${trimmed}\n\n`;
  }
  return "> " + lines.join("\n> ") + "\n\n";
}

export function buildCommentWithQuote(comment: string, quote: string | null): string {
  const formattedComment = comment.trim();
  if (!quote || quote.trim().length === 0) {
    return formattedComment;
  }
  return formatQuoteForComment(quote) + formattedComment;
}
