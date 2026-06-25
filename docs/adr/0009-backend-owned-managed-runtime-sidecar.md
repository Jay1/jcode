# ADR 0009: Backend-Owned Managed Runtime Sidecar

| Field           | Value                                                                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Status          | Accepted                                                                                                                                                     |
| Type            | Architecture decision record                                                                                                                                 |
| Owner           | Engineering                                                                                                                                                  |
| Audience        | Maintainers, reviewers, and automation agents                                                                                                                |
| Scope           | Runtime process ownership for managed provider sidecars in JCode desktop mode                                                                                |
| Canonical path  | `docs/adr/0009-backend-owned-managed-runtime-sidecar.md`                                                                                                     |
| Last reviewed   | 2026-06-07                                                                                                                                                   |
| Review cadence  | Event-driven; review if JCode adds a remote/hosted mode or changes provider runtime boundaries                                                               |
| Source of truth | `apps/server/src/provider/opencodeRuntime.ts`, `apps/server/src/provider/openCodeRuntimeHealth.ts`, `packages/contracts/src/providerDiscovery.ts`            |
| Verification    | Managed runtime spawns via server-side Effect ChildProcess; health checks gate desktop readiness; managed profiles are OpenCode-specific in contracts schema |

## Context

JCode packages a web UI, local server, and desktop shell. The Windows turnkey release needs to manage an OpenCode sidecar process: install, verify, start, stop, and repair. The PRD initially recommended that the desktop shell (Electron main process) should own the sidecar lifecycle. However, the codebase already implements server-side OpenCode process spawning, and moving that responsibility into the desktop layer would duplicate or fracture existing infrastructure.

## Decision

The backend server owns the managed provider sidecar lifecycle. The desktop shell owns the updater and the first-run trigger UI.

This aligns with existing code. `opencodeRuntime.ts` already has `startOpenCodeServerProcess` using Effect's `ChildProcess` from `effect/unstable/process` (not raw Node `child_process`). This is architecturally significant: Effect's process spawner integrates with the Effect runtime's fiber cancellation and structured concurrency semantics. The server also has runtime profiles with `managed`, `external`, and `remote` modes, health checks in `openCodeRuntimeHealth.ts` with states such as `unknown`, `checking`, `healthy`, `degraded`, `unreachable`, and `misconfigured`, and provider session dispatch. The desktop shell's role is limited to: triggering setup on first launch, rendering UI, handling Electron lifecycle events, and managing JCode application updates.

### Health Gate and Version Pairing (PRD Decision 10)

Managed runtimes use a best-effort version pairing strategy gated by health status:

1. On startup, check the existing managed binary's health via `checkOpenCodeRuntimeHealth`.
2. If the binary reports `healthy` or `degraded`, use it regardless of exact version match.
3. If the binary reports `unreachable`, `misconfigured`, or `unknown` after timeout, attempt a repair: re-download the expected version and re-verify.
4. The health states `healthy` and `degraded` are non-blocking for desktop startup. `unreachable`, `misconfigured`, and `unknown` (post-timeout) block the desktop at the splash screen and surface a retry/recovery prompt.

### Post-Install Download Pipeline (PRD Decision 7)

Managed runtime binaries are not bundled with the installer. They are downloaded on first launch only when:

- The user selects OpenCode as their provider, AND
- No existing OpenCode binary is detected on PATH or at the managed install path.

The download pipeline includes:

1. Disk space check before download.
2. Fetch from the configured release URL with progress reporting to the splash UI.
3. SHA-256 checksum verification against the published manifest.
4. Network failure: surface error with retry option on the splash screen. Do not silently fail or retry indefinitely.

### Fresh Sidecar Password Per Startup (PRD Decision 11)

The managed sidecar authentication token is generated fresh on each JCode launch and held in memory only. No OS credential store integration. The sidecar binds to loopback only and its lifecycle is tied to JCode's process, so persistent passwords are unnecessary. This means:

