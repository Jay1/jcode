# Tokyo Night Theme Palette Design

## Goal

Refactor the bundled `tokyo-night` dark theme so JCode feels like the real `tokyo-night-vscode-theme` rather than an approximate blue-black theme.

## Upstream Source

Use the linked upstream repository as source of truth:

- `tokyo-night/tokyo-night-vscode-theme/themes/tokyo-night-color-theme.json`

Key upstream Night roles:

- `editor.background`: `#1a1b26`
- `activityBar.background`: `#16161e`
- `sideBar.background`: `#16161e`
- `input.background`: `#14141b`
- `toolbar.hoverBackground`: `#202330`
- `sideBar.border`: `#101014`
- `tab.activeBorder`: `#3d59a1`
- `button.background`: `#3d59a1dd`
- `variable`: `#c0caf5`
- `variable.declaration`: `#bb9af7`
- `property.declaration`: `#73daca`
- `property.defaultLibrary`: `#2ac3de`
- `parameter.declaration`: `#e0af68`
- validation error border/background family: `#963c47`, `#85353e`

## Palette Direction

Use the upstream Night palette directly for app-depth roles:

- Canvas/editor: `#1a1b26`
- Sidebar/topbar: `#16161e`
- Composer/code-copy/deep input: `#14141b`
- Panels/cards: `#1f2335`
- Header/hover: `#202330`
- Borders: `#292e42`
- Active/selected: `#3b4261`
- Link/accent: `#7aa2f7`
- Command/chip/skill: `#bb9af7`
- Token/success: `#73daca`
- Error/diff removed: `#f7768e`
- Warning: `#e0af68`
- Ink: `#c0caf5`

## Implementation Scope

Update only Tokyo Night theme data and expectation tests:

- `apps/web/src/theme/theme.logic.ts`
- `apps/web/src/theme/theme.seed.generated.ts`
- `apps/web/src/theme/theme.logic.test.ts`
- `apps/web/src/components/ThemeTokens.browser.tsx`

No component layout or global token derivation changes are needed.

## Verification

Run focused theme logic tests, browser token tests, and formatting checks for touched files.
