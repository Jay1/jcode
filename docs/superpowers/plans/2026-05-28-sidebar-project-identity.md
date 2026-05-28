# Sidebar Project Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make sidebar project group headers visually match section identity while keeping the top Threads header distinct.

**Scope:** `apps/web/src/components/Sidebar.tsx` and its source-structure test only.

## Tasks

- [ ] Add a failing structure test that requires project headers to use a dedicated `sidebar-project-header-icon` chip and `sidebar-project-header-label` text.
- [ ] Add a failing structure test that requires the top `Threads` section header to pass an elevated boxed class.
- [ ] Update `renderProjectItem` so project rows use the same compact accent icon-chip language and semibold project label.
- [ ] Pass an elevated class to the top `Threads` `SidebarSectionHeader` only.
- [ ] Run focused test, typecheck, formatting, LSP, Aikido, and browser QA.
