# Project Folder Suggestions Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:writing-plans before implementation. Keep this as a small sidebar/settings feature; do not replace the whole project launcher.

**Goal:** Make the sidebar add-project `+` flow faster by suggesting projects from a configured parent folder while preserving manual path entry.

## Context

The sidebar currently exposes a compact add-project flow from the `+` button in the Threads header. The flow can browse for a folder in Electron or reveal a manual path input, then dispatch `project.create` with the chosen workspace root.

This is under-designed for repeated local use because the user usually keeps projects under one parent folder, such as `/home/jay/code`, and should not need to type or browse every path manually.

JCode already has the needed building blocks:

- server settings are fetched and patched through `server.getSettings` and `server.updateSettings`
- Settings has a General section for workflow defaults
- the web app has project entry search helpers under `projectReactQuery`
- the server has local filesystem listing/search support for project entries
- the existing sidebar add-project action already handles duplicate/recovered projects and manual path creation

## Recommended Approach

Add one server setting named conceptually as the Project Folder. The Project Folder is a parent directory whose direct child folders feed suggestions in the sidebar add-project flow.

When the user clicks `+` in the sidebar:

- if a Project Folder is configured, show direct child folder suggestions first
- hide folders whose normalized path already exists as a project
- keep the existing Browse action where available
- keep the existing Type path action for arbitrary project paths
- if no Project Folder is configured, show a compact empty state that points the user to Settings → General while still offering Browse and Type path

## Decisions

- Support exactly one Project Folder in the first version.
- Configure it in Settings → General.
- Suggestions come from direct child folders only, not recursive search.
- Already-added project folders are hidden from suggestions.
- Manual path entry remains available and keeps the existing `project.create` behavior.

## UX Shape

The `+` area should remain compact inside the sidebar. It should not become a full modal or command palette.

Suggested layout when a Project Folder is configured:

1. A short label such as `Suggested projects`.
2. A small list of direct child folders, using folder names as primary text and paths as secondary text if space allows.
3. Existing actions: `Browse` and `Type path`.

Suggested layout when no Project Folder is configured:

1. A short empty state such as `Set a Project Folder to get suggestions.`
2. A link/button to open Settings → General.
3. Existing actions: `Browse` and `Type path`.

## Data Flow

Settings flow:

1. Settings → General reads `serverSettingsQueryOptions()`.
2. User enters or browses for the Project Folder path.
3. Settings patches server settings with the Project Folder path.
4. Existing settings subscription invalidation keeps the app in sync.

Sidebar flow:

1. Sidebar reads the Project Folder from server settings.
2. Sidebar requests direct child folders from the configured Project Folder.
3. Sidebar filters out already-added project workspace roots.
4. Clicking a suggestion calls the existing `addProjectFromPath()` path.

## Scope

Included:

- Add the Project Folder setting to the shared server settings contract.
- Add Settings → General controls to view/change the Project Folder.
- Add sidebar suggestions sourced from direct child folders.
- Preserve Browse and Type path behavior.
- Hide already-added project folders from suggestions.

Excluded:

- Multiple Project Folders.
- Recursive/fuzzy project folder search.
- Automatic project import for every child folder.
- Replacing the sidebar add-project flow with a modal or command palette.
- Changing `ProjectKind: "chat"` semantics.

## Acceptance Criteria

- A user can set one Project Folder in Settings → General.
- Clicking the sidebar `+` shows direct child folders from that Project Folder.
- Folders already present as projects are not shown as suggestions.
- Clicking a suggestion creates or recovers that project through the existing add-project path.
- Browse and Type path remain available.
- With no Project Folder configured, the add-project area still works through Browse/Type path and explains where to configure suggestions.
- Focused tests cover setting normalization, suggestion filtering, and at least one sidebar interaction path.
- Focused typecheck, LSP diagnostics, and manual QA of the sidebar flow pass before completion.

## Open Implementation Notes

- Prefer reusing existing project local-entry APIs if they can list direct child directories cleanly; otherwise add a narrow directory-listing query rather than broad recursive search.
- Normalize paths before duplicate filtering so equivalent workspace roots do not appear as suggestions.
- Keep settings defaults publishable: an empty Project Folder is the default.
