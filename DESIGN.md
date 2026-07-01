# JCode Design System

This document codifies JCode's current cockpit visual system as extracted from the existing web UI. It is descriptive, not a redesign brief. Future visible UI work must preserve this system unless `DESIGN.md` is updated first.

## 1. Product And Domain

JCode is a local-first coding-agent cockpit for maintainers who need to steer agent work, inspect diffs, watch terminals, manage providers, and recover context quickly. The UI should feel like a dense but calm command center: muted surfaces, compact controls, precise metadata, and semantic status cues that make active work scannable without turning the cockpit into a colorful dashboard. The signature is tokenized depth: transcript, diff, terminal, settings, and right panel/browser surfaces are separated by app-owned `--app-*` surface tokens rather than one-off component styling.

## 2. Principles

1. Local work first: surfaces should privilege the active thread, workspace, provider, terminal, and diff context over decorative chrome.
2. Scannability over palette display: color has a role, especially in chat output, status, diffs, and work rows. Unknown body text stays calm.
3. Provider boundaries stay hidden: UI names canonical cockpit concepts rather than raw provider protocol payloads.
4. Dense controls, readable content: chrome can be compact, but transcript, code, table, diff, terminal, and settings content must remain legible at the configured font size.
5. Tokenized theme ownership: theme math belongs in `apps/web/src/theme/theme.logic.ts`; shared CSS helpers live in `apps/web/src/index.css`; components consume semantic tokens.

## 3. Typography

| Role | Token or Pattern | Current Source | Usage |
| --- | --- | --- | --- |
| UI sans | `--font-ui-family`, `--theme-font-ui-family`, `.font-system-ui` | `apps/web/src/index.css` | App chrome, settings rows, metadata, transcript body when rendered as UI text. |
| Code mono | `--font-mono-family`, `--theme-font-code-family` | `apps/web/src/index.css` | Inputs, textareas, generic code, diff fallback chrome. |
| Chat code mono | `--font-chat-code-family`, `.font-chat-code` | `apps/web/src/index.css` | Transcript code blocks, inline code chips, diff stats inside chat. |
| Terminal mono | `--terminal-font-family` | `apps/web/src/index.css`, `terminalRuntimeAppearance.ts` | Xterm surfaces and terminal system messages. |
| Body tracking | `body { letter-spacing: -0.015em; }` | `apps/web/src/index.css` | Native, utilitarian cockpit text rhythm. |
| Chat scale | `DEFAULT_CHAT_FONT_SIZE_PX`, `getAppTypographyScale`, `getChatTranscriptTextStyle` | `MessagesTimeline.tsx` | User-configurable transcript size, timestamps, and metadata. |
| Settings labels | `text-[11px] uppercase tracking-[0.14em]` | `_chat.settings.tsx` | Section labels and compact settings hierarchy. |

Rules:

- Use at most the UI sans and mono families for normal product UI. Do not introduce a third family without updating this document and the theme settings model.
- Use `font-system-ui` for cockpit labels and metadata that should follow the UI font.
- Use `font-chat-code` or `--font-chat-code-family` for transcript code, diff-like inline stats, and generated assistant code surfaces.
- Use the configured chat typography helpers for transcript UI instead of hardcoding one-off font sizes.

## 4. Color And Tokens

JCode has two token layers: generic shadcn/Tailwind-compatible tokens and cockpit-specific semantic `--app-*` tokens. Components must consume semantic roles, not raw palette values.

