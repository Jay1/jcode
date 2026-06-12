# WSL OpenCode Runtime Bootstrap Design

## Summary

Add a Settings-native installer for an OpenCode runtime service in WSL. The user installs or repairs OpenCode from Settings -> Providers -> OpenCode, JCode creates a WSL user-systemd `jcode-opencode.service`, updates the OpenCode runtime profile, and verifies the service through the existing runtime health panel.

## Context

JCode already has two related but distinct lanes:

- The Windows turnkey lane, which is being developed separately and uses a guided first-run flow plus managed-runtime sidecar concepts.
- The WSL service lane, where an end user chooses to run JCode as a service in WSL and use it from a browser.

This design focuses only on the WSL lane. It does not implement or modify the Windows installer work. The same Settings affordance can later choose an OS-specific backend: Windows JCode can install a Windows-flavoured runtime, while WSL JCode installs a WSL user service.

Current source seams already support most of the runtime side:

- `apps/web/src/components/OpenCodeRuntimeSettingsPanel.tsx` displays OpenCode runtime health and has a `Check` action.
- `apps/web/src/routes/_chat.settings.tsx` places that panel under Settings -> Providers -> OpenCode runtime and exposes OpenCode binary/server fields in the provider tools section.
- `packages/contracts/src/providerDiscovery.ts` defines `OpenCodeRuntimeProfile`, runtime modes, config modes, health statuses, mismatches, and `ProviderGetRuntimeHealthInput`.
- `apps/server/src/provider/openCodeRuntimeProfiles.ts` resolves external and managed OpenCode runtime profiles.
- `apps/server/src/provider/openCodeRuntimeHealth.ts` validates runtime reachability and capabilities.
- `apps/server/src/wsRpc.ts` already exposes `provider.getRuntimeHealth`, `server.getSettings`, and `server.updateSettings`.
- `docs/runbooks/local-opencode-runtime.md` documents the observed two-service topology and service assumptions.

The Windows managed-runtime branch adds useful concepts but should not be copied wholesale. ADR 0005's durable principle is that the server owns runtime lifecycle and Settings/desktop surfaces trigger and report it. For WSL, lifecycle ownership should mean installing and managing a user-systemd service, not spawning an in-process child sidecar.

## Goals

- Add an `Install OpenCode runtime` action in Settings -> Providers -> OpenCode when JCode is running in the WSL service lane and no usable local OpenCode runtime is detected.
- Install or locate OpenCode inside the current WSL distro, not on the Windows host.
- Create, enable, start, stop, and repair a WSL user-systemd `jcode-opencode.service` that binds OpenCode to loopback.
- Patch `providers.opencode.runtimeProfiles` and `activeRuntimeProfileId` so JCode uses the installed runtime through the existing runtime-profile path.
- Reuse the current runtime health panel and `provider.getRuntimeHealth` after installation.
- Document the installer lane, service ownership, runtime profile wiring, diagnostics, and rollback as part of the implementation so this work is not a black box.
- Keep the flow portable and publishable: no Jay-specific paths, private hostnames, tokens, cookies, owner pairing links, or local machine assumptions.
- Keep Windows installer work separate, while leaving room for the same UI action to dispatch OS-specific installers later.

## Non-Goals

- No full JCode-in-WSL installation flow in this slice.
- No Windows runtime installer implementation in this worktree.
- No global WSL mode or full backend-routing implementation from ADR 0007.
- No multi-distro backend registry work beyond detecting/reporting the current WSL context needed for this installer.
- No silent install on Settings page load. The user must explicitly click the install action.
- No management of private tunnels, remote exposure, or non-loopback OpenCode listeners.
- No persistence of generated secrets in browser storage or public docs.

## Recommended Approach

Implement a WSL-specific OpenCode runtime bootstrap service behind a Settings action.

The action is product-level, but the implementation is server-owned:

1. The web panel asks the server for OpenCode bootstrap capability/status.
2. If JCode is running in a supported WSL context and no reachable local runtime is configured, the panel shows `Install OpenCode runtime`.
3. Clicking the button calls a new server RPC to install or repair the runtime.
4. The server performs WSL-local installation work, writes user-systemd files, starts the service, updates OpenCode runtime profile settings, and returns a bootstrap snapshot.
5. The panel invalidates settings/status and calls `provider.getRuntimeHealth({ provider: "opencode", forceRefresh: true })`.

