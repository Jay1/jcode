# Chat Scroll Follow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the chat transcript's scroll-to-bottom button reliably reach the true bottom and re-enable sticky bottom-follow until the user intentionally scrolls upward.

**Design:** `docs/superpowers/specs/2026-06-05-chat-scroll-follow-design.md`

**Primary Area:** `apps/web`

**Verification:** Focused unit/browser tests plus formatting for touched files.

## File Map

- `apps/web/src/chat-scroll.ts`: Add pure helpers only if needed for scroll intent or scheduled snap decisions.
- `apps/web/src/chat-scroll.test.ts`: Unit-test any new pure helpers.
- `apps/web/src/components/ChatView.tsx`: Own the explicit tail-follow mode, scroll-to-end scheduling, and user-detachment handling.
- `apps/web/src/components/chat/MessagesTimeline.tsx`: Keep list-owned scrolling; only adjust props if tail-follow must drive `maintainScrollAtEnd` directly.
- `apps/web/src/components/ChatView.browser.tsx`: Add regression coverage for button re-stick and manual upward detach behavior.
- `docs/superpowers/specs/2026-06-05-chat-scroll-follow-design.md`: Design reference only; do not change unless implementation discovers a design correction.

## Constraints

- Preserve existing UI styling and the current down-arrow button.
- Keep `LegendList` as the scroll owner; do not introduce a second scroll container/controller.
- Do not force users back to bottom after they intentionally scroll up.
- Use focused commands only; avoid repo-wide lint/typecheck unless necessary.
- Do not commit unless explicitly requested by the user.

## Tasks

- [ ] Read `ChatView.tsx` around `isAtEndRef`, `scrollToEnd`, `onIsAtEndChange`, `onScrollToBottom`, and the message/composer layout effects.

- [ ] Read `MessagesTimeline.tsx` around `followLiveOutput`, `maintainScrollAtEnd`, and `handleListScroll`.

- [ ] Write a failing browser regression test in `ChatView.browser.tsx` for the button re-stick path:
  - Mount a transcript with enough content to scroll.
  - Move the scroll container meaningfully above the bottom and dispatch a scroll event.
  - Assert the `aria-label="Scroll to bottom"` button becomes visible.
  - Click the button.
  - Simulate transcript growth by syncing an updated read model with additional or longer assistant content.
  - Assert `getScrollContainerDistanceFromBottom(scrollContainer) <= AUTO_SCROLL_BOTTOM_THRESHOLD_PX` after layout settles.

- [ ] Run the focused browser test and confirm it fails for the expected reason.
  - Command shape: `safe-run --profile browser -- bun run --cwd apps/web test:browser src/components/ChatView.browser.tsx -t "<test name>"`
  - If the script does not accept the path/name filter in that exact order, adjust minimally and record the working command in the final summary.

- [ ] Add explicit tail-follow intent in `ChatView.tsx`:
  - Create a ref for current follow intent, initialized to true.
  - Create state only if `MessagesTimeline` needs prop changes when follow mode toggles.
  - Add small setter callbacks to enable/disable follow mode while keeping `isAtEndRef` and `showScrollToBottom` consistent.

- [ ] Add reliable scroll-to-end scheduling in `ChatView.tsx`:
  - Keep `scrollToEnd(animated)` as the primitive.
  - Add a helper that calls `scrollToEnd(animated)` immediately, then schedules follow-up non-animated `scrollToEnd(false)` calls on subsequent animation frames while follow mode remains active.
  - Track and cancel pending animation frames on unmount.

- [ ] Update `onScrollToBottom` to enable tail-follow and use the scheduled snap helper.

- [ ] Update existing bottom-stick effects to use tail-follow intent where appropriate:
  - Transcript message count changes.
  - Active task-list card height changes.
  - Composer form height changes.
  - Thread changes and optimistic sends should keep or re-enable follow mode as current behavior already assumes bottom anchoring there.

- [ ] Add intentional upward-detach handling:
  - Track the last observed scroll container `scrollTop`.
  - In the scroll path, if follow mode is active and the scroll position moves upward outside a programmatic guard window, disable follow mode.
  - Do not disable follow mode for programmatic scrolls, downward movement, or transient layout drift.

- [ ] Feed follow intent to `MessagesTimeline` if needed:
  - Prefer `followLiveOutput || tailFollowEnabled` for `followLiveOutput` unless renaming the prop is necessary.
  - Avoid broad component churn.

- [ ] Re-run the button re-stick browser test and make it pass.

- [ ] Write a second failing browser regression test for manual upward detach:
  - Click the scroll-to-bottom button to enable follow.
  - Scroll upward manually by changing `scrollTop` lower and dispatching a scroll event.
  - Grow the transcript.
  - Assert distance from bottom remains greater than `AUTO_SCROLL_BOTTOM_THRESHOLD_PX` and the scroll button is visible.

- [ ] Run the second browser test and confirm it fails before any additional fix if the current implementation does not cover it.

- [ ] Implement the minimal additional detach logic needed to make the second test pass.

- [ ] Run focused browser tests for both new scroll regressions.

- [ ] Run existing nearby scroll browser tests in `ChatView.browser.tsx`:
  - `stays pinned to the bottom after delayed attachment loads expand the timeline`
  - `re-sticks to the bottom after sending an optimistic user message`

- [ ] Run focused formatting for touched source and test files:
  - `bunx oxfmt@0.52.0 --check <touched files>`

- [ ] Run `git diff --check`.

- [ ] Review the final diff for scope creep and ensure no unrelated files were modified.

## Notes

- The existing `programmaticScrollUntilRef` is important. Extend or reuse it rather than replacing it with a separate timing system.
- Prefer observed `scrollTop` direction over raw wheel deltas, because trackpads, scrollbar drags, and touch can differ.
- If browser tests are too slow or flaky, keep the logic small enough to cover pure parts in `chat-scroll.test.ts` and leave browser coverage for one end-to-end regression.
