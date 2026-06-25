# Local OpenCode Runtime Service

| Field           | Value                                                                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Status          | Active                                                                                                                                          |
| Type            | Operational runbook                                                                                                                             |
| Owner           | Operations and Engineering                                                                                                                      |
| Audience        | Local operators, maintainers, and automation agents                                                                                             |
| Scope           | Local JCode systemd service topology, external OpenCode runtime wiring, safe inspection commands, upgrade risk checks, and future WSL bootstrap |
| Canonical path  | `docs/runbooks/local-opencode-runtime.md`                                                                                                       |
| Last reviewed   | 2026-06-11                                                                                                                                      |
| Review cadence  | Event-driven; review when service wiring, runtime profile settings, OpenCode server mode, or local promotion helpers change                     |
| Source of truth | Observed local user systemd units, `jcode-start`, `jcode-opencode-start`, `jcs`, provider runtime source, and OpenCode server/config docs       |
| Verification    | Source-check named commands and service assumptions; redact secrets before sharing command output                                               |

## Purpose

Use this runbook when a local JCode deployment is wired to an external OpenCode
runtime service instead of letting JCode manage OpenCode internally.

The core shape is two services:

| Service                  | Role                      | Observed local deployment example                                                                          |
| ------------------------ | ------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `jcode.service`          | JCode headless server     | Runs from the operator's chosen installed checkout or package path and listens on `http://127.0.0.1:3775/` |
| `jcode-opencode.service` | External OpenCode runtime | Runs a pinned OpenCode binary with `opencode serve --hostname=127.0.0.1 --port=4096`                       |

`jcode.service` has `After=` and `Wants=` dependencies on
`jcode-opencode.service`, so the OpenCode runtime is requested before the JCode
headless server starts. A separate SSH tunnel service may exist on a local
machine, but it is not part of the core JCode/OpenCode two-service topology.

Do not copy local secrets, owner pairing links, cookies, private URLs, or private
hostnames into docs, issues, or support messages. Redact command output before
sharing it.

## Topology

```text
Browser or client
  |
  | JCode app auth and session cookies
  v
jcode.service
  |
  | provider runtime profile
  | optional OpenCode HTTP Basic auth when serverPassword is set
  v
jcode-opencode.service
```

JCode app auth and dev automation access are separate from OpenCode server HTTP
auth. OpenCode server HTTP auth is handled at the OpenCode runtime HTTP
boundary, where JCode can build SDK clients with Basic auth when the configured
runtime profile includes a server password.

## JCode Runtime Boundary

The provider boundary is stored and resolved in code, not in the systemd unit:

- `packages/contracts/src/settings.ts` stores
  `providers.opencode.serverUrl`, `serverPassword`, `runtimeProfiles`, and
  `activeRuntimeProfileId`.
- `apps/server/src/provider/openCodeRuntimeProfiles.ts` resolves a configured
  `serverUrl` to an external OpenCode runtime. If no external URL is configured,
  JCode falls back to managed OpenCode.
- `apps/server/src/provider/opencodeRuntime.ts` starts managed OpenCode with
  `serve --hostname --port`, or connects to the configured external `serverUrl`.
  SDK clients include optional Basic auth when `serverPassword` is set.
- `apps/server/src/provider/openCodeRuntimeHealth.ts` checks runtime
  reachability, inventory, agents, commands, skills, plugins, models, and
  required capabilities.

In the observed local deployment, JCode settings use an active runtime profile
whose `serverUrl` points at loopback port `4096`. Treat that as local state, not
a universal default.

## Service Details To Know

### JCode service

Observed local deployment:

- `jcode.service` description: `JCode headless server`.
- It is enabled and active.
- In Jay's observed deployment, it runs from a stable checkout. That is an
  example, not a default for every operator.
- It starts through a local `jcode-start` helper.
- The helper creates runtime home and state directories, exports `JCODE_HOME`,
  keeps legacy home aliases, reads or mints a JCode app auth token from state,
  trusts the installed checkout's toolchain file when needed, then starts
  `apps/server` on loopback.
- The observed listener is `http://127.0.0.1:3775/`.

Keep machine-specific paths and private URLs in local service files or local
state. They are examples, not committed application defaults.

### OpenCode runtime service

Observed local deployment:

- `jcode-opencode.service` description: `JCode external OpenCode runtime`.
- It is enabled and active.
- It starts through a local `jcode-opencode-start` helper.
- The helper points at a pinned OpenCode binary under runtime state.
- The observed host and port are `127.0.0.1` and `4096`.
- The helper unsets `OPENCODE_CONFIG_CONTENT` before starting OpenCode. This
  keeps the real OpenCode profile and config from being replaced by inline
  managed config.
- The helper executes OpenCode server mode with:

  ```bash
  opencode serve --hostname="$host" --port="$port" --print-logs --log-level INFO
  ```

The service may carry local resource controls such as memory, task, and CPU
limits. Treat those as operator tuning unless the service helper documents them
as required.

