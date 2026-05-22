# Docs Agent Guide

| Field           | Value                                                                                                     |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| Status          | Active                                                                                                    |
| Type            | Documentation subtree guidance                                                                            |
| Owner           | Engineering                                                                                               |
| Audience        | Documentation maintainers, reviewers, and automation agents                                               |
| Scope           | Structure, metadata, source-of-truth rules, verification expectations, and anti-patterns for `docs/` work |
| Canonical path  | `docs/AGENTS.md`                                                                                          |
| Last reviewed   | 2026-05-22                                                                                                |
| Review cadence  | Event-driven; review when docs structure or repo workflow changes                                         |
| Source of truth | `docs/README.md`, category indexes, runtime source, package scripts, and root `AGENTS.md`                 |
| Verification    | `git diff --check` plus source cross-checks for referenced commands, paths, and runtime behavior          |

## Rules

- Keep docs source-grounded; do not invent commands, scripts, environment variables, or runtime behavior.
- Prefer category indexes and scenario tables over long prose-only documents.
- Use relative links within `docs/`.
- Keep metadata tables current when adding or substantially changing a document.
- Do not duplicate large source snippets; link to canonical source paths and summarize the invariant.

## Structure

```text
docs/
|-- README.md
|-- AGENTS.md
|-- adr/
|-- api/
|-- architecture/
|-- governance/
|-- runbooks/
|-- security/
`-- testing/
```

## Verification Expectations

- Documentation-only edits: run `git diff --check` and manually inspect changed links.
- Docs that name commands: run or source-check those commands.
- Docs that describe runtime behavior: cross-check the relevant source or tests before editing.
- Docs that describe release/security posture: check `.github/workflows`, `package.json`, and relevant runbooks.

## Anti-Patterns

- Do not turn personal notes, scratch plans, or agent state into permanent docs without curating them.
- Do not move existing historical docs unless the caller explicitly asks for a cleanup/restructure.
- Do not claim CI, release, or security guarantees beyond what the repo actually enforces.
