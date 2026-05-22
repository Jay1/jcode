# Security Baseline

| Field           | Value                                                                                                                                   |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Status          | Active                                                                                                                                  |
| Type            | Security reference                                                                                                                      |
| Owner           | Security and Engineering                                                                                                                |
| Audience        | Maintainers, reviewers, release owners, and automation agents                                                                           |
| Scope           | Local-first runtime security posture, secret handling, publishable defaults, dependency hygiene, and security verification expectations |
| Canonical path  | `docs/security/baseline.md`                                                                                                             |
| Last reviewed   | 2026-05-22                                                                                                                              |
| Review cadence  | Event-driven; review when auth defaults, provider runtime exposure, update behavior, dependency posture, or release workflows change    |
| Source of truth | `apps/server`, `apps/desktop`, `.gitignore`, `package.json`, `.github/workflows`, release docs                                          |
| Verification    | Run Aikido on modified first-party code and focused tests for affected runtime behavior                                                 |

## Baseline Posture

JCode is a local coding-agent cockpit. Its safest default posture is local-first, explicit about external provider/runtime boundaries, and careful not to commit private operator state.

## Rules

- Do not commit tokens, auth cookies, owner pairing links, private tailnet URLs, or machine-specific service files.
- Do not use local CLI version checks as proof of external provider runtime freshness.
- Keep generated local state out of git, including `.sisyphus/`, `.brainstorm/`, `.vscode/`, and `.playwright-mcp/`.
- Scan modified first-party code with Aikido before completion.
- Treat desktop preload and server provider changes as security-sensitive boundaries.

## Review Checklist

| Change type              | Minimum review                                                      |
| ------------------------ | ------------------------------------------------------------------- |
| Provider adapter/runtime | Focused regression, security scan, runtime event-path review        |
| Desktop preload/update   | Build output check, source review, no private update token defaults |
| Release workflow         | CI/release source cross-check, no secret echoing                    |
| Docs/config defaults     | Confirm examples are generic and publishable                        |
