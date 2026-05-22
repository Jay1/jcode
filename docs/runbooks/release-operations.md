# Release Operations Runbook

| Field | Value |
| --- | --- |
| Status | Active |
| Type | Operational runbook |
| Owner | Engineering and Release Owner |
| Audience | Maintainers, release owners, and automation agents |
| Scope | Desktop/server release preparation and verification posture |
| Canonical path | `docs/runbooks/release-operations.md` |
| Last reviewed | 2026-05-22 |
| Review cadence | Event-driven; review when release workflows, packaging, versioning, signing, or desktop artifacts change |
| Source of truth | `.github/workflows/release.yml`, `scripts/build-desktop-artifact.ts`, `apps/desktop`, `apps/server`, and `docs/release.md` |
| Verification | Run focused builds/tests for changed release components; use `bun run build:desktop` for desktop pipeline changes when feasible |

## Before Release Work

- Confirm `main` is the intended release branch.
- Inspect pending local changes and keep unrelated work out of release commits.
- Preserve attribution in `LICENSE` and `CREDITS.md`.

## Local Checks

```bash
bun run build:desktop
node scripts/release-smoke.ts
```

Use focused package tests first when changing a specific release helper.

## Release-Sensitive Areas

| Area | Why it matters |
| --- | --- |
| `apps/desktop` | Electron main process, preload bridge, packaging output |
| `apps/server` | Bundled local server runtime used by desktop packaging |
| `scripts/build-desktop-artifact.ts` | Artifact assembly and platform configuration |
| `.github/workflows/release.yml` | Remote release orchestration |

## Rollback

If a release change fails verification, revert the smallest release-specific commit. Do not mix release fixes with unrelated app behavior changes.
