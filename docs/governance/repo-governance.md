# Repo Governance

| Field           | Value                                                                                                          |
| --------------- | -------------------------------------------------------------------------------------------------------------- |
| Status          | Active                                                                                                         |
| Type            | Governance reference                                                                                           |
| Owner           | Engineering                                                                                                    |
| Audience        | Maintainers, reviewers, and automation agents                                                                  |
| Scope           | Branch strategy, external reference usage, attribution, contribution posture, and publishable defaults         |
| Canonical path  | `docs/governance/repo-governance.md`                                                                           |
| Last reviewed   | 2026-05-28                                                                                                     |
| Review cadence  | Event-driven; review when branch policy, external reference usage, contribution policy, or attribution changes |
| Source of truth | `docs/jcode-operating-model.md`, `CONTRIBUTING.md`, `LICENSE`, `CREDITS.md`, `README.md`                       |
| Verification    | Cross-check local/remote branch policy, attribution docs, and public repo defaults                             |

## Current Policy

- `main` is the stable branch.
- Use short-lived `feature/*` branches for bounded risky changes.
- Treat OpenCode as the engine boundary and JCode's local workflow as the product boundary.
- Treat DPCode/T3Code as historical lineage and attribution context, not active product philosophy or automatic merge targets.
- Preserve MIT attribution in `LICENSE` and `CREDITS.md`.
- Keep public README mentions concise and avoid over-weighting upstream names in ordinary product copy.

## Contribution Posture

JCode is early and local-workflow oriented. `CONTRIBUTING.md` welcomes focused contributions while setting clear expectations for scope, validation, and project direction.

## Publishable Defaults

Committed defaults must not contain tokens, private network URLs, owner pairing links, machine-specific service files, or local agent/editor state.
