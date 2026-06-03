# Unique Branch Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import branch-only GitHub work into a fresh integration branch, verify it, then delete remote branches only after their changes are represented safely.

## Branch Groups

- README-only: `origin/jcode/readme-headers-ai-install`.
- Marketing-only: `origin/feature/marketing-screenshot-refresh`.
- Web appearance/theme: `origin/jcode/fix-chat-font-and-wordmark-red`, `origin/jcode/fix-appearance-regressions`, `origin/jcode/improve-theme-color-penetration`, `origin/jcode/improve-theme-surface-depth`.
- Large upstream import: `origin/feature/import-dpcode-fixes`.

## Import Order

- [ ] Start from fresh `origin/main` in an isolated worktree on `jcode/import-unique-branches`.
- [ ] Cherry-pick README-only branch and run a narrow formatting check for `README.md`.
- [ ] Cherry-pick marketing branch and run focused marketing checks if available.
- [ ] Import web appearance/theme branches from smallest to broadest, resolving conflicts against current `origin/main` styles.
- [ ] Run focused web tests/typechecks for touched areas.
- [ ] Inspect the large DPCode branch separately before importing; prefer individual high-value commits over a blind full merge if it conflicts or reintroduces stale code.
- [ ] After verified import and push/merge, delete remote branches whose changes are now contained or patch-equivalent to `main`.

## Verification

- Use `git cherry origin/main <branch>` and `git rev-list --left-right --count` before deleting any branch.
- Use focused `bunx oxfmt@0.52.0 --check <files>` for touched source/docs files.
- Use focused workspace tests for changed app areas rather than repo-wide checks unless conflicts make broad verification necessary.
