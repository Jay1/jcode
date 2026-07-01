import type { LegendListRef } from "@legendapp/list/react";
import type { RefObject } from "react";
import { useMemo } from "react";

import type { MessagesTimelineRow } from "./MessagesTimeline.logic";

const TIMELINE_MINIMAP_MIN_ITEMS = 2;
const TIMELINE_MINIMAP_PREVIEW_MAX_CHARS = 96;
const TIMELINE_MINIMAP_VIEW_OFFSET_PX = 24;

export interface TimelineMinimapItem {
  readonly id: string;
  readonly label: string;
  readonly rowIndex: number;
  readonly preview: string | null;
}

export interface TimelineMinimapScrollRequest {
  readonly index: number;
  readonly animated: true;
  readonly viewOffset: number;
}

export function deriveTimelineMinimapItems(
  rows: ReadonlyArray<MessagesTimelineRow>,
): TimelineMinimapItem[] {
  const items: TimelineMinimapItem[] = [];

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    if (!row) continue;

    if (row.kind === "message" && row.message.role === "user") {
      items.push({
        id: row.id,
        label: compactMinimapText(row.message.text) ?? "User message",
        rowIndex,
        preview: resolveAssistantPreviewForUserTurn(rows, rowIndex),
      });
      continue;
    }

    if (row.kind === "proposed-plan") {
      items.push({
        id: row.id,
        label: compactMinimapText(row.proposedPlan.planMarkdown) ?? "Proposed plan",
        rowIndex,
        preview: "Proposed plan",
      });
    }
  }

  return items;
}

export function getTimelineMinimapScrollRequest(
  item: TimelineMinimapItem,
): TimelineMinimapScrollRequest {
  return {
    index: item.rowIndex,
    animated: true,
    viewOffset: TIMELINE_MINIMAP_VIEW_OFFSET_PX,
  };
}

export function TimelineMinimap({
  rows,
  onJump,
}: {
  readonly rows: ReadonlyArray<MessagesTimelineRow>;
  readonly onJump: (item: TimelineMinimapItem) => void;
}) {
  const items = useMemo(() => deriveTimelineMinimapItems(rows), [rows]);
  if (items.length < TIMELINE_MINIMAP_MIN_ITEMS) {
    return null;
  }

  const maxIndex = Math.max(1, items.length - 1);

  return (
    <nav
      aria-label="Timeline jumps"
      className="pointer-events-none absolute top-1/2 left-2 z-20 hidden h-45 w-12 -translate-y-1/2 md:block"
      data-testid="timeline-minimap"
    >
      <div className="absolute top-0 left-3 h-full w-px bg-[var(--app-transcript-stage-border)] opacity-70" />
      {items.map((item, index) => {
        const top = `${(index / maxIndex) * 100}%`;
        return (
          <button
            key={item.id}
            type="button"
            aria-label={`Jump to ${item.label}`}
            className="group pointer-events-auto absolute left-0 flex h-5 w-12 -translate-y-1/2 items-center rounded-md outline-none transition-transform duration-150 hover:translate-x-0.5 focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            style={{ top }}
            onClick={() => onJump(item)}
          >
            <span className="h-1 w-3 rounded-full bg-[var(--app-metadata-muted-fg)] opacity-55 transition-all duration-150 group-hover:w-8 group-hover:bg-[var(--app-metadata-fg)] group-hover:opacity-90 group-focus-visible:w-8 group-focus-visible:bg-[var(--app-metadata-fg)] group-focus-visible:opacity-90" />
            <span className="pointer-events-none absolute top-1/2 left-9 hidden w-72 -translate-y-1/2 rounded-xl border border-[color:var(--app-work-row-border)] bg-[var(--app-work-row-bg)] px-3 py-2 text-left text-[var(--app-metadata-fg)] shadow-sm backdrop-blur-sm group-hover:block group-focus-visible:block">
              <span className="block truncate font-system-ui text-xs font-medium">
                {item.label}
              </span>
              {item.preview ? (
                <span className="mt-1 block line-clamp-2 font-system-ui text-[11px] text-[var(--app-metadata-muted-fg)]">
                  {item.preview}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

export function jumpToTimelineMinimapItem(
  listRef: RefObject<LegendListRef | null>,
  item: TimelineMinimapItem,
): void {
  void listRef.current?.scrollToIndex(getTimelineMinimapScrollRequest(item));
}

function resolveAssistantPreviewForUserTurn(
  rows: ReadonlyArray<MessagesTimelineRow>,
  userRowIndex: number,
): string | null {
  let assistantText: string | null = null;

  for (let rowIndex = userRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    if (!row) continue;
    if (row.kind === "message" && row.message.role === "user") break;
    if (row.kind === "proposed-plan") break;
    if (row.kind === "message" && row.message.role === "assistant") {
      assistantText = row.message.text;
    }
  }

  return compactMinimapText(assistantText);
}

function compactMinimapText(value: string | null | undefined): string | null {
  const compact = value?.replace(/\s+/gu, " ").trim() ?? "";
  if (compact.length === 0) {
    return null;
  }
  if (compact.length <= TIMELINE_MINIMAP_PREVIEW_MAX_CHARS) {
    return compact;
  }
  return `${compact.slice(0, TIMELINE_MINIMAP_PREVIEW_MAX_CHARS - 3).trimEnd()}...`;
}
