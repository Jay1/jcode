import { ThreadId } from "@jcode/contracts";
import { describe, expect, it } from "vitest";

import {
  appendVoiceTranscriptToPrompt,
  buildQueuedComposerPreviewText,
  filterSidechatTranscriptMessages,
  type LocalDispatchSnapshot,
  deriveComposerSendState,
  deriveComposerVoiceState,
  describeVoiceRecordingStartError,
  formatOutgoingPrompt,
  hasServerAcknowledgedLocalDispatch,
  isVoiceAuthExpiredMessage,
  mergeDynamicModelOptions,
  providerMentionReferencesEqual,
  promptIncludesSkillMention,
  resolveActiveThreadTitle,
  resolvePromptPluginMentions,
  sanitizeVoiceErrorMessage,
  buildExpiredTerminalContextToastCopy,
  shouldAutoDeleteTerminalThreadOnLastClose,
  shouldConsumePendingCustomBinaryConfirmation,
  shouldShowComposerModelBootstrapSkeleton,
  shouldStartActiveTurnLayoutGrace,
  shouldRenderTerminalWorkspace,
  syncTerminalContextsByIds,
  terminalContextIdListsEqual,
} from "./ChatView.logic";

describe("voice helpers", () => {
  it("keeps manual titles visible for empty home chats", () => {
    expect(
      resolveActiveThreadTitle({
        title: "Roadmap scratchpad",
        subagentTitle: null,
        isHomeChat: true,
        isEmpty: true,
      }),
    ).toBe("Roadmap scratchpad");
  });

  it("maps untouched empty home chats to the friendly header label", () => {
    expect(
      resolveActiveThreadTitle({
        title: "New thread",
        subagentTitle: null,
        isHomeChat: true,
        isEmpty: true,
      }),
    ).toBe("New Chat");
  });

  it("prefers the resolved subagent label when present", () => {
    expect(
      resolveActiveThreadTitle({
        title: "Ignored raw title",
        subagentTitle: "Reviewer / Fix follow-up",
        isHomeChat: false,
        isEmpty: false,
      }),
    ).toBe("Reviewer / Fix follow-up");
  });

  it("hides fork-imported transcript rows only for sidechats", () => {
    const messages = [
      {
        id: "message-imported" as never,
        role: "assistant",
        text: "Previous context",
        turnId: null,
        streaming: false,
        source: "fork-import",
        createdAt: "2026-05-02T10:00:00.000Z",
        completedAt: "2026-05-02T10:00:00.000Z",
      },
      {
        id: "message-native" as never,
        role: "user",
        text: "Fresh side question",
        turnId: null,
        streaming: false,
        source: "native",
        createdAt: "2026-05-02T10:01:00.000Z",
        completedAt: "2026-05-02T10:01:00.000Z",
      },
    ] as const;

    expect(filterSidechatTranscriptMessages(messages, true).map((message) => message.id)).toEqual([
      "message-native",
    ]);
    expect(filterSidechatTranscriptMessages(messages, false).map((message) => message.id)).toEqual([
      "message-imported",
      "message-native",
    ]);
  });

  it("appends a transcript to the existing prompt without disturbing spacing", () => {
    expect(appendVoiceTranscriptToPrompt("Hello there   ", "  next line  ")).toBe(
      "Hello there\nnext line",
    );
  });

  it("returns null when the transcript is empty", () => {
    expect(appendVoiceTranscriptToPrompt("Hello", "   ")).toBeNull();
  });

  it("sanitizes inline stack traces from voice errors", () => {
    expect(
      sanitizeVoiceErrorMessage(
        "Your ChatGPT login has expired. Sign in again. at file:///Users/test/app.mjs:12:3",
      ),
    ).toBe("Your ChatGPT login has expired. Sign in again.");
  });

  it("strips desktop bridge wrappers from voice errors", () => {
    expect(
      sanitizeVoiceErrorMessage(
        "Error invoking remote method 'desktop:server-transcribe-voice': Error: The transcription response did not include any text.",
      ),
    ).toBe("The transcription response did not include any text.");
  });

  it("detects auth-expired copy in sanitized voice errors", () => {
    expect(isVoiceAuthExpiredMessage("Sign in again to ChatGPT")).toBe(true);
    expect(isVoiceAuthExpiredMessage("The microphone could not be opened.")).toBe(false);
  });

  it("maps microphone permission errors to clearer copy", () => {
    const error = new Error("Permission denied");
    error.name = "NotAllowedError";

    expect(describeVoiceRecordingStartError(error)).toContain("Microphone access was denied");
  });

  it("derives voice-note availability from provider auth and runtime state", () => {
    expect(
      deriveComposerVoiceState({
        authStatus: "authenticated",
        voiceTranscriptionAvailable: true,
        isRecording: false,
        isTranscribing: false,
      }),
    ).toEqual({
      canRenderVoiceNotes: true,
      canStartVoiceNotes: true,
      showVoiceNotesControl: true,
    });

    expect(
      deriveComposerVoiceState({
        authStatus: "unauthenticated",
        voiceTranscriptionAvailable: true,
        isRecording: true,
        isTranscribing: false,
      }),
    ).toEqual({
      canRenderVoiceNotes: false,
      canStartVoiceNotes: false,
      showVoiceNotesControl: true,
    });
  });
});

