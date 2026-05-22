# Marketing Agent Guide

## Scope

- `apps/marketing` is the Astro marketing site for JCode.
- Main page content lives under `src/pages`; shared page chrome lives under `src/layouts`.
- Build output is `dist/` and should not be edited directly.

## Commands

- Dev: `bun run --cwd apps/marketing dev`.
- Build: `bun run --cwd apps/marketing build`.
- Preview: `bun run --cwd apps/marketing preview`.
- Typecheck: `bun run --cwd apps/marketing typecheck`.

## Patterns

- Keep public positioning concise and consistent with `README.md`.
- Preserve attribution language in README/CREDITS rather than duplicating it throughout marketing copy.
- For favicon or brand asset changes, verify both source assets and the built output path that serves them.

## Verification

- Run `bun run --cwd apps/marketing build` after page, metadata, or asset changes.
- For visible copy or layout changes, inspect the rendered page or provide a screenshot when feasible.
