# Interface Clock Design

## Goal

Add a small, always-visible clock to the bottom-right interface chrome without making the status area feel crowded. The clock should appear on every chat shell view, including the new-thread initial prompt where thread-specific runtime controls such as access mode and context usage are intentionally hidden.

## Current Context

- `apps/web/src/components/BranchToolbar.tsx` renders thread-specific bottom controls through `RuntimeUsageControls`.
- `RuntimeUsageControls` currently owns the runtime access chip and `ContextWindowMeter`.
- `apps/web/src/routes/_chat.settings.tsx` already exposes `General -> Time and reading -> Time format` with System default, 12-hour, and 24-hour choices.
- `apps/web/src/timestampFormat.ts` already centralizes timestamp formatting for locale, 12-hour, and 24-hour display.

## Recommended Design

Introduce the clock as global chat-shell chrome, not as part of the thread-only runtime controls. The bottom-right area should visually read as:

```text
[Full access] [context %]        [clock]
```

When a thread has no runtime controls yet, the clock still renders in the same bottom-right position:

```text
                         [clock]
```

This preserves the existing behavior where access and context are hidden before a thread exists, while satisfying the requirement that time is always visible.

## UI Details

- Use an inline status-pill treatment for the clock: rounded, compact, tabular digits, muted foreground, subtle border/background, and a slightly brighter hover state.
- Reserve spacing for the clock at the far right so the access chip and context meter sit slightly to the left when they are present.
- Keep the clock visually quieter than action controls. It should feel like ambient chrome, not a primary button.
- Avoid a detached floating overlay; it risks overlapping the composer, terminal drawer, or settings content and would feel less integrated.

## Settings Behavior

- Add a `Show interface clock` toggle in General settings near the existing `Time format` row.
- Reuse the existing `Time format` setting for the clock. Do not add a separate 12h/24h setting unless future feedback asks for independent behavior.
- Default the clock to visible.
- If `Show interface clock` is off, remove the bottom-right clock from all chat shell views.

## Data Flow

- Add a local-only boolean app setting for clock visibility.
- Read clock visibility and timestamp format through `useAppSettings()`.
- Format the clock with the existing timestamp formatting semantics, updating once per minute.
- Render the clock at the chat layout level so it is independent from thread creation state.

## Testing And Verification

- Unit-test app settings normalization/defaults for the new clock visibility setting.
- Add focused tests for any pure clock formatting or ticking helper if one is introduced.
- Run `bun run --cwd apps/web test` only for touched focused test files.
- Run `bun run --cwd apps/web typecheck` or a narrower equivalent if available.
- Perform browser/manual verification for:
  - existing thread with access/context visible,
  - new-thread initial prompt where only the clock is visible,
  - Settings General toggle hides/shows the clock,
  - 12-hour and 24-hour Time format values affect the clock.

## Non-Goals

- Do not add date display, seconds, timezone selection, or an independent clock-only time format setting.
- Do not change when runtime access or context usage are shown.
- Do not redesign the entire bottom toolbar.
