import type { WorkLogEntry } from "../../session-logic";
import { isCommandWorkLogEntry } from "../../session-logic";

export const COMMAND_OUTPUT_TAIL_LINES = 40;

export function hasExpandableActivityDetails(workEntry: WorkLogEntry): boolean {
  return hasCommandActivityDetails(workEntry) || hasFileChangeActivityDetails(workEntry);
}

export function hasCommandActivityDetails(workEntry: WorkLogEntry): boolean {
  if (!isCommandWorkLogEntry(workEntry)) {
    return false;
  }
  return Boolean(
    workEntry.command ||
    workEntry.rawCommand ||
    workEntry.output ||
    workEntry.stdout ||
    workEntry.stderr ||
    workEntry.exitCode !== undefined ||
    workEntry.durationMs !== undefined,
  );
}

export function hasFileChangeActivityDetails(workEntry: WorkLogEntry): boolean {
  return isFileChangeActivity(workEntry) && Boolean(workEntry.patch?.trim());
}

export function isFileChangeActivity(workEntry: WorkLogEntry): boolean {
  return workEntry.itemType === "file_change" || workEntry.requestKind === "file-change";
}

export function formatWorkspaceRelativePath(
  filePath: string,
  workspaceRoot: string | undefined,
): string {
  const normalizedPath = filePath.replace(/\\/gu, "/");
  const normalizedRoot = workspaceRoot?.replace(/\\/gu, "/").replace(/\/+$/u, "");
  if (normalizedRoot && normalizedPath.startsWith(`${normalizedRoot}/`)) {
    return normalizedPath.slice(normalizedRoot.length + 1);
  }
  return normalizedPath;
}

export function getRenderableCommandOutputLines(value: string | undefined): string[] {
  if (typeof value !== "string" || value.length === 0) {
    return [];
  }
  const lines = value.split(/\r?\n/u);
  let startIndex = 0;
  let endIndex = lines.length;
  while (startIndex < endIndex && (lines[startIndex]?.trim().length ?? 0) === 0) {
    startIndex += 1;
  }
  while (endIndex > startIndex && (lines[endIndex - 1]?.trim().length ?? 0) === 0) {
    endIndex -= 1;
  }
  return lines.slice(startIndex, endIndex);
}

export function hasRenderableCommandOutput(value: string | undefined): value is string {
  return getRenderableCommandOutputLines(value).length > 0;
}

export function getVisibleCommandOutputLines(value: string): {
  readonly lines: readonly string[];
  readonly hiddenLineCount: number;
} {
  const lines = getRenderableCommandOutputLines(value);
  if (lines.length <= COMMAND_OUTPUT_TAIL_LINES) {
    return { lines, hiddenLineCount: 0 };
  }
  return {
    lines: lines.slice(-COMMAND_OUTPUT_TAIL_LINES),
    hiddenLineCount: lines.length - COMMAND_OUTPUT_TAIL_LINES,
  };
}