| Family | Tokens | Use |
| --- | --- | --- |
| Base surfaces | `--background`, `--foreground`, `--card`, `--popover`, `--border`, `--input`, `--ring` | App shell, card/panel foundations, form controls, focus rings. |
| App depth | `--app-surface-canvas`, `--app-surface-sidebar`, `--app-surface-topbar`, `--app-surface-panel`, `--app-surface-card`, `--app-surface-card-header`, `--app-surface-composer`, `--app-surface-toolbar`, `--app-surface-toolbar-hover`, `--app-surface-toolbar-active`, `--app-surface-toolbar-border` | Cockpit shell depth, sidebar/topbar rhythm, panel/card separation, composer surface, toolbar states. |
| Transcript | `--app-transcript-stage-bg`, `--app-transcript-stage-border`, `--app-transcript-edge-fade`, `--app-assistant-message-bg`, `--app-assistant-message-border`, `--app-assistant-message-accent`, `--app-user-message-bg`, `--app-user-message-border`, `--app-user-message-accent` | Chat transcript stage, assistant message rail, user message bubble, live-edge fade. |
| Chat semantics | `--app-chat-heading`, `--app-chat-link`, `--app-chat-file`, `--app-chat-token`, `--app-chat-command`, `--app-chat-success`, `--app-chat-warning`, `--app-chat-error`, `--app-chat-chip-bg`, `--app-chat-chip-border`, `--app-chat-code-bg`, `--app-chat-code-border`, `--app-chat-code-copy-bg`, `--app-chat-code-copy-fg` | Role-based markdown scannability for headings, file paths, commands, tokens, statuses, code blocks, and copy controls. |
| Work rows | `--app-work-row-bg`, `--app-work-row-hover-bg`, `--app-work-row-border`, `--app-work-row-icon` | Tool calls, file-change rows, branch/worktree rows, subagent cards, and expandable activity. |
| Diff | `--app-diff-title`, `--app-diff-card-bg`, `--app-diff-card-header-bg`, `--diffs-font-family`, `--diffs-header-font-family` | Diff panel title, file cards, file-change summaries, diff renderer font bridge. |
| Terminal | `--terminal-font-family`, `--app-terminal-search-match-*`, `--app-terminal-search-active-match-*`, `--app-scrollbar-thumb`, `--app-scrollbar-thumb-hover` | Terminal xterm font, search highlights, and scrollbar parity. |
| Chrome controls | `--app-chrome-control-bg`, `--app-chrome-control-border`, `--app-chrome-control-fg`, `--app-chrome-control-hover-bg`, `--app-chrome-control-hover-fg`, `--app-chrome-control-active-bg`, `--app-control-icon-*`, `.sidebar-icon-button` | Compact icon buttons, message actions, terminal/browser/diff toolbar actions. |
| Metadata | `--app-metadata-fg`, `--app-metadata-muted-fg`, `--app-text-metadata`, `--app-text-metadata-strong` | Secondary labels, timestamps, environment labels, settings status text. |
| Status | `--app-status-{working,success,warning,input,plan,error,muted}-{fg,dot,bg,border}` | Thread, terminal, PR, plan, input, warning, success, working, error, and muted markers. |
| Agent accents | `--app-agent-chip-*`, `--app-subagent-accent-*` | Provider/agent chips and subagent identity accents. |

Source rules:

- Add or change theme derivation in `apps/web/src/theme/theme.logic.ts`; keep app-depth and status token expectations aligned with `apps/web/src/theme/theme.logic.test.ts`.
- Shared helper classes belong in `apps/web/src/index.css` when a pattern is reused across surfaces.
- Do not introduce raw hex, RGB, `color-mix`, or status colors inside product components. If a new visual role is needed, add or derive a token here and in the theme layer first.
- Existing raw values in low-level integrations are exceptions, not precedent: terminal ANSI colors in `terminalRuntimeAppearance.ts`, Electron `webview` white background, and legacy ultrathink spectrum values should not be copied into new UI without a token update.

## 5. Spacing, Density, And Layout

JCode uses Tailwind v4 utilities over a 4px/rem scale and compact cockpit-specific measurements. The common rhythm is dense: `gap-1`/`gap-1.5` for icon-label clusters, `gap-2` for toolbar groups, `px-2` to `px-4` for rows/cards, and `rounded-md` to `rounded-xl` for panel and row corners.

| Pattern | Current Usage | Rule |
| --- | --- | --- |
| Full-height cockpit | `h-full`, `min-h-0`, `min-w-0`, `overflow-hidden`, `h-dvh` for browser sidebars | Preserve containment; prevent transcript, diff, terminal, and browser panes from leaking scroll. |
| Transcript width | `mx-auto w-full min-w-0 max-w-3xl` | Keep chat content readable while the cockpit shell can be wide. |
| Right panel widths | Diff inline default `42vw`, `min-w-[360px]`, max `560px`; browser/right panel widths are persisted and bounded | Do not hardcode new panel widths without using the existing storage and composer-fit guards. |
| Work row density | Compact rows use `py-0.5`, `gap-1.5`; default rows use rounded row cards and `px-2 py-1` | Dense activity rows are allowed, but they must remain clickable and readable. |
| Settings density | `SettingsRow` uses `rounded-xl`, `px-4 py-3.5`, `gap-3` | Settings are card-like rows, not bare forms. |
| Terminal density | 32px tab bars, 6px scrollbars, split handles, compact icon buttons | Terminal chrome should stay tight and prioritize viewport space. |

Rules:

- Use Tailwind spacing utilities that map to the 4px/rem scale. Avoid arbitrary `px`/`rem` values unless matching an existing measured integration constraint.
- If an arbitrary visual value is reused or becomes part of a surface contract, document it here and move it behind a token or helper.
- Preserve `min-h-0`/`min-w-0` and explicit overflow ownership in pane layouts.

## 6. Component Patterns

### Transcript And Chat

- `ChatTranscriptPane` owns the transcript stage through `.app-transcript-stage` and renders `MessagesTimeline` with scroll-to-bottom chrome using `--app-scroll-button-*`.
- `MessagesTimeline` renders assistant messages in `.app-assistant-message`, user messages in `.app-user-message`, and file-change/activity summaries through `--app-work-row-*`, `--app-diff-card-*`, and metadata tokens.
- `ChatMarkdown` owns markdown scannability: headings, links, inline code role classes, code blocks, copy buttons, tables, local generated images, and lazy image rendering.
- Chat-output semantic roles must stay conservative: file paths, commands, theme tokens, success/warning/error states can be colored; ordinary text stays neutral.

