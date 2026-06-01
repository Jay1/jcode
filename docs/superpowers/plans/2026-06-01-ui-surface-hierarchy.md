# UI Surface Hierarchy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce the blank/bland feel in JCode's chat workspace by improving transcript depth, assistant message rhythm, sidebar grouping, shell controls, and accessibility without changing chat behavior.

## Research Inputs

- User screenshot: dark JCode chat workspace with a dense left sidebar, sparse central transcript, top chat header, bottom composer, and low-signal runtime/status controls.
- Existing theme reference: `docs/architecture/theme-surface-tokens.md`.
- Existing appearance testing reference: `docs/testing/appearance-regressions.md`.
- Web app guidance: `apps/web/AGENTS.md` says visible UI changes need browser/manual verification and before/after screenshots when useful.
- Prior palette work improved bundled theme color accuracy, so this plan treats remaining blandness as a surface hierarchy and composition problem, not another palette-source pass.
- External references reviewed for patterns, not direct copying: assistant-ui composable chat primitives, shadcn dark/fullscreen AI chat blocks, CopilotKit scroll/message-selector patterns, OpenCode VS Code sidebar UI guidance, and W3C WCAG contrast/focus guidance.

## Design Direction

- Keep the current JCode visual language: compact, developer-native, dark-theme-first, restrained, and information dense.
- Do not introduce a broad redesign, decorative side panels, new product features, or behavior changes.
- Prefer semantic `--app-*` tokens over raw Tailwind opacity chains when a surface or state has durable meaning.
- Improve rhythm through hierarchy, spacing, borders, tonal layers, and typography before adding new UI.
- Preserve performance-sensitive transcript rendering and existing scroll/follow behavior.

## File Map

- `apps/web/src/components/chat/ChatTranscriptPane.tsx`: Transcript shell and scroll-to-bottom affordance host. Use for canvas/shell-level treatment only.
- `apps/web/src/components/chat/MessagesTimeline.tsx`: User/assistant/work/proposed-plan row rendering. Primary file for message rhythm and assistant response treatment.
- `apps/web/src/components/ChatMarkdown.tsx`: Markdown renderer component wrapper. Keep behavior stable; style changes mostly live in `index.css`.
- `apps/web/src/index.css`: Shared app surface tokens, sidebar/composer helpers, markdown rhythm, inline code/chip styling, and component-level CSS helpers.
- `apps/web/src/components/ChatView.tsx`: Main chat layout, composer shell, footer/status rows, and transcript/composer composition.
- `apps/web/src/components/Sidebar.tsx`: Sidebar section headers, pinned/thread/workspace row presentation, hover actions, timestamps, and project grouping.
- `apps/web/src/components/BranchToolbar.tsx`: Runtime mode, context window, cost, workspace handoff, and compact status/control presentation.
- `apps/web/src/components/chat/ChatHeader.tsx`: Top chat title and action hierarchy.
- `apps/web/src/components/GitActionsControl.tsx`: Git action controls in the top/header region.
- `apps/web/src/components/chat/ChatEmptyStateHero.tsx`: Empty transcript state and first-run blank-canvas impression.
- `apps/web/src/theme/theme.logic.ts`: App-depth token derivation when new or refined semantic tokens are needed.
- `apps/web/src/theme/theme.logic.test.ts`: Contract tests for emitted `--app-*` tokens.
- `apps/web/src/components/chat/MessagesTimeline.test.tsx`: Static-render transcript tests that may need class/structure assertions for message hierarchy.
- `apps/web/src/components/Sidebar.structure.test.ts`: Source-level sidebar structure tests for section/header/row treatment.
- `docs/architecture/theme-surface-tokens.md`: Update only if new durable semantic tokens are introduced.
- `docs/testing/appearance-regressions.md`: Update only if verification expectations for visual surface changes change.

## Current Findings

1. Transcript canvas lacks a designed surface.
   - `ChatTranscriptPane` is mostly `flex ... overflow-hidden` and delegates the body to `MessagesTimeline`.
   - The screenshot shows large empty dark areas around a relatively narrow transcript column.

2. Assistant messages are under-contained compared with user messages.
   - User messages render a `rounded-lg bg-secondary` bubble in `MessagesTimeline`.
   - Assistant messages render `ChatMarkdown` inside a minimal `min-w-0 px-1 py-0.5` wrapper.
   - This makes assistant turns blend into the page, especially for long prose.

3. Markdown rhythm is readable but flat.
   - `.chat-markdown` currently sets wrapping, margins, headings, links, blockquotes, inline code, and code blocks.
   - Inline code/chips can become visually louder than surrounding prose.
   - Long assistant responses need better paragraph/list/metadata rhythm without changing markdown parsing.

