# ADR 0002: Release Notes Are Curated, GitHub Releases Are Latest-Package Distribution

| Field           | Value                                                                                                                               |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Status          | Accepted                                                                                                                            |
| Type            | Architecture decision record                                                                                                        |
| Owner           | Engineering and Release Owner                                                                                                       |
| Audience        | Maintainers, release owners, and automation agents                                                                                  |
| Scope           | Changelog authoring, app release history, GitHub Release publishing, and release-asset retention                                    |
| Canonical path  | `docs/adr/0002-release-notes-and-latest-package-retention.md`                                                                       |
| Last reviewed   | 2026-05-24                                                                                                                          |
| Review cadence  | Event-driven; review if GitHub Releases becomes the long-term changelog archive or package distribution policy changes              |
| Source of truth | `CONTEXT.md`, `docs/releases/`, `.github/workflows/release.yml`, `apps/web/src/whatsNew`, and `docs/runbooks/release-operations.md` |
| Verification    | Confirm each release has a matching curated release note source, generated app data is current, and old GitHub packages are pruned  |

## Context

JCode publishes compiled desktop packages through GitHub Releases and also shows release history in the app. Previously, GitHub release notes were generated automatically while the in-app What's New entries were curated separately. This split made it easy for release notes to drift and made GitHub Releases look like both a changelog archive and a package distribution surface.

JCode also does not want old compiled desktop packages to remain visible on GitHub after newer packages are published. Git tags and npm package versions still need to remain durable audit and ecosystem records.

## Decision

JCode release notes are authored as concise, product-first Markdown files with structured frontmatter under `docs/releases/`. These files are the source of truth for both the GitHub Release body and the app's generated What's New / Release history data.

GitHub Releases are latest-package distribution surfaces, not the long-term changelog archive. The release workflow keeps the latest stable GitHub Release and, during active testing, the latest prerelease GitHub Release. Older GitHub Release pages and their assets are pruned after a new release publishes. Git tags and published npm package versions are not deleted by release pruning automation.

Release workflow artifacts are transport-only and should use one-day retention.

## Consequences

- Maintainers author one curated release note source per version instead of maintaining separate GitHub and app changelogs.
- The app and repository keep historical changelog content even when old GitHub Release pages are deleted.
- Release automation must fail when the required release note source is missing, generated app release data is stale, or GitHub Release pruning fails.
- Users see only current downloadable packages on GitHub, plus the latest prerelease package when prerelease testing is active.
- Recovering deleted GitHub Release pages requires republishing them from retained tags and release-note sources; the tags and npm package history remain available.
