# Web Agent Guide

## Scope

- `apps/web` is the Vite React UI for JCode.
- Entry points include `src/main.tsx` and `src/router.ts`.
- Generated router artifacts and build output should not be edited by hand.

## Commands

- Dev: `bun run --cwd apps/web dev`.
- Build: `bun run --cwd apps/web build`.
- Typecheck: `bun run --cwd apps/web typecheck`.
- Unit tests: `bun run --cwd apps/web test` or focused `bun run --cwd apps/web test src/path/to/file.test.ts`.
- Browser tests: `bun run --cwd apps/web test:browser` after installing Chromium with `bun run --cwd apps/web test:browser:install` when needed.

## Patterns

- Follow the existing TanStack Router, React Query, Zustand, and component patterns.
- Keep logic testable outside React where existing `*.logic.test.ts` files show that pattern.
- For UI changes, preserve current visual language unless explicitly asked to redesign.
- Include before/after screenshots or browser verification for visible UI behavior.

## Verification

- Run focused unit tests for touched logic.
- For UI behavior, use browser/manual verification rather than relying only on type checks.
- Do not edit built files under `dist/`.