This keeps provider setup where the user expects it, under Settings -> Providers -> OpenCode, without turning this slice into a full installer for JCode itself.

Rejected alternatives:

- Reuse the Windows managed child-process sidecar directly. It fits desktop bootstrap, but a WSL service lane should survive shell restarts and behave like the documented `jcode-opencode.service` topology.
- Create both `jcode.service` and `jcode-opencode.service` from this Settings action. That mixes application deployment with provider runtime setup and should be a separate WSL installation lane.
- Docs-only bootstrap. Safer, but it misses the agreed product direction: Settings should install or repair skipped provider runtimes later.

## User Experience

The existing OpenCode runtime card should gain an installer state above or beside the `Check` action.

Suggested states:

- `Ready`: runtime health is `healthy` or `degraded`; show status and keep `Check`.
- `Not installed`: no OpenCode binary/service/profile was found; show `Install OpenCode runtime`.
- `Service stopped`: service exists but is inactive; show `Start runtime` and `Repair`.
- `Misconfigured`: service or profile exists but points at an unreachable URL/path; show `Repair runtime`.
- `Installing`: show progress text such as `Installing OpenCode`, `Writing service`, `Starting service`, `Checking runtime`.
- `Unsupported`: JCode is not running in the WSL lane or user-systemd is unavailable; show concise instructions and keep manual fields visible.

The provider tools section should continue to expose manual OpenCode binary/server fields for advanced users. The install action should not hide or remove manual configuration.

A successful install should result in a visible runtime card similar to:

```text
healthy    WSL OpenCode service    external
http://127.0.0.1:4096
Commands: N  Skills: N  Plugins: N  Agents: N  Models: N  Config: inherit
```

The profile label should make the lane clear, for example `WSL OpenCode service`.

## Runtime Service Design

The bootstrapper creates a WSL user service that mirrors the documented local runtime topology.

Service name:

```text
jcode-opencode.service
```

Default listener:

```text
http://127.0.0.1:4096/
```

Default command shape:

```bash
opencode serve --hostname=127.0.0.1 --port=4096 --print-logs --log-level INFO
```

The generated service should:

- Run as the current WSL user under user systemd.
- Bind to loopback only.
- Use a bootstrap-owned OpenCode binary path when JCode installed OpenCode, or a detected path when reusing an existing install.
- Unset `OPENCODE_CONFIG_CONTENT` before starting OpenCode so inline generated config does not replace the user's real runtime profile.
- Avoid writing machine-specific paths into committed docs or templates.
- Use deterministic state paths under XDG locations when possible, such as `$XDG_DATA_HOME/jcode/runtime/opencode` and `$XDG_CONFIG_HOME/systemd/user/jcode-opencode.service`.

The design should prefer an executable helper script over a long inline systemd command. That keeps quoting, env cleanup, and future service tuning testable.

Suggested generated artifacts:

```text
~/.local/share/jcode/runtime/opencode/opencode
~/.local/bin/jcode-opencode-start
~/.config/systemd/user/jcode-opencode.service
```

The installer should run:

```bash
systemctl --user daemon-reload
systemctl --user enable --now jcode-opencode.service
```

It should verify:

```bash
systemctl --user is-active jcode-opencode.service
curl --max-time 8 -fsS -o /dev/null http://127.0.0.1:4096/
```

## Server API Design

Add a narrow OpenCode runtime bootstrap RPC rather than overloading `server.updateSettings` or `provider.getRuntimeHealth`.

Candidate WS methods:

```text
provider.getRuntimeBootstrapStatus
provider.bootstrapRuntime
provider.repairRuntime
```

For v1, the payload can stay OpenCode-specific even if the method names are provider-shaped:

```ts
type ProviderRuntimeBootstrapStatusInput = {
  provider: "opencode";
};

type ProviderRuntimeBootstrapInput = {
  provider: "opencode";
  forceReinstall?: boolean;
};
```

Result shape should be a state snapshot, not raw command output:

```ts
type ProviderRuntimeBootstrapSnapshot = {
  provider: "opencode";
  lane: "wsl-service";
  state: "unsupported" | "notInstalled" | "installing" | "starting" | "ready" | "error";
  serviceName?: "jcode-opencode.service";
  binaryPath?: string;
  serverUrl?: string;
  profileId?: string;
  message?: string;
  checkedAt: string;
};
```