## WSL Settings Bootstrap

On WSL, prefer the Settings-native bootstrap when it is available:

1. Open **Settings -> Providers -> OpenCode**.
2. In the OpenCode runtime card, read the **Bootstrap** status.
3. If the state is `notInstalled`, choose **Install OpenCode runtime**.
4. If the state is `error`, choose **Repair runtime**.
5. Use **Check** to force a runtime health refresh after the service is ready.

The UI calls server-owned RPCs. The browser does not write service files or edit
settings directly. The server detects WSL, checks user systemd, renders the
runtime helper and service unit, starts or restarts `jcode-opencode.service`,
smokes `http://127.0.0.1:4096/`, then upserts the `wsl-opencode-service`
runtime profile.

Install and repair are owner-only operations because they write local service
files and mutate the active OpenCode runtime profile. Scoped remote client
sessions may read runtime status but must not be able to install or repair the
service.

Unsupported states are informational. If the bootstrap card reports that WSL or
user systemd is unavailable, do not use the Settings action as a workaround; fix
the environment first or use manual service diagnostics.

## Generated Files

The Settings bootstrap keeps generated runtime files outside the JCode checkout.
Current server source renders these portable paths relative to the WSL user's
home directory:

| Generated item         | Current Settings bootstrap path                              |
| ---------------------- | ------------------------------------------------------------ |
| Runtime directory      | `~/.local/share/jcode/runtime/opencode/`                     |
| OpenCode helper script | `~/.local/share/jcode/runtime/opencode/jcode-opencode-start` |
| User systemd service   | `~/.config/systemd/user/jcode-opencode.service`              |
| Runtime profile server | `http://127.0.0.1:4096/`                                     |
| Runtime profile id     | `wsl-opencode-service`                                       |

Older manual service examples may place the helper at
`~/.local/bin/jcode-opencode-start`. Treat that as an operator-chosen layout,
not the current Settings bootstrap default.

The helper script unsets `OPENCODE_CONFIG_CONTENT` and then starts OpenCode with
loopback-only server mode:

```bash
'<opencode-binary>' serve --hostname=127.0.0.1 --port=4096
```

The bootstrap currently resolves an existing `opencode` binary from configured
settings or `PATH`. It does not download the Windows managed-runtime sidecar or
install Windows packaging assets in this branch.

## Health Checks

The runtime card uses two checks:

- **Bootstrap status** checks whether the WSL lane is supported, whether user
  systemd is available, whether `jcode-opencode.service` exists and is active,
  whether port `4096` is free or reachable, and whether the OpenCode runtime
  profile can be reached.
- **Runtime health** reuses the normal OpenCode runtime health path to verify
  reachability, inventory, agents, commands, skills, plugins, models, and
  capability requirements.

For command-line inspection, use:

```bash
systemctl --user status jcode-opencode.service
systemctl --user cat jcode-opencode.service
journalctl --user -u jcode-opencode.service
curl --max-time 8 -fsS -o /dev/null http://127.0.0.1:4096/
```

## Repair

Use **Repair runtime** when the bootstrap status is `error`. Repair rewrites the
helper and service unit, runs `systemctl --user daemon-reload`, restarts
`jcode-opencode.service`, smokes the runtime URL, and upserts the same
`wsl-opencode-service` profile without creating duplicates.

Use manual repair only when Settings cannot run:

```bash
systemctl --user daemon-reload
systemctl --user restart jcode-opencode.service
curl --max-time 8 -fsS -o /dev/null http://127.0.0.1:4096/
```

## Safe Inspection Commands

Run these on the local machine that owns the user systemd services:

```bash
systemctl --user status jcode.service jcode-opencode.service
systemctl --user show jcode.service --property=Description,LoadState,ActiveState,SubState,FragmentPath,WorkingDirectory,ExecStart,After,Wants,Restart
systemctl --user show jcode-opencode.service --property=Description,LoadState,ActiveState,SubState,FragmentPath,WorkingDirectory,ExecStart,Restart,MemoryHigh,MemoryMax,TasksMax,CPUQuota
systemctl --user cat jcode.service
systemctl --user cat jcode-opencode.service
journalctl --user -u jcode.service
journalctl --user -u jcode-opencode.service
curl --max-time 8 -fsS -o /dev/null http://127.0.0.1:3775/
curl --max-time 8 -fsS -o /dev/null http://127.0.0.1:4096/
```

Before sharing output, redact secrets and machine-specific private values:

- tokens, cookies, passwords, and Basic auth values;
- owner pairing links;
- private URLs and hostnames;
- private service environment values;
- local paths if they reveal sensitive account or project names.

## Standard Health Check

1. Check both services.

   ```bash
   systemctl --user status jcode.service jcode-opencode.service
   ```

   Expected result: both services are loaded and active.

   If it fails: inspect the relevant unit and journal with the commands above.

