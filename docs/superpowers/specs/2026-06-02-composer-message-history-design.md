# Composer Message History Design

| Field           | Value                                                                                                                        |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Status          | Draft                                                                                                                        |
| Type            | Feature design                                                                                                               |
| Owner           | Engineering                                                                                                                  |
| Audience        | Web UI maintainers                                                                                                           |
| Scope           | Keyboard navigation through previously sent messages in the chat composer                                                    |
| Source of truth | `apps/web/src/components/ChatView.tsx`, `apps/web/src/components/ComposerPromptEditor.tsx`, `apps/web/src/composer-logic.ts` |
| Verification    | Focused composer logic tests, web typecheck, browser/manual composer behavior check                                          |

## Goal

Let users press Up and Down in the chat composer to cycle through earlier user messages from the current thread, so they can quickly reuse or copy prompts sent earlier in the conversation.

## Context

`ChatView` owns the active thread, composer draft, prompt ref, cursor state, and send flow. `ComposerPromptEditor` already registers Lexical command handlers for `ArrowUp` and `ArrowDown` and delegates them through `onCommandKeyDown`. That same hook currently drives slash and mention menu navigation, so message history can reuse it without adding global DOM listeners.

## Scope

The first implementation uses current-thread history only. It derives history from persisted `activeThread.messages` and excludes optimistic user messages that have not yet round-tripped from the server. It does not add a cross-thread or day-wide persistent history store.

## Behavior

Pressing Up in the composer navigates to older native user messages when no composer menu is active. Pressing Down navigates toward newer messages. After the newest history entry, Down restores the draft text the user had before starting history navigation.

History navigation only activates when the composer selection is at a boundary that matches normal shell-style expectations: Up at the start of the prompt, and Down at the end of the prompt. This preserves normal multiline cursor movement inside a draft.

When a history entry is applied, the composer prompt becomes the historical message text and the cursor moves to the end. Typing or otherwise editing the prompt exits the active history navigation session and treats the new text as the current draft.

The behavior is disabled while composer approval state or pending user input custom-answer state owns the prompt, because those modes have different semantics and placeholder text.

## Approaches Considered

### Current-Thread Transcript History

Derive history from the messages already loaded for the active thread. This is the recommended approach because it is minimal, requires no new persistence, respects split-pane context, and works with existing server state.

### Session-Wide In-Memory History

Track sent prompts in a React or Zustand store for the current browser session. This would allow cross-thread reuse, but it needs decisions about project/thread boundaries and would lose history on reload unless persisted.

### Persisted Day-Wide History

Persist a global prompt history keyed by day. This best matches the broadest interpretation of "during that day," but it adds privacy, storage, deduplication, and retention questions that are not needed for the first useful version.

## Design

Add small pure helpers in `composer-logic.ts` to derive native user message history and resolve the next history navigation state. Cover those helpers with focused Vitest tests.

Wire `ChatView` to keep a lightweight history navigation ref containing the current index and the pre-navigation draft. In `onComposerCommandKeyRef.current`, after command-menu handling and before Enter submit handling, intercept `ArrowUp` and `ArrowDown` when no menu is active and boundary conditions are met. Apply the resolved prompt through the existing prompt setter and focus the Lexical editor at the prompt end.

Reset the navigation ref when `onPromptChange` receives a user edit that does not match the prompt applied by history navigation, when the active thread changes, and when the composer is cleared after send.

## Non-Goals

No global cross-thread history, no persistent day history, no UI affordance beyond keyboard behavior, and no changes to message dispatch contracts.

## Open Follow-Up

If users want day-wide history after trying the thread-local version, add an explicit persisted history store with retention and deduplication rules.
