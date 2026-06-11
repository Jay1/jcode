# ADR 0004: Project Language Icons Are Detected As Project Metadata

| Field           | Value                                                                                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status          | Proposed                                                                                                                                                                              |
| Type            | Architecture decision record                                                                                                                                                          |
| Owner           | Engineering                                                                                                                                                                           |
| Audience        | Maintainers, reviewers, and automation agents                                                                                                                                         |
| Scope           | Project identity metadata, sidebar project icons, project creation, and legacy project icon backfill                                                                                  |
| Canonical path  | `docs/adr/0004-project-language-icons.md`                                                                                                                                             |
| Last reviewed   | 2026-06-11                                                                                                                                                                            |
| Review cadence  | Event-driven; review if project metadata storage, project creation, or sidebar project identity rendering changes                                                                     |
| Source of truth | `packages/contracts/src/orchestration.ts`, `apps/server/src/orchestration`, `apps/server/src/persistence`, `apps/web/src/store.ts`, `apps/web/src/components/ProjectSidebarIcon.tsx`  |
| Verification    | Confirm project creation stays fast, startup icon refresh work is capped, and renderer icon surfaces use server-owned metadata or bounded server favicon lookups rather than scanning |

## Context

The left project navbar currently renders a generic folder icon for projects. The UI should show a small language or framework icon when JCode can cheaply infer the project identity, such as TypeScript, Vue, React, Svelte, Go, Rust, or Python.

This should not add noticeable startup cost. Project detection must not recursively scan workspaces, must not poll every few minutes, and must not make opening JCode feel slower. Legacy projects that predate this metadata should get a best-effort re-evaluation, but only through a capped background path.

Project data is server-owned and reaches the renderer through orchestration read models and shell snapshots. The web store normalizes `project.created` and `project.meta-updated` events in `apps/web/src/store.ts`. Current localStorage state only stores sidebar UI preferences such as expanded projects, ordering, and local project names, so language icon state should not live only in renderer localStorage.

## Decision

JCode will treat the detected project icon as durable project metadata owned by the server read model, not as renderer-local sidebar state.

Project creation should enqueue lightweight language/framework detection after the project is persisted. The `project.create` path must not wait on detection before returning a usable project. Detection results should be written back with a project metadata update so all render surfaces receive the same value through existing snapshot/event plumbing.

The detector must use a bounded root-probe strategy:

- read only known root-level manifest and config files;
- avoid recursive directory walking;
- cap file size for manifest reads;
- run with concurrency `1` or another small server-side limit;
- prefer framework icons over language icons when the framework is explicit;
- fall back to the current folder icon when there is no confident match.

Legacy projects with missing icon metadata, and projects whose current icon metadata came from automatic detection, should be re-evaluated by a low-priority once-per-process startup path. The refresh should process only a small capped number of projects per restart and should never block startup snapshots, sidebar rendering, or thread loading. Manually updated icon metadata must not be overwritten by this automatic path.

The renderer must not scan project workspaces. `ProjectSidebarIcon.tsx` may prefer the bounded server favicon endpoint for the visible sidebar icon, then fall back to server-owned language/framework metadata when no favicon exists or the visible favicon image fails. Other project identity surfaces should continue to consume the persisted metadata field so search/import palette and project picker remain consistent.

## Options Considered

### Option A: Renderer-Side Detection In Sidebar

Run filesystem checks from the web UI when project rows render.

**Pros**

- Smallest initial contract change.
- Easy to colocate with the existing folder icon rendering.

**Cons**

- Makes rendering depend on filesystem probing.
- Risks repeated work on re-render, navigation, and restart.
- Does not naturally share results with search palette or project picker.
- Does not work consistently across browser and desktop environments.

### Option B: Server Metadata Detection On Project Lifecycle

Detect server-side when a project is created, persist the icon hint in project metadata, and run capped startup maintenance for legacy missing metadata and stale automatically detected metadata.

**Pros**

- Keeps filesystem access in the server boundary.
- Gives the renderer a simple field to render with no scanning.
- Reuses existing `project.created` / `project.meta-updated` read-model flow.
- Supports all project icon surfaces from one source of truth.
- Allows strict latency caps and background scheduling.

**Cons**

- Requires contract, projection, and migration work.
- Requires automatic-detection provenance so stale automatic results can be revisited intentionally without overwriting manual project metadata.

### Option C: Periodic Project Scanner

Run a scheduled scanner every few minutes to refresh icons for all projects.

**Pros**

- Eventually notices project type changes without user action.

**Cons**

- Violates the no-polling constraint.
- Wastes filesystem work for a mostly cosmetic field.
- Creates avoidable startup and runtime performance risk.

## Trade-Off Analysis

Option B is the intended design. It costs more than a renderer-only patch but keeps the expensive and privileged operation in the right process, makes icon state durable, and avoids per-render or periodic scans. It also matches the existing project favicon precedent in `apps/server/src/project/Layers/ProjectFaviconResolver.ts`, which uses a bounded candidate list instead of recursive project scanning.

The key trade-off is accepting eventual icon availability. A newly added project may briefly show the folder icon until detection writes metadata. That is preferable to blocking project creation or JCode startup on filesystem probing.

## Detection Priority

The detector should use deterministic priority so the same project always receives the same icon until detector rules change.

1. Framework markers in known config files or package manifests, such as Vue, Nuxt, Svelte, Astro, Angular, Next, or React.
2. Language-specific root markers, such as `tsconfig.json`, `go.mod`, `Cargo.toml`, `pyproject.toml`, `requirements.txt`, `Gemfile`, or `composer.json`.
3. Package-manager manifests, such as `package.json`, only when dependencies or devDependencies give a confident signal.
4. No icon hint when confidence is low.

When multiple matches exist, framework identity wins over general language identity. For example, a Vue TypeScript app should render the Vue icon rather than the TypeScript icon.

## Consequences

- Project icon metadata becomes part of the orchestration contract and project projection schema.
- `project.created` and `project.meta-updated` payloads need a forward-compatible optional icon metadata field.
- `ProjectionProjects` storage needs a migration for the icon hint and detector metadata.
- The web `Project` type and store normalization need to carry the field through snapshots and shell events.
- Sidebar icon rendering can stay cheap because it consumes server-owned identity data and bounded favicon endpoint results instead of scanning folders.
- Legacy project backfill and automatic metadata refresh must be observable and capped so they cannot add seconds to JCode startup.

## Action Items

1. Add a shared contract type for project icon metadata, such as an icon id plus detector version and confidence/source details.
2. Add optional icon metadata to project create/update events, read models, shell snapshots, and web `Project` normalization.
3. Add a server-side bounded project icon detector service that reads only approved root manifest/config candidates.
4. Trigger detection after project creation without blocking project creation completion.
5. Add a once-per-process startup icon refresh that processes a small capped number of missing or automatically detected icon projects in the background while preserving manual metadata.
6. Update `ProjectSidebarIcon.tsx`, `SidebarSearchPalette.tsx`, and `chat/ProjectPicker.tsx` to render the shared icon hint with folder/favicon fallback.
7. Add focused tests for detector priority, projection persistence, web normalization, capped startup refresh, and renderer fallback behavior.