2. Check service dependency wiring.

   ```bash
   systemctl --user show jcode.service --property=After,Wants
   ```

   Expected result: `jcode-opencode.service` appears in both `After=` and
   `Wants=`.

   If it fails: treat the local service wiring as incomplete. Do not edit repo
   code to compensate for a local unit issue.

3. Smoke the loopback endpoints.

   ```bash
   curl --max-time 8 -fsS -o /dev/null http://127.0.0.1:3775/
   curl --max-time 8 -fsS -o /dev/null http://127.0.0.1:4096/
   ```

   Expected result: both commands exit successfully.

   If it fails: check whether the service is running, whether the listener host
   and port changed, and whether the configured JCode runtime profile still
   points at the intended OpenCode server URL.

4. Use the local status helper when available.

   ```bash
   jcs
   ```

   Expected result: `jcs` reports the configured local repo branch, SHA, and
   status, both services, both loopback endpoint smoke checks, and the latest
   promotion record when the local helper records one.

   If it fails: read the failing section first. `jcs` is an inspection helper,
   not a repair script.

## Promotion Helpers

Use [Update Local Stable JCode](update-local-stable-jcode.md) for Jay's local
stable promotion flow.

- `jcup` is the frequent local update wrapper. It runs the dry run, promotion,
  and `jcs`.
- `jcu` is the lower-level promotion and rollback helper.
- `jcs` checks the configured repo, both services, both loopback endpoints, and
  the latest promotion record when the local helper records one.

## OpenCode Upgrade Risk Checklist

Use this checklist before changing the OpenCode runtime package or pinned binary
used by `jcode-opencode.service`.

- [ ] Record the current OpenCode binary path, version, and service status.
- [ ] Do not replace the pinned runtime service binary blindly.
- [ ] Check the OpenCode upstream server docs, config docs, changelog, and
      release notes before upgrading.
- [ ] Validate config precedence assumptions, especially that
      `OPENCODE_CONFIG_CONTENT` is not replacing the real runtime profile.
- [ ] Validate server mode assumptions, including `opencode serve`, loopback
      hostname, port, and any HTTP auth settings.
- [ ] Restart only `jcode-opencode.service` first when possible.
- [ ] Smoke the OpenCode endpoint, then smoke JCode provider behavior through the
      JCode app.
- [ ] Roll back by restoring the prior pinned runtime path or package and
      restarting `jcode-opencode.service`.

Do not claim version compatibility from this runbook alone. Confirm it from the
OpenCode release notes and local smoke checks.

## Troubleshooting

| Symptom                                   | Likely cause                                      | Fix                                                                                   |
| ----------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------- |
| JCode is active but provider calls fail   | Runtime profile points at an unreachable server   | Check the profile `serverUrl`, `jcode-opencode.service`, and loopback port `4096`     |
| OpenCode starts with the wrong config     | Inline config replaced the real profile           | Confirm the runtime helper unsets `OPENCODE_CONFIG_CONTENT` before `opencode serve`   |
| JCode starts before OpenCode is available | Missing or changed user unit dependency           | Check `After=` and `Wants=` on `jcode.service`                                        |
| Endpoint smoke check fails                | Service stopped, listener moved, or port blocked  | Inspect service status, unit files, and journals, then re-run the loopback curl check |
| Runtime inventory or capabilities fail    | OpenCode server reachable but incompatible config | Check runtime health output and compare agents, commands, skills, plugins, and models |

## Rollback

If a JCode promotion broke the local service, use the rollback path in
[Update Local Stable JCode](update-local-stable-jcode.md).

If an OpenCode runtime upgrade broke provider behavior:

1. Restore the prior pinned OpenCode runtime path or package in the local runtime
   state.
2. Restart only the runtime service first when possible.

   ```bash
   systemctl --user restart jcode-opencode.service
   ```

3. Smoke the runtime endpoint.

   ```bash
   curl --max-time 8 -fsS -o /dev/null http://127.0.0.1:4096/
   ```

4. Smoke JCode.

   ```bash
   jcs
   curl --max-time 8 -fsS -o /dev/null http://127.0.0.1:3775/
   ```

5. Restart `jcode.service` only if JCode still has stale provider state after the
   OpenCode runtime is healthy.

If the Settings bootstrap itself created the WSL runtime service and the goal is
to remove that lane entirely:

1. Stop and disable the user service.

   ```bash
   systemctl --user disable --now jcode-opencode.service
   ```

2. Remove the generated unit and helper only after confirming they are not
   operator-maintained manual files.

   ```bash
   rm -f ~/.config/systemd/user/jcode-opencode.service
   rm -f ~/.local/share/jcode/runtime/opencode/jcode-opencode-start
   systemctl --user daemon-reload
   ```

3. In Settings, switch OpenCode back to another runtime profile or clear the WSL
   profile before deleting runtime state.

Keep the bootstrap portable. Do not bake private hostnames, tokens, cookies,
owner pairing links, or machine-specific service values into repo defaults.
