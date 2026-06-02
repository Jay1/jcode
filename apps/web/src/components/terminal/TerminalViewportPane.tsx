// FILE: TerminalViewportPane.tsx
// Purpose: Renders the active terminal pane tree with nested splits and pane-local tab strips.
// Layer: Terminal presentation components
// Depends on: caller-provided viewport renderer so xterm lifecycle can stay external.

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

import type { ResolvedTerminalVisualIdentity } from "@jcode/shared/terminalThreads";

import {
  Maximize2,
  Minimize2,
  Plus,
  SquareSplitHorizontal,
  SquareSplitVertical,
  TerminalSquareIcon,
  Trash2,
  XIcon,
} from "~/lib/icons";
import { cn } from "~/lib/utils";

import type {
  ThreadTerminalLayoutNode,
  ThreadTerminalPresentationMode,
  ThreadTerminalSplitNode,
} from "../../types";
import TerminalActivityIndicator from "./TerminalActivityIndicator";
import TerminalIdentityIcon from "./TerminalIdentityIcon";

const MIN_TERMINAL_PANE_SIZE_PX = 180;

interface TerminalViewportPaneProps {
  groupId: string;
  layout: ThreadTerminalLayoutNode;
  resolvedActiveTerminalId: string;
  terminalVisualIdentityById: ReadonlyMap<string, ResolvedTerminalVisualIdentity>;
  onActiveTerminalChange: (terminalId: string) => void;
  onResizeSplit: (groupId: string, splitId: string, weights: number[]) => void;
  renderViewport: (
    terminalId: string,
    options: { autoFocus: boolean; isVisible: boolean },
  ) => ReactNode;
  onSplitTerminalRight?: ((terminalId: string) => void) | undefined;
  onSplitTerminalDown?: ((terminalId: string) => void) | undefined;
  onNewTerminalTab?: ((terminalId: string) => void) | undefined;
  onMoveTerminalToGroup?: ((terminalId: string) => void) | undefined;
  onCloseTerminal?: ((terminalId: string) => void) | undefined;
  onRenameTerminal?: ((terminalId: string, name: string) => void) | undefined;
  presentationMode: ThreadTerminalPresentationMode;
  onTogglePresentationMode?: (() => void) | undefined;
}

function normalizeWeights(weights: number[]): number[] {
  return weights.map((weight) => (Number.isFinite(weight) && weight > 0 ? weight : 1));
}

function splitHandleClassName(direction: ThreadTerminalSplitNode["direction"]): string {
  return direction === "horizontal"
    ? "shrink-0 w-px cursor-col-resize bg-border/70 hover:bg-[var(--sidebar-accent)]"
    : "shrink-0 h-px cursor-row-resize bg-border/70 hover:bg-[var(--sidebar-accent)]";
}

function canMoveTerminalToOwnGroup(node: ThreadTerminalLayoutNode, terminalId: string): boolean {
  if (node.type === "terminal") {
    return node.activeTerminalId === terminalId && node.terminalIds.length > 1;
  }

  return node.children.some((child) => {
    if (child.type === "terminal") {
      return child.terminalIds.includes(terminalId);
    }
    return canMoveTerminalToOwnGroup(child, terminalId);
  });
}

function InlineRenameField(props: {
  initialValue: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
  className?: string | undefined;
}) {
  const [value, setValue] = useState(props.initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        props.onCommit(value.trim());
      } else if (event.key === "Escape") {
        props.onCancel();
      }
    },
    [value, props],
  );

  const handleBlur = useCallback(() => {
    props.onCommit(value.trim());
  }, [value, props]);

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      className={cn(
        "bg-background px-1.5 py-0.5 text-[11px] leading-4 text-foreground outline-none ring-1 ring-inset ring-[var(--color-ring)]",
        props.className,
      )}
      autoFocus
    />
  );
}

function TerminalTabTitle(props: {
  title: string;
  onRename: (name: string) => void;
  className?: string | undefined;
}) {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <InlineRenameField
        initialValue={props.title}
        onCommit={(value) => {
          setIsEditing(false);
          props.onRename(value);
        }}
        onCancel={() => setIsEditing(false)}
        className={props.className}
      />
    );
  }

  return (
    <span
      className={cn("cursor-pointer select-none", props.className)}
      onDoubleClick={() => setIsEditing(true)}
      title="Double-click to rename"
    >
      {props.title}
    </span>
  );
}

function PaneActionButton(props: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center bg-background text-foreground/80 transition-colors hover:bg-[var(--sidebar-accent)] hover:text-foreground",
        props.className,
      )}
      onClick={(event) => {
        event.stopPropagation();
        props.onClick();
      }}
      aria-label={props.label}
      title={props.label}
    >
      {props.children}
    </button>
  );
}

