# ADR 0006: Provider-Agnostic First-Run Wizard

| Field           | Value                                                                                                                                                 |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status          | Accepted                                                                                                                                              |
| Type            | Architecture decision record                                                                                                                          |
| Owner           | Engineering                                                                                                                                           |
| Audience        | Maintainers, reviewers, and automation agents                                                                                                         |
| Scope           | First-run setup experience for JCode desktop, covering provider detection, selection, and runtime provisioning                                        |
| Canonical path  | `docs/adr/0006-provider-agnostic-first-run-wizard.md`                                                                                                 |
| Last reviewed   | 2026-06-07                                                                                                                                            |
| Review cadence  | Event-driven; review if JCode changes provider abstraction or adds hosted provider support                                                            |
| Source of truth | `apps/web/src/routes/_chat.settings.tsx`, `packages/contracts/src/providerDiscovery.ts`, `apps/server/src/provider/providerMaintenance.ts`, `apps/server/src/provider/opencodeRuntime.ts` |
| Verification    | Wizard detects all 7 ProviderDiscoveryKind providers; credential-first detection checks API keys and config dirs before PATH binaries; OpenCode is the only provider with managed download in v1 |

## Context

The Windows turnkey release PRD initially described a first-run wizard focused on installing and configuring OpenCode. However, JCode supports seven providers (`codex`, `claudeAgent`, `cursor`, `gemini`, `kilo`, `opencode`, `pi` — from `ProviderDiscoveryKind` in `providerDiscovery.ts`), and the codebase default provider is `codex` (`DEFAULT_PROVIDER_KIND="codex"` in `orchestration.ts` line 76), not opencode. Forcing an OpenCode install on every user, including those who already have Codex or Claude configured, creates unnecessary friction and ignores existing provider infrastructure.

## Decision

The first-run wizard is provider-agnostic. It detects installed providers, presents the user with a choice of which agent to use, and only downloads or installs a managed runtime when the user selects a provider that requires one and does not already have it installed. For the MVP, only OpenCode has a managed download and install flow. Other providers use their existing connection mechanisms (API key paste, binary on PATH).

### Credential-First Detection Strategy (PRD Decision 9)

Provider detection uses a credential-first, binary-second strategy. This is architecturally important because credentials alone are sufficient for API-based providers (codex, claudeAgent, gemini, cursor), while binary-only detection misses users who have API keys configured but no local binary:

1. **Check provider credentials**: API keys in environment variables, config directories (e.g., OpenCode's `~/.config/opencode/`), and stored credentials.
2. **Check provider binaries on PATH**: Use existing `providerMaintenance.ts` binary discovery which handles Windows `.exe/.cmd/.bat` extensions.
3. **Present three states per provider**: "ready" (credentials and/or binary present), "needs credentials" (binary only), "needs setup" (neither).

### Detection Source Files

- `providerMaintenance.ts`: Binary detection, install source detection (`npm`, `bun`, `cargo`, `system`), version checking.
- `providerDiscovery.ts`: `ProviderDiscoveryKind` enum (7 providers), `OpenCodeRuntimeProfile` schema, `ProviderRuntimeMode` (`managed` | `external` | `remote`).
- `opencodeRuntime.ts`: `startOpenCodeServerProcess` for managed runtime spawn; relevant because the wizard triggers this for OpenCode managed installs.

### Wizard Flow

1. **"Which coding agent do you use?"** with auto-detected provider status indicators.
2. If the user picks a **ready** provider, skip to credentials verification.
3. If the user picks a provider **needing setup**, offer download and install (OpenCode only for MVP).
4. Provider credential connection (API key input or confirmation of existing credentials).
5. Project folder picker.
6. Ready.

### Clean Machine Handling

On a clean Windows machine where no providers are detected, the wizard must:

1. Show all providers with "needs setup" status.
2. Highlight OpenCode as the only provider offering a managed install ("Install for me").
3. For other providers, show a brief instruction ("Install X and restart JCode" or "Enter your API key").
4. If the user picks OpenCode, the managed download pipeline from ADR 0005 activates.

### OpenCode-Only Managed Scope

`OpenCodeRuntimeProfile.provider` is `Schema.Literal("opencode")` in contracts. Only OpenCode gets a managed runtime profile. Other providers use their existing binary-on-PATH or API-key-only connection modes. Adding managed support for other providers would require:

1. Extending the contracts schema with provider-specific runtime profile types.
2. Adding download URLs and verification for each provider's distribution.
3. This is explicitly deferred post-MVP.

## Consequences

- The wizard must not assume OpenCode is the default or required provider.
- Provider detection logic extends existing `providerMaintenance.ts` binary discovery with a credential-first layer.
- Only OpenCode needs a managed download and install pipeline in v1. Other providers' install flows are deferred to avoid schema changes and distribution complexity.
- The settings UI should eventually offer "Install runtime" per provider, but this is post-MVP.
- The wizard must handle the case where no providers are detected (clean machine) gracefully by showing all options with setup instructions.
- Provider selection is stored in settings and can be changed later.
- Credential-first detection means the wizard can surface "ready" providers even when no binary is on PATH, which is the common case for API-based providers.

## Implementing Issues

| Slice | Issue | Title | Implements |
|-------|-------|-------|------------|
| 2 | #73 | Credential-first provider scanning | Credential-First Detection (D9) |
| 3 | #84 | Provider-agnostic first-run wizard | Core decision (D8), wizard flow |

Slice 2 builds the detection backend. Slice 3 builds the wizard UI that consumes it.

## Alternatives Considered

**OpenCode-only wizard (original PRD).** Would be simpler to build but ignores the multi-provider reality of JCode, creates a worse UX for non-OpenCode users (who would be forced through an unnecessary install), and would need to be redesigned when adding other providers later. The codebase already has the infrastructure to detect 7 providers; not using it would be a waste.