describe("shouldShowComposerModelBootstrapSkeleton", () => {
  it("shows a skeleton while a provider requires runtime-discovered models", () => {
    expect(
      shouldShowComposerModelBootstrapSkeleton({
        selectedProvider: "cursor",
        selectedModel: "auto",
        persistedModelSelection: null,
        draftModelSelection: null,
        providerModelsLoading: true,
        requiresDiscoveredModels: true,
      }),
    ).toBe(true);
  });

  it("hides the skeleton for a provider requiring discovered models after loading completes", () => {
    expect(
      shouldShowComposerModelBootstrapSkeleton({
        selectedProvider: "cursor",
        selectedModel: "auto",
        persistedModelSelection: null,
        draftModelSelection: null,
        providerModelsLoading: false,
        requiresDiscoveredModels: true,
      }),
    ).toBe(false);
  });

  it("shows a skeleton while provider discovery is still resolving a persisted thread model", () => {
    expect(
      shouldShowComposerModelBootstrapSkeleton({
        selectedProvider: "opencode",
        selectedModel: "openai/gpt-5-codex",
        persistedModelSelection: {
          provider: "opencode",
          model: "openai/gpt-5.4",
        },
        draftModelSelection: null,
        providerModelsLoading: true,
      }),
    ).toBe(true);
  });

  it("hides the skeleton once the persisted thread model is already selected", () => {
    expect(
      shouldShowComposerModelBootstrapSkeleton({
        selectedProvider: "opencode",
        selectedModel: "openai/gpt-5.4",
        persistedModelSelection: {
          provider: "opencode",
          model: "openai/gpt-5.4",
        },
        draftModelSelection: null,
        providerModelsLoading: true,
      }),
    ).toBe(false);
  });

  it("prefers an explicit draft selection over persisted thread state", () => {
    expect(
      shouldShowComposerModelBootstrapSkeleton({
        selectedProvider: "opencode",
        selectedModel: "opencode/minimax-m2.5-free",
        persistedModelSelection: {
          provider: "opencode",
          model: "openai/gpt-5.4",
        },
        draftModelSelection: {
          provider: "opencode",
          model: "opencode/minimax-m2.5-free",
        },
        providerModelsLoading: true,
      }),
    ).toBe(false);
  });

  it("shows a skeleton when the provisional provider does not match the persisted thread provider", () => {
    expect(
      shouldShowComposerModelBootstrapSkeleton({
        selectedProvider: "codex",
        selectedModel: "gpt-5.4",
        persistedModelSelection: {
          provider: "opencode",
          model: "openai/gpt-5.4",
        },
        draftModelSelection: null,
        providerModelsLoading: false,
      }),
    ).toBe(true);
  });
});

describe("shouldConsumePendingCustomBinaryConfirmation", () => {
  it("still processes a pending path for a session that was already checked", () => {
    expect(
      shouldConsumePendingCustomBinaryConfirmation({
        sessionAlreadyChecked: true,
        pendingCustomBinaryPath: "/custom/bin/opencode",
      }),
    ).toBe(true);
  });

  it("skips already checked sessions when there is no pending path to confirm", () => {
    expect(
      shouldConsumePendingCustomBinaryConfirmation({
        sessionAlreadyChecked: true,
        pendingCustomBinaryPath: null,
      }),
    ).toBe(false);
  });
});

