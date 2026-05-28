# Navbar Logo Hover Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the JCode logo visible in the shared navbar control cluster while revealing the back, forward, and sidebar controls only on hover or focus.

## File Map

- `apps/web/src/components/SidebarHeaderNavigationControls.tsx`: Add the always-visible logo and hover/focus reveal wrapper around the existing controls.
- `apps/web/src/components/ui/sidebar.test.tsx`: Add a structure regression for logo visibility and hover/focus reveal classes.
- `docs/superpowers/specs/2026-05-28-navbar-logo-hover-controls-design.md`: Approved design source.

## Acceptance Criteria

- `JCode` is rendered by `SidebarHeaderNavigationControls` whenever the shared cluster renders.
- Back/forward/sidebar controls are grouped separately from the logo.
- The grouped controls include hover and focus reveal classes.
- Existing sidebar trigger visibility rules remain unchanged.

## Task 1: Add Failing Structure Test

- [ ] Import `SidebarHeaderNavigationControls` in `apps/web/src/components/ui/sidebar.test.tsx`.
- [ ] Render it inside `SidebarProvider open={false}` and `QueryClientProvider`.
- [ ] Assert the output includes `JCode`.
- [ ] Assert the output includes hover and focus reveal classes for the controls.
- [ ] Run the focused test and confirm it fails before implementation.

## Task 2: Implement Shared Cluster

- [ ] Add a compact logo element to `SidebarHeaderNavigationControls.tsx`.
- [ ] Wrap `AppNavigationButtons` and `SidebarHeaderTrigger` in a reveal group.
- [ ] Use `group-hover` and `focus-within` classes so mouse and keyboard users can reveal controls.
- [ ] Keep the existing `triggerVisible` return behavior.
- [ ] Run the focused test and confirm it passes.

## Task 3: Verify And QA

- [ ] Run the focused sidebar test.
- [ ] Run `snip bun run --cwd apps/web typecheck`.
- [ ] Run LSP diagnostics for touched source files.
- [ ] Run Aikido full scan on modified first-party source files.
- [ ] Perform best-effort UI verification for the header cluster.