### Diff

- `DiffPanelShell` is the shared shell for diff and browser panels. It supplies the border/header/body structure and Electron drag-region behavior.
- `DiffPanel` uses compact turn chips, summary/review/source tabs, copy controls, virtualized file diffs, and `diff-panel-viewport`/`diff-render-file` CSS helpers.
- Diff copy-path affordances must remain keyboard-accessible, small, and anchored in file headers without redesigning the whole diff surface.
- Diff UI uses `--app-diff-*`, `--app-work-row-*`, `--color-*`, and the configured code font bridge, not raw palette values.

### Terminal

- `ThreadTerminalDrawer` owns drawer/workspace terminal presentation, resize handles, terminal groups, sidebar tabs, and split controls.
- `TerminalViewportPane` owns tab bars, split pane handles, active-pane emphasis, terminal action buttons, and xterm viewport containment.
- `terminalRuntimeAppearance.ts` resolves the xterm theme and terminal font from root app tokens; terminal search highlights use `--app-terminal-search-*` tokens.
- Terminal action chrome should remain compact and accessible with labels, disabled states, and visible focus/hover states.

### Settings

- `SettingsSection` uses uppercase 11px labels with wide tracking for scan groups.
- `SettingsRow` is the settings primitive: rounded bordered panel, `bg-(--color-background-panel)`, compact description/status text, optional reset action, and right-aligned controls on wider screens.
- Settings should explain state and recovery clearly; avoid stuffing provider/runtime protocol details into labels.

### Right Panel And Browser Surfaces

- Right panels are cockpit sidecars, not standalone pages. They must preserve chat composer width guards and pane-owned resizing.
- `_chat.$threadId.tsx` routes `diff` and `browser` into the right panel/sidebar/split-pane system with persisted width keys, min widths, borders, and `bg-card text-foreground`.
- `BrowserPanel` reuses `DiffPanelShell`, compact toolbar buttons, mono address input, tab strip, popover suggestions, and menu actions over `--composer-surface`, `--border`, `--popover`, and `--sidebar-accent`.
- Native browser/webview bounds and overlay synchronization are behavioral constraints; do not replace browser chrome with generic iframe styling.

## 7. Interaction And Accessibility

- Every icon-only action needs a label through `aria-label`, `title`, screen-reader text, or the shared button component's accessible label pattern.
- Focus must use `--app-state-focus`, `--ring`, or existing component focus-visible styles. Do not suppress focus rings for aesthetics.
- Hover/active states should use paired semantic tokens: toolbar hover/active, work-row hover, sidebar accent, status bg/border, or chrome-control hover.
- Disabled states should reduce opacity and preserve layout. Avoid hiding disabled controls when the absence would make cockpit state ambiguous.
- Scroll ownership is explicit: transcript uses `LegendList`, diff uses `Virtualizer`, browser/terminal have pane-owned scroll and bounds logic, settings route owns its page scroll.
- Remote or provider-specific state should be translated into canonical cockpit labels before display.

## 8. Motion

| Motion | Token/Pattern | Rule |
| --- | --- | --- |
| Chat pane entry | `.chat-pane-enter`, `220ms cubic-bezier(0.22, 1, 0.36, 1)` | Use for empty/transcript pane swaps; respect reduced motion. |
| Terminal running dot | `.terminal-running-indicator__dot`, `640ms ease-in-out`, opacity/scale only | Keep as CSS animation to avoid JS timers across many terminals. |
| Generated image shimmer | `chat-generated-image-shimmer`, `1.6s ease-in-out` | Loading feedback for generated images only. |
| Micro-interactions | Tailwind `transition-colors`, `transition-opacity`, `duration-120/140/150/200` patterns | Prefer color/opacity/transform transitions. |
| Ultrathink | `ultrathink-*` spectrum animations, 10s linear | Existing special mode only; do not use as general decoration. |

Rules:

- Animate `opacity`, `transform`, and color/filter changes only. Do not animate layout properties for ordinary UI.
- Respect `prefers-reduced-motion` for non-essential animation.
- Do not add decorative motion to transcript, diff, terminal, settings, or browser surfaces unless it improves state comprehension.

## 9. Implementation Rules

- Read this file before any UI component or style change.
- Use `docs/architecture/theme-surface-tokens.md` as the architecture companion for token ownership and verification.
- Colors must reference `--app-*`, `--color-*`, or documented component tokens. No new raw hex/RGB values in product components.
- Spacing must use the existing Tailwind/rem scale or a documented component measurement. No ad-hoc `margin: 13px`, arbitrary padding, or one-off border radii without updating this file first.
- New reusable components or repeated surface patterns must be documented in Section 6 before or with implementation.
- Extend theme logic and tests before adding new semantic token roles.
- Preserve existing visual identity: muted cockpit depth, compact controls, semantic chat scannability, tokenized work rows, and local-first utility.
- T3Code and other upstream references are implementation references only. Adapt feature slices into JCode-native tokens and components; do not import a new brand/style wholesale.
