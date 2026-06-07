# ADR 0007: Parallel Windows + WSL Backend Routing

| Status | Proposed   |
| ------ | ---------- |
| Date   | 2026-06-06 |

## Context

JCode runs on macOS and Linux today. Windows users who develop inside WSL need JCode to run tooling (git, shell, provider CLI) inside the WSL Linux environment while the cockpit UI and desktop shell run on the Windows host. The two OS environments share a single machine but have different filesystem roots, process namespaces, and shell environments.

The existing `ServerEnvironment` service describes one environment per JCode server: a single `ExecutionEnvironmentDescriptor` with one `environmentId`, one `platform.os`, one `cwd`, and one label. Process spawning (`processRunner.ts`), terminal PTY management (`terminal/`), git operations (`git/`), and the provider runtime (`codexAppServerManager.ts`) all assume they run in a single local OS.

The CONTEXT.md decision states: "It should route each project or thread to the backend where its workspace lives rather than treating Windows and WSL as mutually exclusive global modes." The first slice is design-only: define project-to-backend routing, backend lifecycle, auth bootstrap, failure states, and user-visible mode transitions before implementation.

## Decision

### 1. Backend Abstraction

Introduce a **Backend** as a named execution environment within a single JCode server. Each backend owns:

- A unique `BackendId` (entity ID)
- A `BackendKind` — `local` (same OS as server), `wsl` (Windows Subsystem for Linux), future `ssh` or `docker`
- A `BackendConnection` — how to reach it (`local` = direct, `wsl` = `wsl.exe` bridge, `ssh` = SSH transport)
- An `ExecutionEnvironmentDescriptor` (reuses existing contract type — environmentId, label, platform, capabilities)

The JCode server always has exactly one **host backend** (where the server process runs). On Windows, it may discover one or more **WSL backends** (one per registered WSL distribution). On macOS and Linux, only the host backend exists.

```
BackendRegistry
  ├── host: Backend (kind=local, connection=direct)
  ├── wsl-ubuntu: Backend (kind=wsl, connection=wsl-exe, distro="Ubuntu")
  └── wsl-debian: Backend (kind=wsl, connection=wsl-exe, distro="Debian")
```

### 2. Project-to-Backend Routing

Each project (workspace root) is associated with exactly one backend at a time. The routing rule is:

1. **Path-based detection**: If the workspace root starts with `\\wsl$\` or `/mnt/` (WSL-to-Windows cross-mount), assign to the corresponding WSL or host backend.
2. **User override**: A project's `.jcode/settings.json` can specify `"backend": "wsl-ubuntu"` to force routing.
3. **Default**: If no WSL path detected and no override, use the host backend.

Routing is resolved at project-open time and cached. If the backend becomes unavailable, the project enters a degraded state (see Failure States).

Threads inherit the backend from their project. A thread cannot span backends. Worktrees within a project must live on the same backend as the project (worktree paths are backend-local).

### 3. Backend Lifecycle

```
                 ┌──────────┐
                 │ unknown  │  (server startup, before probe)
                 └────┬─────┘
                      │ probe
                 ┌────▼─────┐
           ┌─────│ probing  │
           │     └────┬─────┘
           │ fail     │ success
           │     ┌────▼─────┐
           │     │ healthy  │◄──── health check passes
           │     └────┬─────┘
           │          │ health check fails
           │     ┌────▼─────┐
           └────►│ degraded │──── probe recovers ────► healthy
                 └────┬─────┘
                      │ user dismisses / backend removed
                 ┌────▼─────┐
                 │ removed  │
                 └──────────┘