1. On server startup, generate a random token and pass it to the sidecar via the spawn command or environment.
2. Store the token in server-side memory for the session duration.
3. On server shutdown, the token is discarded. Next startup generates a new one.

### Native Windows Runtime First (PRD Decision 3)

The managed runtime targets native Windows OpenCode as the default. WSL is a fallback only if native Windows runtime health fails real-world testing. This ADR's scope is the lifecycle ownership regardless of platform; the native-vs-WSL choice is a deployment detail within the download pipeline.

### JCode Owns The Happy Path (PRD Decision 4)

JCode provisions, verifies, starts, and repairs the managed runtime without asking the user to manually install or configure OpenCode. The user's interaction is limited to: picking a provider in the first-run wizard (ADR 0010) and seeing a splash screen while the backend bootstraps. Error states surface actionable recovery options, not instructions to "install OpenCode manually."

### configMode Default (PRD Decision 13)

`startOpenCodeServerProcess` in `opencodeRuntime.ts` defaults `configMode` to `"inherit"`. For managed runtimes on clean Windows installs, the server must pass `configMode: "generated"` so the managed OpenCode instance gets an isolated configuration directory (`opencodeConfigDir`, `opencodeDataDir` from the runtime profile). The `"inherit"` default is correct for users who already have an OpenCode configuration and connect via `external` mode. The managed runtime profile creation code (Slice 6) must explicitly set `configMode: "generated"`.

## Consequences

- Runtime management code lives in the server, not the desktop shell. New files for install, verify, and repair extend `apps/server/src/provider/`.
- CLI and server-only modes can use the same runtime lifecycle without depending on Electron.
- Desktop needs a pre-readiness splash state that shows a setup message while the backend bootstraps the runtime. If bootstrapping fails (download failure, binary won't start, health check times out), the desktop must surface the error and offer retry/recovery actions -- it must not remain on the splash indefinitely.
- No new IPC bridge is needed between desktop and server for runtime management actions.
- The desktop process does not directly spawn or manage the OpenCode binary.
- Runtime profile architecture is preserved for OpenCode. `OpenCodeRuntimeProfile.provider` is `Schema.Literal("opencode")` in contracts -- managed profiles are OpenCode-specific. Other providers do not get managed runtime profiles in v1. A future ADR is needed if multi-provider managed runtimes are added.
- Health status gates desktop readiness: `healthy`/`degraded` allow proceed; `unreachable`/`misconfigured`/`unknown`-post-timeout block and surface recovery UI.
- The download pipeline runs entirely server-side. The desktop only receives progress events for the splash UI.
- Managed sidecar passwords are memory-only, generated fresh per startup. No credential store integration, no password files on disk.
- The initial implementation targets native Windows OpenCode only. WSL support is a conditional future addition, not a v1 requirement.

## Implementing Issues

| Slice   | Issue   | Title                                            | Implements                                                  |
| ------- | ------- | ------------------------------------------------ | ----------------------------------------------------------- |
| 4       | #72     | Managed OpenCode download and verify             | Post-Install Download Pipeline (D7)                         |
| 5       | #83     | Backend-owned managed OpenCode sidecar lifecycle | Core decision (D6), Fresh Password (D11), Health Gate (D10) |
| 6       | #81     | Managed runtime profile auto-creation            | configMode Default (D13), Runtime Profiles Visible (D5)     |
| 7       | #85     | Runtime health, repair, and diagnostics export   | Health Gate repair flow (D10), Native First (D3)            |

Slices 4 and 5 are the primary implementation. Slice 6 extends the profile model. Slice 7 adds the repair loop.

## Alternatives Considered

**Desktop owns sidecar.** Would require moving process spawning code out of the server or duplicating it, adding an IPC bridge for runtime actions, and creating a mode split between desktop and CLI/server-only operation. Rejected because the server already has all the necessary infrastructure, including Effect-structured process management that the Electron main process would not naturally use.
