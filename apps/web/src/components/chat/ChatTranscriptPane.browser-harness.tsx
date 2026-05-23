import { MessageId } from "@jcode/contracts";
import { type LegendListRef } from "@legendapp/list/react";
import { Profiler, useCallback, useRef, useState, type ProfilerOnRenderCallback } from "react";

import { ChatTranscriptPane } from "./ChatTranscriptPane";
import { useTranscriptAssistantSelectionAction } from "./useTranscriptAssistantSelectionAction";

const EMPTY_WORK_GROUPS: Record<string, boolean> = {};
const EMPTY_TURN_DIFFS = new Map();
const EMPTY_REVERT_COUNTS = new Map();
const NOOP = () => {};
const TIMELINE_ENTRIES = [
  {
    id: "assistant-message-entry",
    kind: "message" as const,
    createdAt: "2026-03-17T19:12:28.000Z",
    message: {
      id: MessageId.makeUnsafe("assistant-message-1"),
      role: "assistant" as const,
      text: "This is a stable assistant message for the transcript perf harness.",
      createdAt: "2026-03-17T19:12:28.000Z",
      streaming: false,
    },
  },
];

export function TranscriptPerfHarness(props: { onTranscriptRender: () => void }) {
  const [composerValue, setComposerValue] = useState("");
  const composerImagesRef = useRef<readonly []>([]);
  const composerAssistantSelectionsRef = useRef<readonly []>([]);
  const listRef = useRef<LegendListRef | null>(null);
  const {
    onMessagesClickCapture,
    onMessagesMouseUp,
    onMessagesPointerCancel,
    onMessagesPointerDown,
    onMessagesPointerUp,
    onMessagesScroll,
    onMessagesTouchEnd,
    onMessagesTouchMove,
    onMessagesTouchStart,
    onMessagesWheel,
  } = useTranscriptAssistantSelectionAction({
    threadId: "thread-transcript-perf",
    enabled: true,
    composerImagesRef,
    composerAssistantSelectionsRef,
    addComposerAssistantSelectionToDraft: () => true,
    scheduleComposerFocus: NOOP,
    onMessagesClickCaptureBase: NOOP,
    onMessagesPointerCancelBase: NOOP,
    onMessagesPointerDownBase: NOOP,
    onMessagesPointerUpBase: NOOP,
    onMessagesScrollBase: NOOP,
    onMessagesTouchEndBase: NOOP,
    onMessagesTouchMoveBase: NOOP,
    onMessagesTouchStartBase: NOOP,
    onMessagesWheelBase: NOOP,
  });
  const handleComposerChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setComposerValue(event.target.value);
  }, []);
  const handleTranscriptRender = useCallback<ProfilerOnRenderCallback>(() => {
    props.onTranscriptRender();
  }, [props]);

  return (
    <div>
      <label htmlFor="composer-input">Composer</label>
      <input
        id="composer-input"
        aria-label="Composer"
        placeholder="Type composer text"
        value={composerValue}
        onChange={handleComposerChange}
      />
      <Profiler id="chat-transcript-pane" onRender={handleTranscriptRender}>
        <ChatTranscriptPane
          activeThreadId="thread-transcript-perf"
          activeTurnInProgress={false}
          activeTurnStartedAt={null}
          chatFontSizePx={15}
          completionDividerBeforeEntryId={null}
          completionSummary={null}
          emptyStateProjectName={undefined}
          expandedWorkGroups={EMPTY_WORK_GROUPS}
          hasMessages
          isRevertingCheckpoint={false}
          isWorking={false}
          followLiveOutput={false}
          listRef={listRef}
          markdownCwd={undefined}
          onExpandTimelineImage={NOOP}
          onMessagesClickCapture={onMessagesClickCapture}
          onMessagesMouseUp={onMessagesMouseUp}
          onMessagesPointerCancel={onMessagesPointerCancel}
          onMessagesPointerDown={onMessagesPointerDown}
          onMessagesPointerUp={onMessagesPointerUp}
          onMessagesScroll={onMessagesScroll}
          onMessagesTouchEnd={onMessagesTouchEnd}
          onMessagesTouchMove={onMessagesTouchMove}
          onMessagesTouchStart={onMessagesTouchStart}
          onMessagesWheel={onMessagesWheel}
          onIsAtEndChange={NOOP}
          onOpenTurnDiff={NOOP}
          onOpenThread={NOOP}
          onRevertUserMessage={NOOP}
          onScrollToBottom={NOOP}
          onToggleWorkGroup={NOOP}
          resolvedTheme="dark"
          revertTurnCountByUserMessageId={EMPTY_REVERT_COUNTS}
          scrollButtonVisible={false}
          terminalWorkspaceTerminalTabActive={false}
          timelineEntries={TIMELINE_ENTRIES}
          timestampFormat="locale"
          turnDiffSummaryByAssistantMessageId={EMPTY_TURN_DIFFS}
          workspaceRoot={undefined}
        />
      </Profiler>
    </div>
  );
}

export function CollapsedUserMessageHarness(props: { longUserText: string }) {
  return (
    <ChatTranscriptPane
      activeThreadId="thread-user-message-expand"
      activeTurnInProgress={false}
      activeTurnStartedAt={null}
      chatFontSizePx={15}
      completionDividerBeforeEntryId={null}
      completionSummary={null}
      emptyStateProjectName={undefined}
      hasMessages
      isRevertingCheckpoint={false}
      isWorking={false}
      followLiveOutput={false}
      listRef={{ current: null }}
      markdownCwd={undefined}
      onExpandTimelineImage={NOOP}
      onMessagesClickCapture={NOOP}
      onMessagesMouseUp={NOOP}
      onMessagesPointerCancel={NOOP}
      onMessagesPointerDown={NOOP}
      onMessagesPointerUp={NOOP}
      onMessagesScroll={NOOP}
      onMessagesTouchEnd={NOOP}
      onMessagesTouchMove={NOOP}
      onMessagesTouchStart={NOOP}
      onMessagesWheel={NOOP}
      onIsAtEndChange={NOOP}
      onOpenTurnDiff={NOOP}
      onOpenThread={NOOP}
      onRevertUserMessage={NOOP}
      onScrollToBottom={NOOP}
      resolvedTheme="dark"
      revertTurnCountByUserMessageId={EMPTY_REVERT_COUNTS}
      scrollButtonVisible={false}
      terminalWorkspaceTerminalTabActive={false}
      timelineEntries={[
        {
          id: "user-message-entry",
          kind: "message",
          createdAt: "2026-03-17T19:12:28.000Z",
          message: {
            id: MessageId.makeUnsafe("user-message-expand"),
            role: "user",
            text: props.longUserText,
            createdAt: "2026-03-17T19:12:28.000Z",
            streaming: false,
          },
        },
      ]}
      timestampFormat="locale"
      turnDiffSummaryByAssistantMessageId={EMPTY_TURN_DIFFS}
      workspaceRoot={undefined}
    />
  );
}
