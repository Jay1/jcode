# Navbar Logo Hover Controls Design

## Goal

Make the main navbar's left control area more compact by pairing the JCode logo with the sidebar/navigation controls and revealing only the controls on hover or keyboard focus.

## Approved Direction

Keep the JCode logo always visible. Place it on the same baseline as the back arrow, forward arrow, and sidebar collapse button. Fade those three controls in when the user hovers or focuses the logo/control cluster.

## Scope

- Update the shared header navigation cluster used by chat, workspace, and settings headers.
- Preserve existing back, forward, and sidebar toggle behavior.
- Keep the logo visible even when the controls are hidden.
- Support keyboard discoverability with `focus-within`, not mouse hover only.

## Visual Rules

- The default cluster footprint should be compact, with the logo taking the persistent space.
- Hidden controls should retain layout stability to avoid header content jumping on hover.
- Hover/focus transitions should be subtle and quick.
- Controls remain non-drag regions inside Electron titlebar headers.

## Non-Goals

- No full topbar redesign.
- No changes to sidebar persistence or navigation history behavior.
- No new app branding treatment beyond the compact logo cluster.

## Success Criteria

- The JCode logo is always visible in the shared header control area.
- Back, forward, and sidebar controls are hidden by default and visible on cluster hover/focus.
- Existing headers remain aligned and compact.
- Focused tests, typecheck, LSP diagnostics, Aikido scan, and visual QA pass.
