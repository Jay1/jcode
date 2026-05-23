import type { FileDiffMetadata } from "@pierre/diffs/react";

export function buildDiffPanelUnsafeCSS(theme: "light" | "dark"): string {
  const titleColor = theme === "dark" ? "#6073CC" : "#526FFF";
  return `
:host {
  /* Route the entire diff viewer through the chat code font so custom code fonts reach line numbers too. */
  --diffs-font-family: var(--font-chat-code-family);
  --diffs-header-font-family: var(--font-chat-code-family);
  /* Honor the user-chosen chat code font size from settings instead of the library default (13px). */
  --diffs-font-size: var(--app-font-size-chat-code, 11px);
  font-family: var(--font-chat-code-family) !important;
  font-size: var(--app-font-size-chat-code, 11px) !important;
}

[data-diffs-header],
[data-diff],
[data-file],
[data-error-wrapper],
[data-virtualizer-buffer] {
  /* Re-assert the code font inside the library chrome because these nodes live in shadow-rooted markup. */
  --diffs-font-family: var(--font-chat-code-family) !important;
  --diffs-header-font-family: var(--font-chat-code-family) !important;
  --diffs-font-size: var(--app-font-size-chat-code, 11px) !important;
  font-family: var(--font-chat-code-family) !important;
  font-size: var(--app-font-size-chat-code, 11px) !important;
  --diffs-bg: color-mix(in srgb, var(--card) 90%, var(--background)) !important;
  --diffs-light-bg: color-mix(in srgb, var(--card) 90%, var(--background)) !important;
  --diffs-dark-bg: color-mix(in srgb, var(--card) 90%, var(--background)) !important;
  --diffs-token-light-bg: transparent;
  --diffs-token-dark-bg: transparent;

  --diffs-bg-context-override: color-mix(in srgb, var(--background) 97%, var(--foreground));
  --diffs-bg-hover-override: color-mix(in srgb, var(--background) 94%, var(--foreground));
  --diffs-bg-separator-override: color-mix(in srgb, var(--background) 95%, var(--foreground));
  --diffs-bg-buffer-override: color-mix(in srgb, var(--background) 90%, var(--foreground));

  --diffs-bg-addition-override: color-mix(in srgb, var(--background) 92%, var(--success));
  --diffs-bg-addition-number-override: color-mix(in srgb, var(--background) 88%, var(--success));
  --diffs-bg-addition-hover-override: color-mix(in srgb, var(--background) 85%, var(--success));
  --diffs-bg-addition-emphasis-override: color-mix(in srgb, var(--background) 80%, var(--success));

  --diffs-bg-deletion-override: color-mix(in srgb, var(--background) 92%, var(--destructive));
  --diffs-bg-deletion-number-override: color-mix(in srgb, var(--background) 88%, var(--destructive));
  --diffs-bg-deletion-hover-override: color-mix(in srgb, var(--background) 85%, var(--destructive));
  --diffs-bg-deletion-emphasis-override: color-mix(
    in srgb,
    var(--background) 80%,
    var(--destructive)
  );

  background-color: var(--diffs-bg) !important;
}

[data-file-info] {
  font-family: var(--font-chat-code-family) !important;
  font-size: var(--app-font-size-chat-code, 11px) !important;
  background-color: color-mix(in srgb, var(--card) 94%, var(--foreground)) !important;
  border-block-color: var(--border) !important;
  color: var(--foreground) !important;
}

[data-diffs-header] {
  position: sticky !important;
  top: 0;
  z-index: 4;
  background-color: color-mix(in srgb, var(--card) 94%, var(--foreground)) !important;
  border-bottom: 1px solid var(--border) !important;
  cursor: pointer;
}

/* Hide the default change-type icon (blue circle) — replaced by chevron + file-type icon. */
[data-change-icon] {
  display: none;
}

[data-title] {
  font-family: var(--font-chat-code-family) !important;
  font-size: var(--app-font-size-chat-code, 11px) !important;
  cursor: pointer;
  color: ${titleColor} !important;
}
`;
}

export function resolveFileDiffPath(fileDiff: FileDiffMetadata): string {
  const raw = fileDiff.name ?? fileDiff.prevName ?? "";
  if (raw.startsWith("a/") || raw.startsWith("b/")) {
    return raw.slice(2);
  }
  return raw;
}

export function buildFileDiffRenderKey(fileDiff: FileDiffMetadata): string {
  return fileDiff.cacheKey ?? `${fileDiff.prevName ?? "none"}:${fileDiff.name}`;
}
