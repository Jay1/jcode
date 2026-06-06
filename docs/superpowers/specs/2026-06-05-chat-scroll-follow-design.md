# Chat Scroll Follow Design

| Field           | Value                                                                                                                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status          | Draft                                                                                                                                                                                           |
| Type            | Feature design                                                                                                                                                                                  |
| Owner           | Engineering                                                                                                                                                                                     |
| Audience        | Web UI maintainers                                                                                                                                                                              |
| Scope           | Chat transcript scroll-to-bottom and sticky bottom-follow behavior                                                                                                                              |
| Canonical path  | `docs/superpowers/specs/2026-06-05-chat-scroll-follow-design.md`                                                                                                                                |
| Source of truth | `apps/web/src/components/ChatView.tsx`, `apps/web/src/components/chat/MessagesTimeline.tsx`, `apps/web/src/chat-scroll.ts`, and browser tests in `apps/web/src/components/ChatView.browser.tsx` |
| Verification    | Focused unit/browser tests for chat scroll behavior plus formatting check for touched files                                                                                                     |

## Problem

The chat transcript's scroll-to-bottom button can require multiple clicks before the viewport reaches the true bottom. When assistant output continues streaming, the transcript can also drift upward even though the user thought they were at the bottom, leaving new text hidden below the viewport.

The fix must preserve the existing history-browsing behavior: if the user intentionally scrolls up while output continues, the transcript must not teleport them back to the bottom until they explicitly press the scroll-to-bottom button again.

## Existing Behavior

- `ChatView.tsx` owns the high-level scroll contract through `legendListRef`, `isAtEndRef`, `showScrollToBottom`, `onIsAtEndChange`, and `onScrollToBottom`.
- `MessagesTimeline.tsx` renders the transcript through `LegendList`, sets `initialScrollAtEnd`, and passes `maintainScrollAtEnd={followLiveOutput}` with `maintainScrollAtEndThreshold={0.1}`.
- `ChatTranscriptPane.tsx` renders the floating down-arrow button and calls `onScrollToBottom`.
- `chat-scroll.ts` contains distance-from-bottom helpers currently covered by `chat-scroll.test.ts`.
- `ChatView.browser.tsx` already covers nearby scroll/layout behavior, including delayed attachment loads and optimistic sends staying near the bottom.

## Root Cause Hypothesis

The scroll-to-bottom button currently behaves like a one-shot scroll request. It marks `isAtEndRef` true, hides the button, and calls `LegendList.scrollToEnd({ animated: true })`. During streaming, row measurement, assistant markdown layout, images/attachments, composer resizing, and virtualized list recalculation can increase `scrollHeight` after that one scroll request. If a reflow-induced scroll event flips `isAtEndRef` back to false after the programmatic guard window, bottom-follow is lost and the user must click again.

`MessagesTimeline` also enables `LegendList`'s `maintainScrollAtEnd` only from `followLiveOutput`, which is currently tied to live assistant text rather than a durable user intent. That means the app does not have a first-class state for "the user explicitly wants to follow the tail until they scroll up."

## Goals

- One click on the down-arrow reaches the true bottom, including after virtualized measurement and layout settle.
- Clicking the down-arrow re-enables sticky bottom-follow for streaming and future incoming messages.
- Manual upward scrolling disables sticky bottom-follow.
- Bottom-follow remains active across transcript growth caused by messages, streaming text, attachments, task-card height changes, and composer height changes.
- Existing transcript history browsing remains stable while the user is detached from the bottom.

## Non-Goals

- Redesigning the scroll button UI.
- Replacing `LegendList`.
- Changing terminal drawer scroll behavior.
- Changing transcript row rendering or message grouping.

## Considered Approaches

## Approach 1: Explicit Tail-Follow Mode

Add an explicit tail-follow state/ref in `ChatView.tsx` that represents user intent, separate from the current instantaneous `isAtEndRef` measurement.

Pressing the scroll-to-bottom button sets tail-follow on, hides the button, immediately scrolls to the end, and schedules one or more non-animated follow-up snaps so virtualized/layout growth settles at the true bottom. While tail-follow is on, existing layout effects that currently check `isAtEndRef` should instead use the same follow intent, or keep `isAtEndRef` synchronized when programmatic re-snaps happen.

Intentional upward user input disables tail-follow and allows the existing button visibility path to show the scroll control. Programmatic scroll events and layout drift should not disable tail-follow.