describe("deriveComposerSendState", () => {
  it("treats expired terminal pills as non-sendable content", () => {
    const state = deriveComposerSendState({
      prompt: "\uFFFC",
      imageCount: 0,
      assistantSelectionCount: 0,
      terminalContexts: [
        {
          id: "ctx-expired",
          threadId: ThreadId.makeUnsafe("thread-1"),
          terminalId: "default",
          terminalLabel: "Terminal 1",
          lineStart: 4,
          lineEnd: 4,
          text: "",
          createdAt: "2026-03-17T12:52:29.000Z",
        },
      ],
    });

    expect(state.trimmedPrompt).toBe("");
    expect(state.sendableTerminalContexts).toEqual([]);
    expect(state.expiredTerminalContextCount).toBe(1);
    expect(state.hasSendableContent).toBe(false);
  });

  it("keeps text sendable while excluding expired terminal pills", () => {
    const state = deriveComposerSendState({
      prompt: `yoo \uFFFC waddup`,
      imageCount: 0,
      assistantSelectionCount: 0,
      terminalContexts: [
        {
          id: "ctx-expired",
          threadId: ThreadId.makeUnsafe("thread-1"),
          terminalId: "default",
          terminalLabel: "Terminal 1",
          lineStart: 4,
          lineEnd: 4,
          text: "",
          createdAt: "2026-03-17T12:52:29.000Z",
        },
      ],
    });

    expect(state.trimmedPrompt).toBe("yoo  waddup");
    expect(state.expiredTerminalContextCount).toBe(1);
    expect(state.hasSendableContent).toBe(true);
  });

  it("treats assistant selections as sendable content", () => {
    const state = deriveComposerSendState({
      prompt: "",
      imageCount: 0,
      assistantSelectionCount: 1,
      terminalContexts: [],
    });

    expect(state.hasSendableContent).toBe(true);
  });
});

describe("buildExpiredTerminalContextToastCopy", () => {
  it("formats clear empty-state guidance", () => {
    expect(buildExpiredTerminalContextToastCopy(1, "empty")).toEqual({
      title: "Expired terminal context won't be sent",
      description: "Remove it or re-add it to include terminal output.",
    });
  });

  it("formats omission guidance for sent messages", () => {
    expect(buildExpiredTerminalContextToastCopy(2, "omitted")).toEqual({
      title: "Expired terminal contexts omitted from message",
      description: "Re-add it if you want that terminal output included.",
    });
  });
});

describe("queued composer preview helpers", () => {
  it("prefers prompt text before attachment fallbacks", () => {
    expect(
      buildQueuedComposerPreviewText({
        trimmedPrompt: "Ship the patch",
        images: [{ name: "ignored.png" } as never],
        assistantSelections: [{ id: "assistant-1" }],
        terminalContexts: [],
      }),
    ).toBe("Ship the patch");
  });

  it("falls back through images, assistant selections, terminal contexts, then generic copy", () => {
    const terminalContext = {
      id: "ctx-1",
      threadId: ThreadId.makeUnsafe("thread-1"),
      terminalId: "default",
      terminalLabel: "Terminal 1",
      lineStart: 4,
      lineEnd: 6,
      text: "bun test",
      createdAt: "2026-03-17T12:52:29.000Z",
    };

    expect(
      buildQueuedComposerPreviewText({
        trimmedPrompt: "",
        images: [{ name: "screenshot.png" } as never],
        assistantSelections: [],
        terminalContexts: [],
      }),
    ).toBe("Image: screenshot.png");
    expect(
      buildQueuedComposerPreviewText({
        trimmedPrompt: "",
        images: [],
        assistantSelections: [{ id: "assistant-1" }, { id: "assistant-2" }],
        terminalContexts: [],
      }),
    ).toBe("Referenced selections");
    expect(
      buildQueuedComposerPreviewText({
        trimmedPrompt: "",
        images: [],
        assistantSelections: [],
        terminalContexts: [terminalContext],
      }),
    ).toBe("Terminal 1 lines 4-6");
    expect(
      buildQueuedComposerPreviewText({
        trimmedPrompt: "",
        images: [],
        assistantSelections: [],
        terminalContexts: [],
      }),
    ).toBe("Queued follow-up");
  });
});