4. Sidebar density is useful but grouping remains weak.
   - `SidebarSectionHeader` gives major sections an icon chip and semibold label.
   - Thread rows still rely heavily on compact text, muted timestamps, active color, and hover-only actions.
   - Dense left-nav content competes with sparse main content.

5. Composer polish exceeds the rest of the shell.
   - `ChatView` gives the composer a clear centered `max-w-3xl` surface.
   - The composer looks more finished than transcript/header/sidebar, making those regions feel bland by comparison.

6. Runtime/status controls are too low-signal.
   - `RuntimeUsageControls` uses tiny metadata-grade text and icons.
   - Important state such as `Full access`, context window, and cost can read as passive footnote text.

7. Empty state is simple but may reinforce blankness.
   - `ChatEmptyStateHero` uses a centered logo, `Let's build`, and a low-contrast project name.
   - It does not help fill or structure the blank workspace beyond the center hero.

8. Existing token contracts are ready for this work.
   - `theme.logic.test.ts` already locks required app-depth tokens such as `--app-surface-*`, `--app-metadata-*`, `--app-work-row-*`, and `--app-chat-*`.
   - Prefer extending or reusing these contracts instead of adding one-off raw classes.

## Additional Research Findings

### Codebase Patterns To Preserve

- `data-message-role`, `data-timeline-row-kind`, `data-chat-transcript-pane`, `data-chat-composer-form`, and `data-thread-item` are useful test and browser-behavior hooks. Do not rename or remove them while improving visuals.
- `ChatView.browser.tsx` queries composer/transcript DOM nodes directly for browser behavior. Visual wrappers must not break those selectors.
- `MessagesTimeline.test.tsx` static-renders transcript rows and already asserts timeline markers. Prefer adding focused class/structure assertions there instead of adding brittle snapshot tests.
- `Sidebar.structure.test.ts` is intentionally source-level and can lock durable sidebar identity classes without requiring a full DOM render.
- `theme.logic.test.ts` already has the right contract shape for app-depth token additions; use it for any durable token expansion.

### External Patterns Worth Adapting

- Chat UI libraries commonly make assistant turns explicit semantic units, often with `role="article"` or a stable assistant-message wrapper in addition to `data-message-role="assistant"`. JCode already has role data hooks; adding semantic article-like wrappers can improve accessibility and testability if done without disrupting virtualization.
- Mature agent chat UIs compose the shell from clear primitives: `Sidebar`, `Thread`, `Messages`, `ScrollArea`, and `Composer`. JCode already has this split, but the visual treatment is uneven: composer is strongest, transcript is weakest.
- Developer-tool chat guidance consistently prioritizes transcript readability over decoration: distinct user/assistant surfaces, readable long responses, visible file links/actions, compact but clear status, and responsive narrow-width behavior.
- Dark chat examples often use a quiet received/assistant surface, stronger sent/user surface, subtle borders, and a bottom fade above the composer. For JCode, adapt the hierarchy but avoid glossy glow effects or hardcoded theme colors.
- Scroll-to-bottom controls are commonly positioned outside the scrollable content and visually related to the composer/bottom inset. JCode already positions a floating control; the plan should verify it remains legible after transcript surface changes.
- Markdown examples in other chat UIs use slightly stronger line-height, clearer list cadence, muted blockquotes with accent borders, and restrained inline code. JCode's markdown rules are close, so this should be a tuning task rather than a rewrite.

### Accessibility-Specific Findings

- WCAG 2.1 AA requires 4.5:1 contrast for normal text and 3:1 for non-text UI component boundaries and focus indicators. This matters for muted timestamps, sidebar rows, runtime controls, borders, and scroll buttons.
- Focus visibility must remain obvious after adding subtle surface layers. A surface hierarchy improvement that only changes hover state is insufficient for keyboard users.
- Compact controls can be visually small, but their keyboard focus and pointer target must remain usable. Sidebar hover actions and runtime status controls are the riskiest areas.
- Status must not depend on color alone. Runtime mode, work state, waiting/input state, errors, and context-window/cost states should keep text/icon cues.
- Text zoom and split panes are first-class because JCode can run in narrow panes. Any new transcript or sidebar framing must degrade gracefully at constrained widths.

## Second-Pass Opportunities

These are additional improvement directions found after the first screenshot critique. They should be evaluated during implementation, but each still needs a small, JCode-native slice rather than a broad redesign.