Trade-offs:

- Best matches the requested behavior.
- Adds a small amount of state and scroll-intent detection.
- Requires careful tests around user scroll versus programmatic/layout scroll.

## Approach 2: Multi-Frame Button Scroll Only

Keep the existing state model but make `onScrollToBottom` issue several `scrollToEnd` calls over animation frames or a short timeout window.

Trade-offs:

- Minimal code change.
- Likely fixes some cases where one click does not reach the bottom.
- Does not create durable sticky-follow behavior for future streaming or later messages.
- Still depends on timing and can regress with different row/layout delays.

## Approach 3: Always Maintain Scroll At End

Pass `maintainScrollAtEnd` more broadly so `LegendList` keeps the transcript pinned whenever the list grows.

Trade-offs:

- Simple to wire.
- Risks forcing the user back to the bottom while they are intentionally reading history.
- Does not cleanly encode the user's selected behavior.

## Decision

Use Approach 1.

The user-selected behavior is: pressing the down-arrow re-enables sticky bottom-follow for streaming and future messages until an intentional upward scroll disables it. That is an intent state, not just a geometry measurement.

## Detailed Design

Add tail-follow intent in `ChatView.tsx`:

- Store the current follow intent in a ref to avoid unnecessary transcript rerenders during scroll events.
- Optionally mirror it into state only if `MessagesTimeline` needs a prop change to enable `maintainScrollAtEnd` independently of streaming status.
- Initialize tail-follow to true on thread changes and when sending optimistic user messages, matching the current `isAtEndRef` reset behavior.
- Set tail-follow to true in `onScrollToBottom` before calling `scrollToEnd`.

Improve scroll-to-bottom snap reliability:

- Keep `scrollToEnd(animated)` as the single list-owned primitive.
- When the down-arrow is clicked, call `scrollToEnd(true)` immediately for user feedback, then schedule one or more non-animated `scrollToEnd(false)` calls on subsequent animation frames while tail-follow remains enabled.
- Cancel any pending scheduled snap on unmount.

Distinguish user detachment from programmatic drift:

- Keep the existing `programmaticScrollUntilRef` guard for reflow-induced scroll events after programmatic snaps.
- Treat `onIsAtEndChange(false)` during active tail-follow as layout drift unless there is recent intentional user input indicating upward scrolling.
- Capture intentional detachment through scroll-related input handlers already passed to `MessagesTimeline`: wheel, touch move, and direct scroll events. A helper can compare previous and next `scrollTop` values so only upward movement detaches.
- Do not detach on downward scrolling or programmatic scroll-to-end events.

Feed tail-follow to `MessagesTimeline`:

- `maintainScrollAtEnd` should be enabled when tail-follow is active, not only when assistant text is streaming.
- If `LegendList` needs prop changes to react, mirror the ref into a small state value that changes only when follow mode toggles.

Button visibility:

- Hide the scroll-to-bottom button whenever tail-follow is active or the list reports `isAtEnd`.
- Show the button only when tail-follow is disabled and the list is not at the end.
- Preserve the existing debouncer so transient reflow does not flash the button.

## Test Plan

- Extend `chat-scroll.ts` and `chat-scroll.test.ts` only if pure scroll-intent helpers are introduced.
- Add a focused browser test in `ChatView.browser.tsx` for clicking `aria-label="Scroll to bottom"` while the transcript is above bottom, then growing the transcript and asserting distance from bottom remains within `AUTO_SCROLL_BOTTOM_THRESHOLD_PX`.
- Add a browser test that after clicking the button, a manual upward scroll disables follow mode and later transcript growth does not force the viewport back to the bottom.
- Keep existing tests for delayed attachment loads and optimistic sends passing.

## Risks

- Wheel and touch events differ across browsers and input devices, so detachment should rely on observed upward `scrollTop` movement rather than event delta alone.
- `LegendList` virtualization can emit scroll state changes during measurement; programmatic guard windows should remain conservative enough to avoid false detaches.
- Browser tests that depend on layout timing should use existing `waitForLayout` and `vi.waitFor` patterns rather than fixed sleeps.

## Self-Review

- No placeholders remain.
- The design preserves user history browsing by disabling follow only on intentional upward movement.
- The design avoids replacing `LegendList` or adding a second scroll controller.
- Source references match current files found during investigation.
- Verification is focused on touched web UI behavior and existing test patterns.
