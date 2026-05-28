# Sidebar Section Identity Design

## Goal

Make the left sidebar/navigation feel less flat by giving section headers a restrained identity treatment that matches the Catppuccin semantic color work without increasing color noise.

## Approved Direction

Use the recommended option: section headers get a small icon, bolder label weight, and subtle accent coloring. Header action buttons remain muted until hover so the section title becomes easier to scan without competing with project/thread rows.

## Scope

- Apply to left sidebar section headers: `Pinned`, `Threads`, `Workspace`, and `Chats`.
- Improve the active/current top thread title affordance by allowing its leading status glyph to use the same semantic accent family already used in thread rows.
- Preserve existing sidebar structure, drag/drop behavior, menu actions, collapse behavior, and row spacing.

## Visual Rules

- Labels use `font-semibold` and stronger foreground contrast than the previous muted gray.
- Icons use a contained accent color, preferably `--app-chat-heading`, `--app-chat-file`, or `--app-chat-token` fallbacks.
- Action icons stay muted by default and lift on hover/focus.
- Avoid colored backgrounds behind every header; one subtle icon chip or accent mark is enough.

## Non-Goals

- No wholesale sidebar redesign.
- No new navigation concepts.
- No rainbow treatment across every project or thread row.
- No changes to thread grouping, sorting, pinning, or workspace state.

## Success Criteria

- Section titles are immediately easier to distinguish from row text.
- Icons add semantic hierarchy without overpowering active rows.
- The sidebar remains visually consistent with Catppuccin and the new chat semantic chips.
- Existing focused tests, typecheck, format check, LSP diagnostics, Aikido scan, and browser QA pass.