1. Give message rows semantic structure, not just visual classes.
   - JCode already emits `data-message-role` and `data-timeline-row-kind` in `MessagesTimeline`.
   - External AI chat tests commonly key off assistant message roles and sometimes `role="article"` for message-level semantics.
   - Consider adding semantic wrappers for durable message units if it improves screen reader navigation and test selectors.

2. Add a transcript stage edge treatment.
   - Several polished chat layouts use a subtle bottom fade or edge treatment around the composer so the scroll area feels intentional.
   - For JCode, this should be tokenized and subtle: avoid decorative glows that conflict with developer-tool density.
   - Candidate files: `ChatTranscriptPane.tsx`, `ChatView.tsx`, and `index.css`.

3. Make work/tool rows feel like agent activity, not incidental metadata.
   - Work rows already use `--app-work-row-*` tokens and compact grouping.
   - The plan should evaluate whether grouped tool rows need a slightly stronger header, collapsed summary, or left accent to distinguish agent work from prose.
   - Preserve the current compact default and do not add heavy cards to every tool event.

4. Rebalance inline code and semantic chips.
   - Current inline code uses `--app-chat-chip-bg` and `--app-chat-chip-border`; semantic roles add color for file paths, commands, warnings, successes, and errors.
   - In the screenshot, chip/token styling can draw more attention than the answer itself.
   - Improve hierarchy by tuning chip intensity, body text contrast, and heading/list rhythm together.

5. Use status shape plus text, not color alone.
   - Runtime/access/context/cost controls should stay compact, but their state should be recognizable without relying only on muted color.
   - Good options include small leading icons, labels, shape changes, or grouped chips backed by `--app-status-*` and `--app-chrome-control-*` tokens.

6. Preserve narrow-pane behavior as a first-class constraint.
   - JCode supports split chat panes and terminal/browser/diff panels.
   - Any transcript/sidebar/header polish must be checked at narrow widths, not only fullscreen desktop.
   - Avoid treatments that depend on wide horizontal space or fixed decorative side rails.

7. Treat empty/sparse states as composition problems.
   - `ChatEmptyStateHero` is intentionally simple, but sparse transcripts need more than a centered logo to avoid feeling unfinished.
   - Consider subtle stage framing or context hints that do not add new onboarding actions.

8. Keep CSS ownership from sprawling.
   - External developer-tool UI docs favor splitting styles by app shell, transcript, sidebar, composer, and controls.
   - JCode currently centralizes many shared rules in `index.css`; if this work adds several helpers, group them by existing sections and document any new token ownership.

9. Add a visual QA matrix before coding too much.
   - The most likely regressions are density regressions, over-heavy surfaces, contrast regressions, and split-pane breakage.
   - Capture the active-thread screenshot scenario, empty state, long markdown answer, inline work/tool rows, and narrow split pane as the canonical review matrix.

10. Use accessibility as a design constraint, not a final audit.
    - WCAG 2.1 AA requires 4.5:1 normal text contrast and 3:1 non-text contrast for UI components and graphics.
    - Focus-visible guidance requires a clearly visible keyboard focus indicator; for this UI, focus states must work on dark adjacent surfaces.
    - Compact controls that are smaller than 44px can still be acceptable in dense desktop UI, but they need keyboard reachability, visible focus, and clear labels.

## Acceptance Criteria

- The chat screen has clearer separation between shell canvas, transcript, assistant turns, user turns, composer, sidebar, and header/status controls.
- Assistant messages remain lightweight but no longer feel like unanchored text on a blank canvas.
- Sidebar scanability improves without changing thread sorting, pinning, archive, drag/drop, selection, or workspace behavior.
- Runtime/access/status controls remain compact but become easier to recognize as active state.
- Empty and sparse transcripts feel intentionally composed, not unfinished.
- Changes preserve keyboard navigation, visible focus states, readable contrast, and text zoom behavior.
- Existing theme packs still derive from semantic token contracts and do not regress custom theme fallback behavior.
- Browser/manual QA includes before/after screenshots for at least the active-thread screenshot scenario.

## Non-Goals

- Do not add new chat features, new panels, new navigation concepts, or new provider behavior.
- Do not redesign the whole app shell.
- Do not change transcript virtualization/follow-live-output behavior.
- Do not weaken tests or remove existing visual contracts.
- Do not hardcode Tokyo Night-only colors into components.

## Task 1: Lock Down The Baseline

