# Repo Governance

| Field | Value |
| --- | --- |
| Status | Active |
| Type | Governance reference |
| Owner | Engineering |
| Audience | Maintainers, reviewers, and automation agents |
| Scope | Branch strategy, upstream usage, attribution, contribution posture, and publishable defaults |
| Canonical path | `docs/governance/repo-governance.md` |
| Last reviewed | 2026-05-22 |
| Review cadence | Event-driven; review when branch policy, upstream source usage, contribution policy, or attribution changes |
| Source of truth | `docs/jcode-operating-model.md`, `CONTRIBUTING.md`, `LICENSE`, `CREDITS.md`, `README.md` |
| Verification | Cross-check local/remote branch policy, attribution docs, and public repo defaults |

## Current Policy

- `main` is the stable branch.
- Use short-lived `feature/*` branches for bounded risky changes.
- Treat OpenCode as the engine boundary and upstream DPCode/T3Code as source material, not as automatic merge targets.
- Preserve MIT attribution in `LICENSE` and `CREDITS.md`.
- Keep public README mentions concise and avoid over-weighting upstream names in ordinary product copy.

## Contribution Posture

JCode is early and personal-workflow oriented. `CONTRIBUTING.md` intentionally discourages broad drive-by feature work and asks for small, focused PRs.

## Publishable Defaults

Committed defaults must not contain tokens, private network URLs, owner pairing links, machine-specific service files, or local agent/editor state.
