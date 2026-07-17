import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import TerminalActivityIndicator from "./components/terminal/TerminalActivityIndicator";

const indexCss = readFileSync(new URL("./index.css", import.meta.url), "utf8");
const terminalSource = readFileSync(
  new URL("./components/terminal/TerminalActivityIndicator.tsx", import.meta.url),
  "utf8",
);
const sidebarSource = readFileSync(new URL("./components/Sidebar.tsx", import.meta.url), "utf8");
const timelineSource = readFileSync(
  new URL("./components/chat/MessagesTimeline.tsx", import.meta.url),
  "utf8",
);
const spinnerSource = readFileSync(
  new URL("./components/ThreadRunningSpinner.tsx", import.meta.url),
  "utf8",
);

function sourceRegion(source: string, start: string, end: string | null): string {
  const startIndex = source.indexOf(start);
  const endIndex = end === null ? source.length : source.indexOf(end, startIndex);
  if (startIndex < 0 || endIndex < 0) {
    throw new Error(`Missing source region marker: ${start} -> ${end ?? "<eof>"}`);
  }
  return source.slice(startIndex, endIndex);
}

function sha256(source: string): string {
  return createHash("sha256").update(source).digest("hex");
}

function occurrenceCount(source: string, value: string): number {
  return source.split(value).length - 1;
}

describe("persistent status motion structure", () => {
  it("routes only terminal, Sidebar project, and timeline working pulses through status-pulse", () => {
    expect(occurrenceCount(terminalSource, "status-pulse")).toBe(1);
    expect(occurrenceCount(sidebarSource, "status-pulse")).toBe(1);
    expect(occurrenceCount(timelineSource, "status-pulse")).toBe(3);

    expect(indexCss).toContain(".status-pulse");
    expect(indexCss).not.toContain("status-ping");
    expect(terminalSource).not.toContain("terminal-running-indicator__dot");
  });

  it("uses the measured two-second hold and stepped-ramp keyframes", () => {
    expect(indexCss).toMatch(/\.status-pulse\s*\{[^}]*animation:\s*status-pulse 2s infinite;/su);
    expect(indexCss).toMatch(
      /@keyframes status-pulse\s*\{[\s\S]*?0%,\s*40%\s*\{[\s\S]*?opacity:\s*1;[\s\S]*?animation-timing-function:\s*steps\(6\);[\s\S]*?50%,\s*90%\s*\{[\s\S]*?opacity:\s*0\.5;[\s\S]*?100%\s*\{[\s\S]*?opacity:\s*1;/u,
    );
  });

  it("disables semantic status motion while leaving a stable visible state", () => {
    const reducedMotion = sourceRegion(
      indexCss,
      "@media (prefers-reduced-motion: reduce)",
      "/* Suppress all transitions during theme changes */",
    );
    expect(reducedMotion).toMatch(
      /\.status-pulse\s*\{[^}]*animation-name:\s*none;[^}]*opacity:\s*1;[^}]*transform:\s*none;/su,
    );
  });

  it("renders semantic motion only for the running terminal state and preserves delays", () => {
    const running = renderToStaticMarkup(<TerminalActivityIndicator />);
    const attention = renderToStaticMarkup(<TerminalActivityIndicator state="attention" />);
    const review = renderToStaticMarkup(<TerminalActivityIndicator state="review" />);

    expect(occurrenceCount(running, "status-pulse")).toBe(4);
    for (const delayMs of [0, 160, 320, 480]) {
      expect(running).toContain(`animation-delay:${delayMs}ms`);
    }
    expect(attention).not.toContain("status-pulse");
    expect(review).not.toContain("status-pulse");
  });

  it("preserves finite spinner, skeleton, shimmer, and ultrathink exclusions byte-for-byte", () => {
    const sidebarSkeleton = sourceRegion(
      sidebarSource,
      '{projectEmptyState === "loading" && (',
      '{projectEmptyState === "empty" && (',
    );
    const generatedImageShimmer = sourceRegion(
      indexCss,
      '.chat-generated-image[data-status="loading"] .chat-generated-image__frame',
      ".chat-generated-image__overlay {",
    );
    const ultrathinkMotion = sourceRegion(indexCss, "@keyframes ultrathink-rainbow", null);

    expect(sha256(spinnerSource)).toBe(
      "134bb2ea2f2d6737161b91beda728a692a73bb5ed69336bc18a782fcfe8adfdf",
    );
    expect(sha256(sidebarSkeleton)).toBe(
      "4b96ac9f294e54a6a53ebb078e33d869a5be39cba15dffeb10f1c6bc854dc8a7",
    );
    expect(sha256(generatedImageShimmer)).toBe(
      "ceb5aab87febc17b6b7aa12294680bfc924e450e3453bf7e480e9601d659e21f",
    );
    expect(sha256(ultrathinkMotion)).toBe(
      "153804088b34bb9044fb1de86b44707fb3423d2bf02566cdcfc7997c7d5cfe59",
    );
  });
});