- [ ] Open the current screenshot and identify the exact active-thread state to reproduce locally.
- [ ] Read `apps/web/AGENTS.md`, `docs/architecture/theme-surface-tokens.md`, and `docs/testing/appearance-regressions.md`.
- [ ] Run focused static tests before editing: `snip bun run --cwd apps/web test src/components/chat/MessagesTimeline.test.tsx src/components/Sidebar.structure.test.ts src/theme/theme.logic.test.ts`.
- [ ] Start the app with `snip bun run --cwd apps/web dev` or the repo-standard local app path.
- [ ] Capture baseline screenshots for the active chat, empty chat, and a thread with work/tool rows.
- [ ] Record current computed values for representative `--app-surface-*`, `--app-chat-*`, `--app-metadata-*`, and `--app-work-row-*` tokens in the active theme.

## Task 2: Add Transcript Surface Depth

- [ ] Read `ChatTranscriptPane.tsx`, `MessagesTimeline.tsx`, `ChatView.tsx`, and relevant scroll/follow code in `ChatView.browser.tsx`.
- [ ] Decide whether the transcript needs a shell helper class in `index.css` or semantic token reuse only.
- [ ] Add a subtle transcript canvas treatment that distinguishes the message stage from the outer app canvas.
- [ ] Keep the transcript surface lightweight enough for split panes and terminal workspace overlay states.
- [ ] Preserve `data-chat-transcript-pane`, scroll-to-bottom behavior, terminal visibility toggling, and message click/pointer handlers.
- [ ] Add or update focused render/source tests only where durable structure or class hooks are introduced.
- [ ] Verify with browser QA that scroll, follow-live-output, scroll-to-bottom button, and split panes still work.

## Task 3: Improve Assistant Message Rhythm

- [ ] Read assistant message rendering in `MessagesTimeline.tsx` around `ChatMarkdown`.
- [ ] Add a restrained assistant-turn container or rhythm treatment that differentiates assistant responses from the raw canvas without making them heavy bubbles.
- [ ] Keep user message bubble treatment stable unless spacing must be aligned.
- [ ] Make assistant metadata/copy/revert affordances easier to discover on hover/focus without visual noise at rest.
- [ ] Ensure streaming responses and completion dividers still look correct.
- [ ] Update `MessagesTimeline.test.tsx` with a focused assertion for the durable assistant-turn class/structure if introduced.
- [ ] Browser QA a short assistant response, long markdown response, streaming response, and response with inline work rows.

## Task 4: Tune Markdown Prose And Inline Tokens

- [ ] Read `.chat-markdown` rules in `index.css` and `ChatMarkdown.tsx`.
- [ ] Improve paragraph/list/heading/block quote rhythm so long answers have clearer vertical cadence.
- [ ] Reduce cases where inline code/chips visually overpower body prose while preserving semantic role colors for file paths, commands, warnings, successes, and errors.
- [ ] Keep code block copy buttons and syntax highlighting stable.
- [ ] Run `snip bun run --cwd apps/web test src/components/ChatMarkdown.test.tsx src/components/chat/MessagesTimeline.test.tsx`.
- [ ] Browser QA markdown examples with headings, bullets, nested lists, inline code, file paths, and code blocks.

## Task 5: Strengthen Sidebar Grouping And Thread Rows

- [ ] Read `Sidebar.tsx`, `Sidebar.logic.ts`, `Sidebar.structure.test.ts`, and `components/ui/sidebar.tsx`.
- [ ] Preserve current section headers but evaluate project/thread row grouping, active-row treatment, timestamp opacity, status pills, and hover action reveal.
- [ ] Add a restrained row grouping or active-thread accent treatment that improves scanability without changing row height drastically.
- [ ] Make inactive rows quieter and active rows more obvious without losing accessibility contrast.
- [ ] Keep archive, rename, pin, drag/drop, keyboard selection, and thread safe-selection selectors unchanged.
- [ ] Update `Sidebar.structure.test.ts` or adjacent sidebar tests for durable class/component hooks.
- [ ] Browser QA pinned threads, recent threads, project-expanded threads, empty workspace sections, hover actions, and keyboard focus.

## Task 6: Balance Composer With The Rest Of The Shell

- [ ] Read composer shell rendering in `ChatView.tsx`, `ComposerPromptEditor.tsx`, `ProviderModelPicker`, and `ComposerExtrasMenu`.
- [ ] Avoid making the composer heavier; instead align transcript/header/sidebar surfaces so the composer no longer feels like the only finished region.
- [ ] If composer changes are necessary, limit them to spacing or token alignment with the new transcript surface.
- [ ] Verify queued follow-up rows, active task list card, approvals, pending user input, voice recorder, image attachments, and local directory menu still fit the shell.
- [ ] Browser QA normal composer, deferred/skeleton composer, queued follow-ups, and approval/input states.

