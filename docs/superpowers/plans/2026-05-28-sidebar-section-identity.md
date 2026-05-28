# Sidebar Section Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give sidebar section headers a restrained icon-and-bold-title treatment so the navigation scans better without changing sidebar behavior.

## File Map

- `apps/web/src/components/Sidebar.tsx`: Add a small section-header component/helper and replace flat `Pinned`, `Threads`, `Workspace`, and `Chats` labels.
- `apps/web/src/components/Sidebar.test.tsx` or existing source-level sidebar test location if present: Add a focused regression that section headers use the new component/classes and action labels remain available.
- `docs/superpowers/specs/2026-05-28-sidebar-section-identity-design.md`: Approved design source.

## Acceptance Criteria

- `Pinned`, `Threads`, `Workspace`, and `Chats` render with an icon and bolder label treatment.
- Header action buttons remain present and accessible.
- No behavior changes to sorting, expanding, pinning, drag/drop, or workspace actions.
- Visual QA confirms the sidebar is less flat and still restrained.

## Task 1: Add Failing Structure Test

- [ ] Find existing sidebar test patterns.
- [ ] Add a focused source-level or render-level test that requires a reusable sidebar section header treatment for `Pinned`, `Threads`, `Workspace`, and `Chats`.
- [ ] Run the focused test and confirm it fails for missing section identity treatment.

## Task 2: Implement Section Header Treatment

- [ ] Add a small local `SidebarSectionHeader` component in `Sidebar.tsx`.
- [ ] Give it an icon slot, bold label, subtle accent icon chip, and optional actions slot.
- [ ] Replace the flat section label rows with the component.
- [ ] Keep action buttons and existing event handlers unchanged.
- [ ] Run the focused test and confirm it passes.

## Task 3: Verify And QA

- [ ] Run focused sidebar tests plus existing changed tests.
- [ ] Run `snip bun run --cwd apps/web typecheck`.
- [ ] Run format check on changed files and docs.
- [ ] Run LSP diagnostics for `Sidebar.tsx`.
- [ ] Run Aikido full scan on modified first-party code files.
- [ ] Browser QA the running app and capture a screenshot if useful.
