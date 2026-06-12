# Local Deploy Notes

| Field           | Value                                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Status          | Active                                                                                                                         |
| Type            | Operational runbook                                                                                                            |
| Owner           | Operations and Engineering                                                                                                     |
| Audience        | Local operators, maintainers, and automation agents                                                                            |
| Scope           | Local deployment shape, source checkout expectations, service boundaries, auth posture, promotion checks, and rollback posture |
| Canonical path  | `docs/runbooks/local-deploy.md`                                                                                                |
| Last reviewed   | 2026-06-11                                                                                                                     |
| Review cadence  | Event-driven; review when deployment scripts, publishability rules, local service assumptions, or security baseline changes    |
| Source of truth | Package scripts, `AGENTS.md` publishability rules, `docs/security/baseline.md`, and local service inspection                   |
| Verification    | Source-check deployment assumptions and run focused formatting with `bunx oxfmt@0.52.0 --check <file>`                         |

These notes document the intended shape for a local JCode deployment without
committing user-specific runtime state as application defaults. For the
JCode/OpenCode service topology, runtime profile boundary, and safe inspection
commands, use [Local OpenCode Runtime Service](local-opencode-runtime.md).

## Source Path

Run the service from the operator's chosen installed checkout or package path,
kept separate from runtime state such as generated auth, logs, and pinned runtime
binaries. If the operator uses a source checkout, one example path is:

```text
~/code/jcode
```

## Target Service Shape

A local deployment should keep JCode app serving and OpenCode runtime serving as
separate, inspectable responsibilities.

In one observed local deployment, the example service names and listeners are:

| Example service name     | Responsibility            | Example observed listener |
| ------------------------ | ------------------------- | ------------------------- |
| `jcode.service`          | JCode headless server     | `http://127.0.0.1:3775/`  |
| `jcode-opencode.service` | External OpenCode runtime | `http://127.0.0.1:4096/`  |

In that deployment, `jcode.service` has `After=` and `Wants=` dependencies on
`jcode-opencode.service`. Operators may choose different unit names or loopback
ports, but the same boundary should stay clear: JCode reads its OpenCode runtime
profile from settings; when that profile contains a `serverUrl`, JCode connects
to the external runtime instead of starting managed OpenCode.

Each user systemd service should have:

- `Restart=always`
- short stop timeout
- control-group kill mode
- a dedicated state directory outside the checkout or package path
- a local-only HTTP listener proxied by the user's chosen secure transport

Machine-specific values can be kept in local service files, but the repo should
only carry generic examples. Do not commit private hostnames, owner pairing
links, tokens, cookies, passwords, or private service URLs.

## WSL OpenCode Runtime Bootstrap

For WSL deployments, use **Settings -> Providers -> OpenCode** to install or
repair the OpenCode runtime service when that action is available. The Settings
flow lets the server own service file creation, runtime profile mutation, and
health verification, which keeps the deployment inspectable without requiring
users to hand-edit systemd files.

Manual `jcode-opencode.service` files remain useful for diagnosis, unsupported
environments, or operator-managed layouts. They should not be the first-time WSL
setup path once the Settings bootstrap can run.

## Auth Mode

For a private network deployment, app auth may be disabled at the service layer
only when network access is already restricted.

For a public/default setup, app auth should remain enabled.

## Promotion Checklist

Before switching a live local service to JCode:

1. Build or install JCode from the operator-chosen checkout or package path.
2. Start it locally with a separate state directory.
3. Verify project list, thread open, agent start, and restart recovery.
4. Tag the known-good state.
5. Switch the service source path and keep the previous source path as rollback.