## Task 7: Raise Header And Runtime Control Signal

- [ ] Read `ChatHeader.tsx`, `BranchToolbar.tsx`, `GitActionsControl.tsx`, and top-level `ChatView.tsx` placement.
- [ ] Give thread title/project state a clearer anchor role without increasing chrome height unnecessarily.
- [ ] Convert runtime/access/context/cost controls from passive metadata into compact state chips or clearer grouped controls.
- [ ] Keep runtime mode toggle behavior, context window popover, cost display, workspace handoff, and git actions unchanged.
- [ ] Ensure all controls keep accessible names, visible focus, and keyboard reachability.
- [ ] Browser QA full-access/default-permissions modes, context window meter, cumulative cost, workspace handoff, and git action availability.

## Task 8: Improve Empty And Sparse States

- [ ] Read `ChatEmptyStateHero.tsx` and empty-state placement in `ChatTranscriptPane.tsx`.
- [ ] Add subtle structure to empty/sparse transcripts so the first impression is composed rather than blank.
- [ ] Keep the hero simple and do not add new onboarding flows or extra actions unless separately requested.
- [ ] Verify project name contrast remains readable and not overly muted.
- [ ] Browser QA empty chat, newly created local thread, server thread, and split-pane empty state.

## Task 9: Extend Tokens Only If Needed

- [ ] Reuse existing `--app-surface-*`, `--app-chat-*`, `--app-metadata-*`, `--app-work-row-*`, and `--app-chrome-control-*` tokens first.
- [ ] If reusable semantic gaps remain, add the smallest possible new token names in `theme.logic.ts`.
- [ ] Add required-token tests in `theme.logic.test.ts` for any new durable `--app-*` token.
- [ ] Update `docs/architecture/theme-surface-tokens.md` if new token ownership rules are introduced.
- [ ] Verify custom/imported themes still receive safe fallback values.

## Task 10: Accessibility Review

- [ ] Check normal text contrast for assistant prose, sidebar rows, timestamps, project name, and runtime/status controls.
- [ ] Check non-text contrast for borders, chips, focus rings, scroll buttons, and active-row markers.
- [ ] Keyboard through sidebar rows, header controls, runtime controls, composer controls, message actions, and scroll-to-bottom.
- [ ] Verify focus indicators remain visible against the new surfaces.
- [ ] Check text zoom at 200 percent and narrow split-pane widths.
- [ ] Confirm touch/click targets for compact icon buttons are still usable, especially sidebar hover actions and runtime controls.

## Task 11: Verification

- [ ] Run focused tests for every touched component or logic file.
- [ ] Run `snip bun run --cwd apps/web typecheck`.
- [ ] Run format check on changed files and docs.
- [ ] Run LSP diagnostics on every changed TypeScript/TSX file.
- [ ] Run browser/manual QA for active thread, empty thread, long assistant response, work/tool rows, sidebar hover/focus, composer states, and header/runtime controls.
- [ ] Capture before/after screenshots for the original screenshot scenario and at least one empty-thread scenario.
- [ ] Note any pre-existing unrelated failures separately instead of folding them into the change.

## Task 12: Build The Visual QA Matrix

- [ ] Create or document five canonical manual QA scenarios: original active-thread screenshot, empty thread, long assistant markdown response, response with grouped tool/work rows, and narrow split-pane chat.
- [ ] For each scenario, record the expected visual hierarchy: strongest anchor, secondary metadata, active controls, and quiet background surfaces.
- [ ] Include both dark and light theme checks if the touched tokens affect both variants.
- [ ] Include Tokyo Night and one non-Tokyo bundled theme to prevent theme-specific overfitting.
- [ ] Capture before/after screenshots for the original active-thread scenario and any scenario whose layout changes materially.

## Task 13: Review For Overcorrection

- [ ] Check that assistant messages did not become heavy card spam.
- [ ] Check that sidebar grouping did not reduce useful density or make timestamps/status harder to scan.
- [ ] Check that runtime/status controls became clearer without competing with the prompt/composer.
- [ ] Check that new borders/fades/shadows still work in split panes and narrow widths.
- [ ] Check that palette-specific accents do not make custom themes or light themes look broken.

## Implementation Slices

1. Transcript shell and assistant message rhythm.
2. Markdown prose rhythm and inline token balance.
3. Sidebar grouping and active row treatment.
4. Header/runtime/status control signal.
5. Empty-state composition and final token/documentation cleanup.
6. Accessibility and visual QA tightening.

Each slice should be independently reviewable and should avoid mixing unrelated behavior changes.