export default function TerminalViewportPane({
  groupId,
  layout,
  resolvedActiveTerminalId,
  terminalVisualIdentityById,
  onActiveTerminalChange,
  onResizeSplit,
  renderViewport,
  onSplitTerminalRight,
  onSplitTerminalDown,
  onNewTerminalTab,
  onMoveTerminalToGroup,
  onCloseTerminal,
  onRenameTerminal,
  presentationMode,
  onTogglePresentationMode,
}: TerminalViewportPaneProps) {
  const renderNode = (node: ThreadTerminalLayoutNode): ReactNode => {
    if (node.type === "terminal") {
      const activePaneTerminalId = node.terminalIds.includes(node.activeTerminalId)
        ? node.activeTerminalId
        : (node.terminalIds[0] ?? resolvedActiveTerminalId);
      const isFocusedPane = activePaneTerminalId === resolvedActiveTerminalId;
      const canMoveActiveTerminalToGroup =
        !!onMoveTerminalToGroup && canMoveTerminalToOwnGroup(layout, activePaneTerminalId);
      const moveActiveTerminalToGroup = () => {
        if (!onMoveTerminalToGroup) return;
        onMoveTerminalToGroup(activePaneTerminalId);
      };

      return (
        <div
          key={node.paneId}
          className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-background"
          onMouseDown={() => {
            if (!isFocusedPane) {
              onActiveTerminalChange(activePaneTerminalId);
            }
          }}
        >
          <div className="flex h-8 min-h-8 items-stretch bg-background">
            <div className="flex min-w-0 flex-1 items-stretch overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {node.terminalIds.map((terminalId, index) => {
                const visualIdentity = terminalVisualIdentityById.get(terminalId);
                const isActiveTab = terminalId === activePaneTerminalId;
                const closeTabLabel = `Close ${visualIdentity?.title ?? "terminal"}`;

                return (
                  <div
                    key={terminalId}
                    className={cn(
                      "group/tab relative flex h-full shrink-0 items-stretch border-r border-border/70",
                      index === 0 ? "border-l-0" : "",
                      isActiveTab && isFocusedPane
                        ? "shadow-[inset_0_1px_0_var(--color-text-foreground)] bg-background text-foreground"
                        : isActiveTab
                          ? "shadow-[inset_0_1px_0_color-mix(in_srgb,var(--color-text-foreground)_35%,transparent)] bg-background text-foreground"
                          : "border-b border-border/70 bg-muted/25 text-muted-foreground hover:bg-[var(--sidebar-accent)] hover:text-foreground",
                    )}
                  >
                    <button
                      type="button"
                      className="flex min-w-0 items-center gap-1.5 px-2 text-left"
                      onClick={(event) => {
                        event.stopPropagation();
                        onActiveTerminalChange(terminalId);
                      }}
                    >
                      <TerminalIdentityIcon
                        className="size-3 shrink-0"
                        iconKey={visualIdentity?.iconKey ?? "terminal"}
                      />
                      {visualIdentity && visualIdentity.state !== "idle" ? (
                        <TerminalActivityIndicator
                          className="text-foreground/70"
                          state={visualIdentity.state}
                        />
                      ) : null}
                      <TerminalTabTitle
                        title={visualIdentity?.title ?? "Terminal"}
                        onRename={(name) => {
                          if (onRenameTerminal) {
                            onRenameTerminal(terminalId, name);
                          }
                        }}
                        className="max-w-40 truncate text-[11px] leading-4"
                      />
                    </button>
                    {onCloseTerminal ? (
                      <button
                        type="button"
                        className="inline-flex w-6 items-center justify-center text-muted-foreground/80 transition-colors hover:bg-background/60 hover:text-foreground"
                        onClick={(event) => {
                          event.stopPropagation();
                          onCloseTerminal(terminalId);
                        }}
                        aria-label={closeTabLabel}
                        title={closeTabLabel}
                      >
                        <XIcon className="size-3" />
                      </button>
                    ) : null}
                  </div>
                );
              })}

              {onNewTerminalTab ? (
                <PaneActionButton
                  label="New terminal tab"
                  onClick={() => onNewTerminalTab(activePaneTerminalId)}
                  className="h-full shrink-0 border-b border-r border-border/70"
                >
                  <Plus className="size-3.25" />
                </PaneActionButton>
              ) : null}
              <div className="min-w-0 flex-1 border-b border-border/70" />
            </div>

            <div className="flex shrink-0 items-stretch divide-x divide-border/70 border-b border-l border-border/70">
              {canMoveActiveTerminalToGroup ? (
                <PaneActionButton
                  label="Move to its own terminal tab"
                  onClick={moveActiveTerminalToGroup}
                >
                  <TerminalSquareIcon className="size-3.25" />
                </PaneActionButton>
              ) : null}
              {onTogglePresentationMode ? (
                <PaneActionButton
                  label={
                    presentationMode === "workspace"
                      ? "Collapse terminal into chat drawer"
                      : "Expand terminal into workspace"
                  }
                  onClick={onTogglePresentationMode}
                >
                  {presentationMode === "workspace" ? (
                    <Minimize2 className="size-3.25" />
                  ) : (
                    <Maximize2 className="size-3.25" />
                  )}
                </PaneActionButton>
              ) : null}
              {onSplitTerminalRight ? (
                <PaneActionButton
                  label="Split right"
                  onClick={() => onSplitTerminalRight(activePaneTerminalId)}
                >
                  <SquareSplitHorizontal className="size-3.25" />
                </PaneActionButton>
              ) : null}
              {onSplitTerminalDown ? (
                <PaneActionButton
                  label="Split down"
                  onClick={() => onSplitTerminalDown(activePaneTerminalId)}
                >
                  <SquareSplitVertical className="size-3.25" />
                </PaneActionButton>
              ) : null}
              {onCloseTerminal ? (
                <PaneActionButton
                  label="Close active terminal tab"
                  onClick={() => onCloseTerminal(activePaneTerminalId)}
                >
                  <Trash2 className="size-3.25" />
                </PaneActionButton>
              ) : null}
            </div>
          </div>

          <div className="relative min-h-0 min-w-0 flex-1 bg-background">
            {node.terminalIds.map((terminalId) => {
              const isActiveTab = terminalId === activePaneTerminalId;
              return (
                <div
                  key={terminalId}
                  className={cn(
                    "absolute inset-0 min-h-0 min-w-0 transition-opacity",
                    isActiveTab ? "z-[1] opacity-100" : "pointer-events-none z-0 opacity-0",
                  )}
                >
                  {renderViewport(terminalId, {
                    autoFocus: isFocusedPane && isActiveTab,
                    isVisible: isActiveTab,
                  })}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    const weights = normalizeWeights(node.weights);
    const totalWeight =
      weights.reduce((sum, weight) => sum + weight, 0) || node.children.length || 1;

    const beginResize = (
      splitNode: ThreadTerminalSplitNode,
      handleIndex: number,
      event: ReactPointerEvent<HTMLDivElement>,
    ) => {
      event.preventDefault();
      event.stopPropagation();
      const container = event.currentTarget.parentElement;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const totalSize = splitNode.direction === "horizontal" ? rect.width : rect.height;
      if (totalSize <= 0) return;

      const startCoordinate = splitNode.direction === "horizontal" ? event.clientX : event.clientY;
      const startWeights = normalizeWeights(splitNode.weights);
      const currentWeight = startWeights[handleIndex] ?? 1;
      const nextWeight = startWeights[handleIndex + 1] ?? 1;
      const pairWeight = currentWeight + nextWeight;
      const minWeight = Math.max((pairWeight * MIN_TERMINAL_PANE_SIZE_PX) / totalSize, 0.1);

      const onPointerMove = (moveEvent: PointerEvent) => {
        const currentCoordinate =
          splitNode.direction === "horizontal" ? moveEvent.clientX : moveEvent.clientY;
        const delta = currentCoordinate - startCoordinate;
        const deltaWeight = (delta / totalSize) * totalWeight;
        const resizedCurrent = Math.min(
          Math.max(currentWeight + deltaWeight, minWeight),
          pairWeight - minWeight,
        );
        const resizedNext = pairWeight - resizedCurrent;
        const nextWeights = [...startWeights];
        nextWeights[handleIndex] = resizedCurrent;
        nextWeights[handleIndex + 1] = resizedNext;
        onResizeSplit(groupId, splitNode.id, nextWeights);
      };

      const onPointerUp = () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp, { once: true });
    };

    return (
      <div
        key={node.id}
        className={cn(
          "flex h-full min-h-0 min-w-0 gap-0 overflow-hidden bg-background",
          node.direction === "horizontal" ? "flex-row" : "flex-col",
        )}
      >
        {node.children.map((child, index) => {
          const childWeight = weights[index] ?? 1;
          return (
            <div key={child.type === "split" ? child.id : child.paneId} className="contents">
              <div
                className="h-full min-h-0 min-w-0"
                style={{
                  flexGrow: childWeight,
                  flexBasis: 0,
                }}
              >
                {renderNode(child)}
              </div>
              {index < node.children.length - 1 ? (
                <div
                  className={splitHandleClassName(node.direction)}
                  onPointerDown={(event) => beginResize(node, index, event)}
                  onDoubleClick={() =>
                    onResizeSplit(
                      groupId,
                      node.id,
                      node.children.map(() => 1),
                    )
                  }
                />
              ) : null}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="h-full min-h-0 min-w-0 overflow-hidden bg-background">{renderNode(layout)}</div>
  );
}