```

- **Probe**: On server startup (Windows host only), enumerate registered WSL distributions via `wsl.exe --list --quiet`. For each, run a lightweight command (`wsl.exe -d <distro> -- uname -m`) to verify availability and detect arch.
- **Health check**: Periodic (configurable, default 60s) lightweight command to verify the backend is responsive. WSL backends can become unavailable when the distribution is terminated (`wsl --terminate`) or the VM is stopped.
- **Auto-discovery**: New WSL distributions installed after server start should be detected on the next health-check cycle or when a project path references an unknown distribution.

### 4. Auth Bootstrap

Backend auth follows the existing server auth model:

- The JCode server process runs under the Windows user account.
- WSL commands execute as the default WSL user via `wsl.exe -d <distro>`. No separate auth is required — WSL inherits the Windows user's access via the WSL bridge.
- For backends with their own auth (future SSH, Docker), introduce `BackendAuthProvider` — a service that acquires credentials for a backend. `local` and `wsl` use a no-op provider.
- Capability token scopes (ADR 0005) apply at the JCode server level, not per-backend. A client with `thread:read` can observe threads on any backend the server can reach.

### 5. Transport Layer

Operations that need to run on a specific backend go through a `BackendTransport`:

- **Local transport**: Direct `child_process.spawn` with the project CWD. Current behavior.
- **WSL transport**: Spawn via `wsl.exe -d <distro> -- <command>` with path translation (`C:\path` → `/mnt/c/path` for Windows-to-WSL, `/home/user/project` → `\\wsl$\Ubuntu\home\user\project` for WSL-to-Windows).
- **Path translation**: Introduce `BackendPathResolver` that converts between host-native and backend-native paths. WSL path translation rules:
  - Host sees WSL paths as `\\wsl$\<distro>\<linux-path>`
  - WSL sees host paths as `/mnt/<drive-letter>/<path>`
  - CWD is always backend-native (Linux paths inside WSL)

Consumers that need backend-specific execution:

- `processRunner.ts` → `BackendProcessRunner` (wraps spawn with transport)
- `terminal/` PTY → `BackendPtyAdapter` (spawns PTY via WSL)
- `git/` → `BackendGitRunner` (git commands via transport)
- Provider runtime → `BackendProviderLauncher` (provider CLI via transport)

Each consumer receives a `Backend` reference and uses `BackendTransport` to execute. No consumer knows about `wsl.exe` directly.

### 6. Failure States

| Condition                    | Detection                        | Behavior                                                                                                                                      |
| ---------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| WSL not installed            | Startup probe returns empty list | Only host backend available. No WSL-specific UI shown.                                                                                        |
| WSL distribution terminated  | Health check fails               | Backend enters `degraded`. Threads on this backend show a reconnect banner. Running provider sessions surface an error. Terminals disconnect. |
| WSL distribution uninstalled | Path references unknown distro   | Backend moves to `removed`. Projects routed to it show a migration prompt (move project to host backend or remove).                           |
| Path translation failure     | Runtime error during spawn       | Surface as a backend error with the failing path. Suggest checking WSL distribution status.                                                   |
| Cross-mount performance      | User reports slow I/O            | Advisory warning in project settings. Recommend using native backend paths.                                                                   |

User-visible mode transitions:

1. Backend `healthy` → `degraded`: Toast notification "WSL Ubuntu disconnected". Threads show reconnect banner.
2. Backend `degraded` → `healthy`: Toast "WSL Ubuntu reconnected". Banners dismiss.
3. Backend `degraded` → `removed`: Project settings show migration prompt.

### 7. UI Implications

- Project picker shows backend badge (native icon for host, WSL penguin icon for WSL backends).
- Thread header shows backend when not host (collapsed when host-only setup).
- Terminal tabs show backend indicator when running on non-host backend.
- Settings page has "Backends" section listing discovered backends with status.
- No global "WSL mode" toggle — routing is per-project.

### 8. Implementation Slices

1. **Backend model** — `BackendId`, `BackendKind`, `BackendConnection`, `Backend` type in contracts. `BackendRegistry` service.
2. **WSL discovery** — Startup probe for WSL distributions, health check loop.
3. **Transport abstraction** — `BackendTransport` interface, `LocalTransport`, `WslTransport`.
4. **Path translation** — `BackendPathResolver` with Windows ↔ WSL path rules.
5. **Process runner integration** — `BackendProcessRunner` wrapping `processRunner.ts`.
6. **Terminal integration** — `BackendPtyAdapter` spawning PTY via WSL transport.
7. **Git integration** — `BackendGitRunner` routing git commands.
8. **Provider integration** — `BackendProviderLauncher` routing provider CLI.
9. **Project routing** — Path-based detection, user override, routing cache.
10. **UI** — Backend badges, reconnect banners, settings section.

## Consequences

**Positive:**

- Windows users can work with projects inside WSL without leaving JCode.
- Multiple WSL distributions supported simultaneously (Ubuntu + Debian in parallel).
- Per-project routing avoids the "global WSL mode" UX trap — some projects can be on the host, others in WSL.
- Transport abstraction is reusable for future SSH/Docker backends.
- Backend model composes with existing auth (ADR 0005) and scope (ADR 0006) systems without changes.

**Negative:**

- Path translation is a source of subtle bugs (symlinks, case sensitivity, UNC path quirks). Needs thorough test coverage.
- WSL health-check polling adds background work. Must be lightweight.
- Cross-mount filesystem access (`\\wsl$\` from host, `/mnt/c/` from WSL) has poor I/O performance. Users need guidance to use native paths.
- Terminal PTY via WSL may have latency differences compared to local PTY. Needs real-world validation.

**Risks:**

- WSL2 networking and filesystem semantics differ from WSL1. The design should target WSL2 (current default) and treat WSL1 as best-effort.
- `wsl.exe` command-line interface may change between Windows versions. Probe and transport should pin to stable flags.

## Alternatives Considered

1. **Global WSL mode**: Toggle that switches the entire server to WSL execution. Rejected because users often have projects on both Windows and WSL filesystems, and global mode forces an either/or choice.

2. **WSL-only server**: Run the JCode server itself inside WSL, connect from Windows browser. Rejected because it breaks the desktop shell (Tauri) integration model and makes Windows-native projects harder to access. However, this remains a valid deployment mode — the design should not prevent it.

3. **SSH-based transport for WSL**: Use SSH to `localhost` into WSL instead of `wsl.exe`. Rejected because it requires SSH setup in every WSL distribution and adds key management. `wsl.exe` is the native bridge and requires zero config.

4. **Docker backend first**: Design Docker containers as backends before WSL. Rejected because WSL is the more immediate Windows developer need and shares the same transport abstraction. Docker can layer on the same `Backend` model later.
