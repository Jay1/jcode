# Project Folder Suggestions Implementation Plan

| Field  | Value                                                                                         |
| ------ | --------------------------------------------------------------------------------------------- |
| Status | In Progress                                                                                   |
| Date   | 2026-05-24                                                                                    |
| Design | [Project Folder Suggestions Design](../specs/2026-05-24-project-folder-suggestions-design.md) |

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single Project Folder setting that feeds direct-child folder suggestions into the sidebar add-project flow while preserving Browse and Type path.

## File Structure

- `apps/web/src/appSettings.ts`: map `addProjectBaseDirectory` between `AppSettings` and server settings with an empty publishable default.
- `apps/web/src/routes/_chat.settings.tsx`: expose the Project Folder control in Settings -> General and patch server settings.
- `apps/web/src/lib/projectFolderSuggestions.ts`: pure helper for normalizing the setting, deriving display names, and filtering already-added suggestions.
- `apps/web/src/lib/projectFolderSuggestions.test.ts`: focused tests for filtering, path display, empty values, and duplicate project exclusion.
- `apps/web/src/components/Sidebar.tsx`: read server settings, fetch direct child directories, show suggestions first, and keep Browse/Type path flows.
- `apps/web/src/components/Sidebar*.test.tsx` or existing sidebar tests: cover the suggestion helper or sidebar interaction path if an appropriate focused test exists.

## Acceptance Criteria

- Settings -> General lets the user save and clear one Project Folder path.
- Server settings default to an empty Project Folder so committed defaults remain publishable and machine-neutral.
- Opening the sidebar `+` shows direct child folder suggestions when a Project Folder is configured.
- Suggestions hide folders already present as projects after normalized workspace-root comparison.
- Clicking a suggestion uses the existing `addProjectFromPath` flow and creates/recovers the selected project.
- Browse and Type path stay available.
- With no Project Folder configured, the add-project area shows a compact empty state and still allows Browse/Type path.
- Focused tests, web typecheck, LSP diagnostics, Aikido scan, and manual sidebar/settings QA pass.

## Tasks

- [x] Write failing tests for `projectFolderSuggestions` normalization and duplicate filtering.
- [x] Implement `apps/web/src/lib/projectFolderSuggestions.ts` minimally to pass tests.
- [x] Add the Project Folder server setting contract with an empty-string default.
- [x] Add Settings -> General UI to save and clear the Project Folder path.
- [x] Add sidebar query state for direct child folder suggestions using existing project directory APIs.
- [x] Render suggestions before Browse/Type path and wire suggestion clicks to `addProjectFromPath`.
- [ ] Verify focused tests, web typecheck, LSP diagnostics, Aikido scan, and manual QA.
- [ ] Commit implementation in atomic slices.
