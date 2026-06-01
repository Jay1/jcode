# Project Language Icons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show lightweight language/framework icons for projects using server-owned metadata, bounded detection, persistence, and existing web icon fallbacks.

## Acceptance Criteria

- Project contracts decode a nullable/optional project icon metadata field on project read models, shell snapshots, created events, and meta-updated events; historical payloads without the field still decode.
- Server persistence stores and reads project icon metadata through `projection_projects` with an idempotent migration for existing databases.
- Server detection probes only bounded root-level marker files, does not recursively scan, and returns a known icon id or `null`.
- Project creation remains non-blocking for icon detection: `project.created` can be committed immediately, then icon metadata can arrive through a follow-up `project.meta-updated` event.
- Legacy projects missing icon metadata can be re-evaluated at most once per server process start.
- Web state preserves project icon metadata from snapshots/events, passes it into project identity surfaces, and `ProjectSidebarIcon` renders the language/framework glyph when present while preserving folder/favicon fallback when absent.
- Focused tests, LSP diagnostics on changed files, focused builds/typechecks, and manual QA produce fresh evidence before completion.

## Files

- `packages/contracts/src/orchestration.ts`: define `ProjectIconMetadata` and add it to project commands/events/read models/shell snapshots.
- `packages/contracts/src/orchestration.test.ts`: add red/green decode tests for icon metadata and historical payload compatibility.
- `apps/server/src/project/Services/ProjectLanguageIconResolver.ts`: new service interface for bounded project icon detection.
- `apps/server/src/project/Layers/ProjectLanguageIconResolver.ts`: root-level marker-file detector, modeled after `ProjectFaviconResolver` but without recursive scanning.
- `apps/server/src/project/Layers/ProjectLanguageIconResolver.test.ts`: detector tests for TypeScript/Vue priority, null fallback, and bounded probing.
- `apps/server/src/orchestration/decider.ts`: include optional icon metadata in `project.meta-updated` events.
- `apps/server/src/orchestration/projectMetadataProjection.ts`: persist icon metadata on created/meta-updated events.
- `apps/server/src/persistence/Services/ProjectionProjects.ts`: add icon metadata to projected project schema.
- `apps/server/src/persistence/Layers/ProjectionProjects.ts`: persist/select icon metadata JSON.
- `apps/server/src/persistence/Migrations/038_ProjectionProjectsIconMetadata.ts`: idempotently add `icon_metadata_json`.
- `apps/server/src/persistence/Migrations.ts`: register migration 38.
- `apps/server/src/persistence/Layers/ProjectionRepositories.test.ts`: prove repository round-trips icon metadata.
- `apps/server/src/orchestration/Layers/ProjectionSnapshotQuery.ts`: include icon metadata in projected snapshots.
- `apps/server/src/orchestration/Layers/ProjectionSnapshotQuery.test.ts`: prove snapshots include icon metadata.
- `apps/server/src/orchestration/Layers/OrchestrationEngine.ts` or the nearest project-create side-effect boundary: schedule post-create detection and once-per-process missing-metadata backfill.
- `apps/web/src/types.ts`: add project icon metadata to the web `Project` type.
- `apps/web/src/store.ts`: normalize icon metadata from read model snapshots and events.
- `apps/web/src/store.test.ts`: prove snapshots/events preserve project icon metadata.
- `apps/web/src/components/ProjectSidebarIcon.tsx`: render a language/framework glyph when metadata is present; otherwise keep current folder/favicon behavior.
- `apps/web/src/components/Sidebar.tsx`: pass project icon metadata to `ProjectSidebarIcon`.
- `apps/web/src/components/SidebarSearchPalette.tsx`: render the same project identity icon for project search rows.
- `apps/web/src/components/chat/ProjectPicker.tsx`: render the same project identity icon for active folder rows if active projects provide metadata there.
- `apps/web/src/components/ProjectSidebarIcon.test.tsx`: prove TypeScript/Vue glyph rendering and fallback behavior.

## Steps

- [ ] Write failing contract tests for `ProjectIconMetadata`, project created/meta-updated payloads, and historical payloads without metadata.
- [ ] Add contract schema/types and verify the contract tests pass.
- [ ] Write failing server detector tests for root-level TypeScript/Vue marker detection, priority, and null fallback.
- [ ] Implement `ProjectLanguageIconResolver` service/layer and verify detector tests pass.
- [ ] Write failing projection repository/migration tests for round-tripping `icon_metadata_json` and idempotent migration behavior.
- [ ] Add projection schema, repository SQL, and migration 38; verify repository/migration tests pass.
- [ ] Write failing projection/snapshot tests showing created/meta-updated icon metadata reaches shell/read model snapshots.
- [ ] Update decider/projection/snapshot query code and verify projection/snapshot tests pass.
- [ ] Write failing orchestration-side tests proving icon detection is scheduled after project creation and missing project metadata is backfilled at most once per process.
- [ ] Implement the minimal post-create detection/backfill wiring and verify orchestration tests pass.
- [ ] Write failing web store tests proving snapshots/events preserve project icon metadata.
- [ ] Update web types/store normalization and verify store tests pass.
- [ ] Write failing icon component/rendering tests for language glyphs and folder/favicon fallback.
- [ ] Update `ProjectSidebarIcon` and project identity call sites with minimal visual change; verify component tests pass.
- [ ] Run LSP diagnostics on every changed TypeScript/TSX file.
- [ ] Run focused contract/server/web tests touched by this plan.
- [ ] Run focused package/app typechecks and web/server builds where touched.
- [ ] Run manual QA with a temporary TypeScript/Vue project scenario and record the observed icon metadata/rendered output.
