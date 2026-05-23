# React Doctor Integration Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add React Doctor as a first-class, report-only quality check for the Vite React app.

## Context

JCode is a Bun and TypeScript monorepo. The React surface lives in `apps/web`, which is a Vite app using React 19. Root CI runs `bun run test`, and the root `test` script delegates to Turbo's `test` task across workspaces.

React Doctor provides a CLI for scanning React projects and supports a `fail-on` setting. Its GitHub Action supports comments and annotations, but the immediate request is to install and use it as part of this project's tests.

## Approaches Considered

1. Add React Doctor to `apps/web` test script directly.
   - Pros: smallest surface area; always runs when web tests run.
   - Cons: mixes unit test output with static React diagnostics; harder to run independently.

2. Add a dedicated `react-doctor` script and make root `test` run it after Turbo tests.
   - Pros: explicit first-class command; runs in the existing test path; easy to tighten later.
   - Cons: one more root script to maintain.

3. Add only a GitHub Actions job using `millionco/react-doctor`.
   - Pros: rich PR feedback can be configured later.
   - Cons: not local-first and not part of the repo's test command.

## Recommended Approach

Use approach 2. Add `react-doctor` as a root development dependency, create root scripts that run the CLI against `apps/web`, and update the root `test` script to run Turbo tests plus the changed-file React Doctor gate.

## Design Decisions

- Scope the scan to `apps/web` because it is the React app in this monorepo.
- Use `--fail-on none` for the full scan so the existing baseline remains visible without making current CI brittle.
- Add a separate changed-file gate with `--diff HEAD --fail-on warning` so the normal test command catches React Doctor diagnostics introduced by the current working change set.
- Keep the full command explicit as `bun run react-doctor` so contributors can run it independently from `bun run test`.
- Do not run `npx react-doctor install` because that modifies agent instructions; the project needs a codebase quality check, not generated local agent guidance.
- Defer a GitHub Action PR-comment integration until after the local command is stable.

## Acceptance Criteria

- `react-doctor` is installed in the Bun lockfile as a root dev dependency.
- `bun run react-doctor` runs a full React Doctor scan against `apps/web` in report-only mode.
- `bun run react-doctor:changed` runs a warning-level React Doctor gate against changed `apps/web` files.
- `bun run test` includes the changed-file React Doctor check after the existing Turbo tests.
- The full report can be tightened later by changing `--fail-on none` to a stricter threshold once the baseline is addressed.