describe("formatOutgoingPrompt", () => {
  it("leaves non-injected provider prompts unchanged", () => {
    expect(
      formatOutgoingPrompt({
        provider: "opencode",
        model: "gpt-5.1-codex-max",
        effort: "high",
        text: "Implement this",
      }),
    ).toBe("Implement this");
  });

  it("injects supported Claude ultrathink effort into outgoing prompts", () => {
    expect(
      formatOutgoingPrompt({
        provider: "claudeAgent",
        model: "claude-sonnet-4-6",
        effort: "ultrathink",
        text: "Implement this",
      }),
    ).toBe("Ultrathink:\nImplement this");
  });
});

describe("mergeDynamicModelOptions", () => {
  it("deduplicates dynamic models, preserves static names, and appends custom models", () => {
    expect(
      mergeDynamicModelOptions({
        provider: "opencode",
        staticOptions: [
          { slug: "gpt-5.1-codex-max", name: "Static GPT" },
          { slug: "local-model", name: "Local Model", isCustom: true },
        ],
        dynamicModels: [
          { slug: "gpt-5.1-codex-max", name: "Dynamic GPT" },
          { slug: "gpt-5.1-codex-max", name: "Duplicate GPT" },
          { slug: "anthropic/claude-sonnet-4-5", name: "Claude Sonnet 4.5" },
        ],
      }),
    ).toEqual([
      { slug: "gpt-5.1-codex-max", name: "Static GPT" },
      { slug: "anthropic/claude-sonnet-4-5", name: "Claude Sonnet 4.5" },
      { slug: "local-model", name: "Local Model", isCustom: true },
    ]);
  });

  it("drops Claude default aliases and reverses discovered Claude model order", () => {
    expect(
      mergeDynamicModelOptions({
        provider: "claudeAgent",
        staticOptions: [{ slug: "claude-sonnet-4-5", name: "Sonnet" }],
        dynamicModels: [
          { slug: "default", name: "Default (recommended)" },
          { slug: "claude-opus-4-1", name: "Claude Opus 4.1" },
          { slug: "claude-sonnet-4-5[1m]", name: "Claude Sonnet 4.5" },
        ],
      }),
    ).toEqual([
      { slug: "claude-sonnet-4-5", name: "Sonnet" },
      { slug: "claude-opus-4-1", name: "Claude Opus 4.1" },
    ]);
  });
});

describe("resolvePromptPluginMentions", () => {
  const existingMentions = [
    { name: "Review", path: "plugins/review" },
    { name: "Review", path: "plugins/review-alt" },
  ];

  it("matches skill mentions with provider-specific prefixes", () => {
    expect(promptIncludesSkillMention("use $review please", "review", "opencode")).toBe(true);
    expect(promptIncludesSkillMention("use /skill:review please", "review", "pi")).toBe(true);
    expect(promptIncludesSkillMention("use $reviewer please", "review", "opencode")).toBe(false);
  });

  it("reuses existing mentions before discovered unambiguous mentions", () => {
    expect(
      resolvePromptPluginMentions({
        prompt: "@review @deploy",
        existingMentions,
        providerPlugins: [
          {
            plugin: { name: "Deploy" } as never,
            mention: { name: "Deploy", path: "plugins/deploy" },
          },
        ],
      }),
    ).toEqual([
      { name: "Review", path: "plugins/review" },
      { name: "Deploy", path: "plugins/deploy" },
    ]);
  });

  it("skips duplicate prompt mentions and ambiguous discovered plugins", () => {
    expect(
      resolvePromptPluginMentions({
        prompt: "@review @review @deploy",
        existingMentions,
        providerPlugins: [
          {
            plugin: { name: "Deploy" } as never,
            mention: { name: "Deploy", path: "plugins/deploy" },
          },
          {
            plugin: { name: "Deploy" } as never,
            mention: { name: "Deploy", path: "plugins/deploy-alt" },
          },
        ],
      }),
    ).toEqual([{ name: "Review", path: "plugins/review" }]);
  });
});