Errors should be actionable and redacted. The UI does not need raw `systemctl`, `curl`, or installer logs in v1. A later diagnostics export can include redacted command evidence.

## Settings And Profile Design

On successful bootstrap, the server updates `ServerSettings.providers.opencode` through `ServerSettingsService.updateSettings`, not by hand-editing settings JSON.

Create or update a profile like:

```ts
{
  id: "wsl-opencode-service",
  label: "WSL OpenCode service",
  provider: "opencode",
  mode: "external",
  configMode: "inherit",
  serverUrl: "http://127.0.0.1:4096",
  binaryPath: "<resolved WSL-local opencode path>",
  skillRoots: [],
  pluginRoots: [],
  requiredCommands: [],
  requiredSkills: [],
  requiredPlugins: [],
  requiredAgents: [],
  requiredModels: [],
  requiredEnv: [],
  requirements: [],
  capabilityPolicy: "warn"
}
```

Set:

```ts
{
  providers: {
    opencode: {
      runtimeProfiles: updatedProfiles,
      activeRuntimeProfileId: "wsl-opencode-service",
      serverUrl: "http://127.0.0.1:4096"
    }
  }
}
```

The legacy `serverUrl` field can be set for compatibility with the existing synthetic-profile fallback, but the runtime profile should be the primary durable state.

Do not store service passwords unless the OpenCode server mode being installed requires one. If a password is introduced later, generate it server-side and keep it out of browser storage and logs.

## Detection And Preconditions

The bootstrap status check should answer these questions before showing install actions:

1. Is JCode running on Linux under WSL?
2. Is user systemd available?
3. Is `systemctl --user` functional?
4. Is a supported OpenCode binary already present?
5. Does `jcode-opencode.service` already exist?
6. Is port `4096` already occupied?
7. Is an existing OpenCode runtime profile already reachable?

Suggested WSL detection sources:

- `process.platform === "linux"`
- `/proc/version` or `/proc/sys/kernel/osrelease` contains `microsoft` or `WSL`
- environment hints such as `WSL_DISTRO_NAME`, treated as hints rather than sole proof

Unsupported states should be explicit:

- Not WSL: hide WSL-specific installer or show the OS-appropriate installer later.
- WSL without user systemd: explain that user systemd must be enabled or fall back to manual fields.
- Port conflict: ask the user to change/stop the conflicting service or later support custom ports.

## Documentation Workstream

Documentation is part of the feature, not a follow-up. The implementation should update docs in the same branch as the code so future work can stitch this WSL lane together with the Windows installer lane without reverse-engineering runtime behavior from source.

Required documentation updates:

- `docs/runbooks/local-opencode-runtime.md`: describe the generated WSL `jcode-opencode.service`, helper script, state paths, install/repair commands, health checks, and rollback. Keep Jay's observed deployment separate from end-user WSL defaults.
- `docs/runbooks/local-deploy.md`: explain where the WSL OpenCode runtime bootstrap fits in local deployment and when users should use Settings instead of manual service files.
- `docs/runbooks/README.md`: add or adjust scenario links so operators can find WSL OpenCode runtime install, repair, and rollback instructions.
- `docs/architecture/provider-runtime.md`: document the provider-runtime ownership model: Settings triggers bootstrap, the server owns service/profile mutation, and runtime health remains the verification source of truth.
- `docs/adr/0007-parallel-windows-wsl-backend-routing.md` or a follow-up ADR: note that this feature is a narrow provider-runtime bootstrap inside WSL, not the full backend-routing implementation. This prevents future agents from confusing the two scopes.
- `docs/adr/README.md`: update the ADR index if a new follow-up ADR is added.
- `docs/security/baseline.md` or `docs/security/dev-automation-access.md` only if the implementation changes documented security posture, local loopback assumptions, or automation-access guidance.

The docs should include concrete examples but remain portable:

```text
~/.local/bin/jcode-opencode-start
~/.config/systemd/user/jcode-opencode.service
http://127.0.0.1:4096/
```

They must not include private hostnames, tailnet URLs, tokens, cookies, owner pairing links, service passwords, or Jay-specific stable checkout paths as end-user defaults.

The implementation plan should reserve explicit tasks for docs updates and source cross-checks. A feature is not done until the docs explain:

1. How the Settings action decides it is available.
2. What files and services it creates.
3. How the runtime profile points JCode at the service.
4. How to inspect health and logs.
5. How to repair or roll back the service.
6. How this WSL lane intentionally differs from the Windows installer lane.

