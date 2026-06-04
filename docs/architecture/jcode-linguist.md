# JCode Linguist Repository Profiling

| Field           | Value                                                                                                                                                       |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status          | Active                                                                                                                                                      |
| Type            | Architecture reference                                                                                                                                      |
| Owner           | Engineering                                                                                                                                                 |
| Audience        | Server, web, and package engineers working on project identity, repository context, and language-aware UX                                                   |
| Scope           | `packages/jcode-linguist`, project language icon detection, and future repository language-profile consumers                                                |
| Canonical path  | `docs/architecture/jcode-linguist.md`                                                                                                                       |
| Last reviewed   | 2026-06-04                                                                                                                                                  |
| Review cadence  | Event-driven; review when language definitions, repository scan caps, `.gitattributes` support, project icon metadata, or repository-profile consumers move |
| Source of truth | `packages/jcode-linguist/src/index.ts` and `apps/server/src/project/Layers/ProjectLanguageIconResolver.ts`                                                  |
| Verification    | `bun run --cwd packages/jcode-linguist test` plus focused server resolver tests for project icon metadata                                                   |

## Purpose

JCode Linguist is the local repository-language profiling layer. It is inspired by GitHub Linguist's repository-language model, but it is implemented as a small TypeScript package so JCode does not inherit Ruby, `rugged`, `charlock_holmes`, or native packaging requirements.

Use it when JCode needs a durable answer to "what kind of project is this?" rather than adding project-specific sidebar icon rules.

## Upstream Reference

GitHub Linguist is used by GitHub.com to detect blob languages, ignore binary or vendored files, suppress generated files in diffs, and generate language breakdown graphs. Its CLI reports repository percentages by file size and can show per-file detection strategies.

JCode should reuse the model, not the Ruby runtime:

| Linguist concept                  | JCode equivalent                                                                                    |
| --------------------------------- | --------------------------------------------------------------------------------------------------- |
| Repository language breakdown     | `RepositoryLanguageProfile.languages`                                                               |
| Primary repository language       | `RepositoryLanguageProfile.primaryLanguageId` and `primaryLabel`                                    |
| Filename and extension strategies | `LANGUAGE_DEFINITIONS` in `packages/jcode-linguist/src/index.ts`                                    |
| Vendored/generated/doc exclusions | `shouldSkipPath` plus documentation-extension filtering                                             |
| Git repository mode               | Server resolver prefers `git ls-files -z` before bounded fallback scanning                          |
| `.gitattributes` overrides        | Basic `linguist-language`, `linguist-vendored`, and `linguist-generated` handling in JCode Linguist |

## Runtime Boundary

`packages/jcode-linguist` is pure and side-effect free. It receives file samples and returns a profile.

`apps/server` owns filesystem and process access. The project icon resolver:

1. keeps fast explicit framework/root-marker checks for known high-confidence cases;
2. prefers `git ls-files -z` to sample tracked repository files;
3. falls back to a capped scan of root files and common code directories for non-Git folders;
4. passes samples into JCode Linguist;
5. persists the inferred icon metadata through the existing project metadata event path.

The web UI must not scan repositories. It only renders persisted `iconMetadata`.

## Scoring Rules

JCode Linguist currently scores supported project icon languages by recognized file bytes, not raw file count. Documentation-only files do not create language weight. Framework identities such as Vue, Svelte, and React receive priority when explicit package metadata or framework files identify them.

The current confidence rule requires a dominant source language unless the result is an explicit framework identity. This avoids noisy icons for tiny mixed repositories while still recognizing repositories like `AET_RedOps`, where tracked Python files live under `scripts/` and `tests/` without a root Python manifest.

## Design Guardrails

| Rule                                                                                  | Reason                                                                                      |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Prefer tracked Git files when available.                                              | This matches repository language behavior better than root-marker checks.                   |
| Keep scan caps and timeouts explicit.                                                 | Project creation and startup backfill must stay non-blocking.                               |
| Add language definitions centrally.                                                   | Avoid project-specific conditionals in the resolver or sidebar.                             |
| Keep package output reusable beyond icons.                                            | Future consumers can use profile percentages for project context, command inference, or UX. |
| Add failing tests before expanding supported languages or scan behavior.              | Language detection can regress subtly across repositories.                                  |
| Do not vendor the Ruby Linguist gem into desktop/server runtime without a new review. | Native dependencies would complicate JCode packaging and local stable updates.              |

## Verification Expectations

| Change                                            | Expected verification                                                                                 |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Add a language definition                         | Add a package test in `packages/jcode-linguist/src/index.test.ts`.                                    |
| Change repository scan order, caps, or timeout    | Add or update resolver tests in `apps/server/src/project/Layers/ProjectLanguageIconResolver.test.ts`. |
| Use repository profile data outside icons         | Add consumer-specific tests and keep the package API generic.                                         |
| Change `.gitattributes` or generated-file support | Add package tests that prove override/exclusion behavior without touching server filesystem logic.    |
| Change project icon metadata contract behavior    | Run contracts tests and at least one affected server/web consumer test.                               |