describe("composer selection equality helpers", () => {
  it("compares provider mention order by visible name and path", () => {
    const mentions = [{ name: "Review", path: "plugins/review" }];

    expect(providerMentionReferencesEqual(mentions, [{ name: "Review", path: "plugins/review" }])).toBe(
      true,
    );
    expect(providerMentionReferencesEqual(mentions, [{ name: "Deploy", path: "plugins/review" }])).toBe(
      false,
    );
  });

  it("syncs terminal context selections by id order", () => {
    const contexts = [
      {
        id: "ctx-a",
        threadId: ThreadId.makeUnsafe("thread-1"),
        terminalId: "default",
        terminalLabel: "Terminal 1",
        lineStart: 1,
        lineEnd: 1,
        text: "a",
        createdAt: "2026-03-17T12:52:29.000Z",
      },
      {
        id: "ctx-b",
        threadId: ThreadId.makeUnsafe("thread-1"),
        terminalId: "default",
        terminalLabel: "Terminal 1",
        lineStart: 2,
        lineEnd: 2,
        text: "b",
        createdAt: "2026-03-17T12:53:29.000Z",
      },
    ];

    expect(syncTerminalContextsByIds(contexts, ["ctx-b", "missing", "ctx-a"])).toEqual([
      contexts[1],
      contexts[0],
    ]);
    expect(terminalContextIdListsEqual([contexts[1]!, contexts[0]!], ["ctx-b", "ctx-a"])).toBe(
      true,
    );
    expect(terminalContextIdListsEqual([contexts[0]!, contexts[1]!], ["ctx-b", "ctx-a"])).toBe(
      false,
    );
  });
});

describe("shouldRenderTerminalWorkspace", () => {
  it("requires an active project to render workspace mode", () => {
    expect(
      shouldRenderTerminalWorkspace({
        activeProjectExists: false,
        presentationMode: "workspace",
        terminalOpen: true,
      }),
    ).toBe(false);
  });

  it("renders only for an open workspace terminal", () => {
    expect(
      shouldRenderTerminalWorkspace({
        activeProjectExists: true,
        presentationMode: "workspace",
        terminalOpen: true,
      }),
    ).toBe(true);
    expect(
      shouldRenderTerminalWorkspace({
        activeProjectExists: true,
        presentationMode: "drawer",
        terminalOpen: true,
      }),
    ).toBe(false);
  });
});

describe("shouldStartActiveTurnLayoutGrace", () => {
  it("starts the grace window when a live turn just became settled", () => {
    expect(
      shouldStartActiveTurnLayoutGrace({
        previousTurnLayoutLive: true,
        currentTurnLayoutLive: false,
        latestTurnStartedAt: "2026-04-13T00:00:00.000Z",
      }),
    ).toBe(true);
  });

  it("does not start the grace window for already-idle threads", () => {
    expect(
      shouldStartActiveTurnLayoutGrace({
        previousTurnLayoutLive: false,
        currentTurnLayoutLive: false,
        latestTurnStartedAt: "2026-04-13T00:00:00.000Z",
      }),
    ).toBe(false);
  });

  it("does not start the grace window while work is still live", () => {
    expect(
      shouldStartActiveTurnLayoutGrace({
        previousTurnLayoutLive: true,
        currentTurnLayoutLive: true,
        latestTurnStartedAt: "2026-04-13T00:00:00.000Z",
      }),
    ).toBe(false);
  });

  it("does not start the grace window when the turn never started", () => {
    expect(
      shouldStartActiveTurnLayoutGrace({
        previousTurnLayoutLive: true,
        currentTurnLayoutLive: false,
        latestTurnStartedAt: null,
      }),
    ).toBe(false);
  });
});

