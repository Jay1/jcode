import { formatDuration } from "../../session-logic";
import { getRenderablePatch, serializeRenderablePatchText } from "../../lib/diffRendering";
import { cn } from "~/lib/utils";
import type { WorkLogEntry } from "../../session-logic";
import {
  formatWorkspaceRelativePath,
  getVisibleCommandOutputLines,
  hasCommandActivityDetails,
  hasExpandableActivityDetails,
  hasFileChangeActivityDetails,
  hasRenderableCommandOutput,
} from "./MessagesTimelineActivityDetails.logic";

export { hasExpandableActivityDetails } from "./MessagesTimelineActivityDetails.logic";

export function ActivityEntryDetails(props: {
  workEntry: WorkLogEntry;
  workspaceRoot: string | undefined;
}) {
  if (hasCommandActivityDetails(props.workEntry)) {
    return <CommandActivityDetails workEntry={props.workEntry} />;
  }
  if (hasFileChangeActivityDetails(props.workEntry)) {
    return <FileChangeActivityDetails {...props} />;
  }
  return null;
}

function CommandActivityDetails(props: { workEntry: WorkLogEntry }) {
  const command = props.workEntry.command ?? props.workEntry.rawCommand;
  const rawCommand =
    props.workEntry.rawCommand && props.workEntry.rawCommand !== command
      ? props.workEntry.rawCommand
      : null;
  const hasStreamOutput =
    hasRenderableCommandOutput(props.workEntry.stdout) ||
    hasRenderableCommandOutput(props.workEntry.stderr);

  return (
    <div className="mt-1.5 ms-6 space-y-2 border-s border-[color:var(--app-work-row-border)] ps-3 pt-0.5">
      {command ? (
        <ActivityDetailBlock title="Command" mono>
          {command}
        </ActivityDetailBlock>
      ) : null}
      {rawCommand ? (
        <ActivityDetailBlock title="Raw command" mono>
          {rawCommand}
        </ActivityDetailBlock>
      ) : null}
      <div className="flex flex-wrap gap-1.5 text-[10px] text-[var(--app-metadata-muted-fg)]">
        <span className="rounded-md border border-[color:var(--app-work-row-border)] bg-[var(--app-work-row-bg)] px-1.5 py-0.5">
          Exit code {props.workEntry.exitCode ?? "unknown"}
        </span>
        <span className="rounded-md border border-[color:var(--app-work-row-border)] bg-[var(--app-work-row-bg)] px-1.5 py-0.5">
          Duration {formatActivityDuration(props.workEntry.durationMs)}
        </span>
      </div>
      {hasRenderableCommandOutput(props.workEntry.stdout) ? (
        <CommandOutputBlock title="Stdout" value={props.workEntry.stdout} />
      ) : null}
      {hasRenderableCommandOutput(props.workEntry.stderr) ? (
        <CommandOutputBlock title="Stderr" value={props.workEntry.stderr} tone="error" />
      ) : null}
      {!hasStreamOutput && hasRenderableCommandOutput(props.workEntry.output) ? (
        <CommandOutputBlock title="Output" value={props.workEntry.output} />
      ) : null}
    </div>
  );
}

function formatActivityDuration(durationMs: number | undefined): string {
  return durationMs === undefined ? "unknown" : formatDuration(durationMs);
}

function FileChangeActivityDetails(props: {
  workEntry: WorkLogEntry;
  workspaceRoot: string | undefined;
}) {
  const renderablePatch = getRenderablePatch(
    props.workEntry.patch,
    `timeline-activity:${props.workEntry.id}`,
  );
  const patchText = serializeRenderablePatchText(renderablePatch);

  return (
    <div className="mt-1.5 ms-6 space-y-2 border-s border-[color:var(--app-work-row-border)] ps-3 pt-0.5">
      {(props.workEntry.changedFiles?.length ?? 0) > 0 ? (
        <div className="flex flex-wrap gap-1">
          {props.workEntry.changedFiles?.map((filePath) => {
            const displayPath = formatWorkspaceRelativePath(filePath, props.workspaceRoot);
            return (
              <span
                key={`${props.workEntry.id}:changed-file:${filePath}`}
                className="rounded-md border border-[color:var(--app-work-row-border)] bg-[var(--app-work-row-bg)] px-1.5 py-0.5 font-chat-code text-[10px] text-[var(--app-metadata-muted-fg)]"
                title={displayPath}
              >
                {displayPath}
              </span>
            );
          })}
        </div>
      ) : null}
      {patchText ? (
        <ActivityDetailBlock title={renderablePatch?.kind === "raw" ? "Patch" : "Diff"} mono>
          {patchText}
        </ActivityDetailBlock>
      ) : null}
    </div>
  );
}

function ActivityDetailBlock(props: {
  title: string;
  children: string;
  mono?: boolean;
  tone?: "default" | "error";
}) {
  return (
    <div className="space-y-1">
      <p className="text-[9px] font-medium uppercase tracking-[0.14em] text-[var(--app-metadata-muted-fg)]">
        {props.title}
      </p>
      <div
        className={cn(
          "max-h-80 overflow-auto rounded-md border border-[color:var(--app-work-row-border)] bg-[var(--app-work-row-bg)] px-2 py-1.5 text-[11px] leading-5 text-[var(--app-metadata-fg)]",
          props.mono ? "font-chat-code whitespace-pre-wrap break-words" : null,
          props.tone === "error"
            ? "border-[color:var(--app-status-error-border)] bg-[var(--app-status-error-bg)] text-[var(--app-status-error-fg)]"
            : null,
        )}
      >
        {props.children}
      </div>
    </div>
  );
}

function CommandOutputBlock(props: { title: string; value: string; tone?: "default" | "error" }) {
  const output = getVisibleCommandOutputLines(props.value);
  return (
    <div className="space-y-1">
      {output.hiddenLineCount > 0 ? (
        <p className="text-[10px] text-[var(--app-metadata-muted-fg)]">
          Showing last {output.lines.length} lines; {output.hiddenLineCount} earlier lines hidden.
        </p>
      ) : null}
      <ActivityDetailBlock title={props.title} mono {...(props.tone ? { tone: props.tone } : {})}>
        {output.lines.join("\n")}
      </ActivityDetailBlock>
    </div>
  );
}
