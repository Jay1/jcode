# Local Deploy Notes

| Field           | Value                                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Status          | Active                                                                                                                         |
| Type            | Operational runbook                                                                                                            |
| Owner           | Operations and Engineering                                                                                                     |
| Audience        | Local operators, maintainers, and automation agents                                                                            |
| Scope           | Local deployment shape, source checkout expectations, service boundaries, auth posture, promotion checks, and rollback posture |
| Canonical path  | `docs/runbooks/local-deploy.md`                                                                                                |
| Last reviewed   | 2026-06-04                                                                                                                     |
| Review cadence  | Event-driven; review when deployment scripts, publishability rules, local service assumptions, or security baseline changes    |
| Source of truth | Package scripts, `AGENTS.md` publishability rules, and `docs/security/baseline.md`                                             |
| Verification    | Source-check deployment assumptions and run focused formatting with `bunx oxfmt@0.52.0 --check <file>`                         |

These notes document the intended shape for a local JCode deployment without
committing user-specific runtime state as application defaults.

## Source Path

Use a local source checkout outside runtime state. Example:

```text
~/code/jcode
```

## Target Service Shape

A local deployment should be a user systemd service with:

- `Restart=always`
- short stop timeout
- control-group kill mode
- a dedicated state directory outside the repo
- a local-only HTTP listener proxied by the user's chosen secure transport

Machine-specific values can be kept in local service files, but the repo should
only carry generic examples.

## Auth Mode

For a private network deployment, app auth may be disabled at the service layer
only when network access is already restricted.

For a public/default setup, app auth should remain enabled.

## Promotion Checklist

Before switching a live local service to JCode:

1. Build JCode from the local source checkout.
2. Start it locally with a separate state directory.
3. Verify project list, thread open, agent start, and restart recovery.
4. Tag the known-good state.
5. Switch the service path and keep the previous service path as rollback.