describe("hasServerAcknowledgedLocalDispatch", () => {
  const localDispatch: LocalDispatchSnapshot = {
    startedAt: "2026-04-13T00:00:00.000Z",
    preparingWorktree: false,
    latestTurnTurnId: null,
    latestTurnRequestedAt: null,
    latestTurnStartedAt: null,
    latestTurnCompletedAt: null,
    sessionOrchestrationStatus: "ready",
    sessionUpdatedAt: "2026-04-13T00:00:00.000Z",
  };
  const firstTurnLocalDispatch: LocalDispatchSnapshot = {
    startedAt: "2026-04-13T00:00:00.000Z",
    preparingWorktree: false,
    latestTurnTurnId: null,
    latestTurnRequestedAt: null,
    latestTurnStartedAt: null,
    latestTurnCompletedAt: null,
    sessionOrchestrationStatus: null,
    sessionUpdatedAt: null,
  };

  it("stays pending until the server-side thread/session snapshot changes", () => {
    expect(
      hasServerAcknowledgedLocalDispatch({
        localDispatch,
        phase: "ready",
        latestTurn: null,
        session: {
          provider: "codex",
          status: "ready",
          orchestrationStatus: "ready",
          createdAt: "2026-04-13T00:00:00.000Z",
          updatedAt: "2026-04-13T00:00:00.000Z",
        },
        hasPendingApproval: false,
        hasPendingUserInput: false,
        threadError: null,
      }),
    ).toBe(false);
  });

  it("acknowledges the local send once the latest turn snapshot changes", () => {
    expect(
      hasServerAcknowledgedLocalDispatch({
        localDispatch,
        phase: "ready",
        latestTurn: {
          turnId: "turn-1" as never,
          state: "running",
          requestedAt: "2026-04-13T00:00:01.000Z",
          startedAt: null,
          completedAt: null,
          assistantMessageId: null,
          sourceProposedPlan: undefined,
        },
        session: {
          provider: "codex",
          status: "ready",
          orchestrationStatus: "ready",
          createdAt: "2026-04-13T00:00:00.000Z",
          updatedAt: "2026-04-13T00:00:01.000Z",
        },
        hasPendingApproval: false,
        hasPendingUserInput: false,
        threadError: null,
      }),
    ).toBe(true);
  });

  it("keeps the first-turn optimistic timer alive through a null-to-ready session bootstrap", () => {
    expect(
      hasServerAcknowledgedLocalDispatch({
        localDispatch: firstTurnLocalDispatch,
        phase: "ready",
        latestTurn: null,
        session: {
          provider: "claudeAgent",
          status: "ready",
          orchestrationStatus: "ready",
          createdAt: "2026-04-13T00:00:00.000Z",
          updatedAt: "2026-04-13T00:00:01.000Z",
        },
        hasPendingApproval: false,
        hasPendingUserInput: false,
        threadError: null,
      }),
    ).toBe(false);
  });

  it("still acknowledges non-ready session transitions without a latest turn snapshot", () => {
    expect(
      hasServerAcknowledgedLocalDispatch({
        localDispatch: firstTurnLocalDispatch,
        phase: "disconnected",
        latestTurn: null,
        session: null,
        hasPendingApproval: false,
        hasPendingUserInput: false,
        threadError: "provider failed",
      }),
    ).toBe(true);
  });
});

describe("shouldAutoDeleteTerminalThreadOnLastClose", () => {
  it("deletes untouched terminal-first placeholder threads when the last terminal closes", () => {
    expect(
      shouldAutoDeleteTerminalThreadOnLastClose({
        isLastTerminal: true,
        isServerThread: true,
        terminalEntryPoint: "terminal",
        thread: {
          title: "New terminal",
          messages: [],
          latestTurn: null,
          session: null,
          activities: [],
          proposedPlans: [],
        },
      }),
    ).toBe(true);
  });

  it("keeps non-placeholder or already-used threads", () => {
    expect(
      shouldAutoDeleteTerminalThreadOnLastClose({
        isLastTerminal: true,
        isServerThread: true,
        terminalEntryPoint: "terminal",
        thread: {
          title: "Manual rename",
          messages: [],
          latestTurn: null,
          session: null,
          activities: [],
          proposedPlans: [],
        },
      }),
    ).toBe(false);

    expect(
      shouldAutoDeleteTerminalThreadOnLastClose({
        isLastTerminal: true,
        isServerThread: true,
        terminalEntryPoint: "terminal",
        thread: {
          title: "New terminal",
          messages: [
            {
              id: "msg-1" as never,
              role: "user",
              text: "hello",
              createdAt: "2026-04-06T12:00:00.000Z",
              streaming: false,
            },
          ],
          latestTurn: null,
          session: null,
          activities: [],
          proposedPlans: [],
        },
      }),
    ).toBe(false);
  });
});