## Security And Privacy

- Bind OpenCode to `127.0.0.1` by default.
- Never generate public, LAN, tailnet, or wildcard listeners from this flow.
- Redact command output before returning errors to the browser.
- Do not log tokens, cookies, owner pairing links, service passwords, private URLs, or private hostnames.
- Keep service files and helper scripts local to the user's WSL home.
- Do not write Jay-specific paths or observed local stable-service paths into generated files.
- Treat installer downloads as untrusted input: verify checksums when the upstream release publishes a digest; otherwise report that checksum verification is unavailable rather than pretending it happened.

## Failure And Repair

Repair should be explicit and idempotent.

`Repair runtime` may:

- Recreate the helper script.
- Recreate the user service file.
- Run `systemctl --user daemon-reload`.
- Restart `jcode-opencode.service`.
- Reapply the runtime profile patch.
- Re-run runtime health.

`Repair runtime` should not:

- Delete a user's unrelated OpenCode config.
- Replace an existing non-JCode OpenCode service without warning.
- Change listener host away from loopback.
- Reinstall JCode itself.

Rollback guidance should be surfaced in docs and diagnostics:

```bash
systemctl --user disable --now jcode-opencode.service
rm -f ~/.config/systemd/user/jcode-opencode.service
systemctl --user daemon-reload
```

The UI should keep manual provider fields available after failure so users can point JCode at their own runtime.

## Contract And Code Seams

Likely implementation areas:

- `packages/contracts/src/providerDiscovery.ts`: add bootstrap status/request/result schemas if the contract stays provider-scoped.
- `packages/contracts/src/ws.ts` and `packages/contracts/src/rpc.ts`: add WS method constants and RPC schemas for runtime bootstrap status/install/repair.
- `apps/server/src/provider/openCodeRuntimeBootstrap.ts`: new WSL service bootstrap/detect/repair logic.
- `apps/server/src/provider/openCodeRuntimeProfiles.ts`: reuse profile resolution; optionally add a helper for upserting the WSL service profile.
- `apps/server/src/provider/openCodeRuntimeHealth.ts`: reuse after bootstrap; do not duplicate inventory checks.
- `apps/server/src/wsRpc.ts`: wire new RPC handlers and call `ServerSettingsService.updateSettings` for profile updates.
- `apps/web/src/wsNativeApi.ts`: expose `provider.getRuntimeBootstrapStatus`, `provider.bootstrapRuntime`, and `provider.repairRuntime`.
- `apps/web/src/components/OpenCodeRuntimeSettingsPanel.tsx`: add installer state, install/repair buttons, progress/error display, and post-install health refresh.
- `docs/runbooks/local-opencode-runtime.md`: extend with generated WSL service paths and rollback once implementation details are finalized.

## Acceptance Criteria

- On JCode running inside supported WSL with no reachable OpenCode runtime, Settings -> Providers -> OpenCode shows `Install OpenCode runtime`.
- Clicking install creates or reuses an OpenCode binary inside WSL, writes the helper script and user service, enables and starts `jcode-opencode.service`, and binds OpenCode to `127.0.0.1:4096`.
- Successful install creates or updates the `WSL OpenCode service` runtime profile and makes it active.
- The existing `provider.getRuntimeHealth` path reports the installed runtime as `healthy` or a clear actionable degraded/error state.
- Manual OpenCode binary/server fields remain available for advanced configuration.
- Re-running install or repair is idempotent and does not duplicate runtime profiles.
- Unsupported environments produce clear UI states and do not attempt partial installation.
- Failure messages are redacted and actionable.
- Focused tests cover WSL detection, service-file rendering, profile upsert behavior, RPC contract validation, Settings panel state transitions, and repair idempotence.
- Runtime docs are updated in the same branch and cover install, generated files, service health, diagnostics, repair, rollback, and the distinction between WSL runtime bootstrap and Windows installer work.
- Documentation stays portable, source-grounded, and contains no private local values.

## Future Considerations

- OS-dispatching the same Settings action to a Windows runtime installer when JCode is installed on Windows.
- Custom ports when `4096` is occupied.
- Service diagnostics export with redacted `systemctl` and health evidence.
- Full WSL JCode service installation lane for users installing JCode itself into WSL.
- Integration with ADR 0007's future backend registry once project-to-backend routing exists.
