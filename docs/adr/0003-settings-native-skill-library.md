# ADR 0003: Skill Library Is A Settings-Native Provider-Aware Capability Surface

| Field           | Value                                                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Status          | Accepted                                                                                                                                               |
| Type            | Architecture decision record                                                                                                                           |
| Owner           | Engineering                                                                                                                                            |
| Audience        | Maintainers, reviewers, and automation agents                                                                                                          |
| Scope           | Skill discovery, skill inventory UI, provider skill source boundaries, skill management actions (install/uninstall/enable/disable), and catalog search |
| Canonical path  | `docs/adr/0003-settings-native-skill-library.md`                                                                                                       |
| Last reviewed   | 2026-06-04                                                                                                                                             |
| Review cadence  | Event-driven; review if Skill Library becomes a remote marketplace, provider management actions ship, or source semantics change                       |
| Source of truth | `CONTEXT.md`, `docs/superpowers/specs/2026-06-01-skill-library-design.md`, `apps/web/src/settingsNavigation.ts`, and provider discovery contracts      |
| Verification    | Confirm `/settings` exposes Skill Library, provider source remains visible, and install/uninstall controls do not appear without capability support    |

## Context

JCode now discovers installed coding-agent skills from provider runtimes such as OpenCode and Codex. Composer `$` mentions can surface these skills inline, but users also need a first-class place to understand what skills are installed, where each skill comes from, and when a skill should be used.

The obvious first implementation choices conflict with the long-term product direction:

- A pure carousel is memorable but does not scale to hundreds of installed skills.
- Reusing the route-level `PluginLibrary` skills tab as-is would preserve a utilitarian provider-filtered browser rather than creating a Settings-native capability surface.
- Hiding provider boundaries would make future install, uninstall, enable, disable, and remote catalog semantics ambiguous because each provider can expose different skill metadata and management capabilities.

Skill Library is expected to become a major JCode module, not a temporary browser for OpenCode skills. The decision must guide future agents so the same carousel-versus-catalog and reuse-versus-dedicated-surface trade-off is not reopened without new facts.

## Decision

JCode will treat Skill Library as a Settings-native, provider-aware capability surface.

The first implementation is a read-only installed-skills inventory. It must show installed skills across all providers that support skill discovery, make provider source visible, and reserve clear seams for later skill management. The visual design should use a dense, searchable, provider-grouped inventory as the complete browse path.

The Skill Library should be implemented as a dedicated Settings section and panel. It may reuse provider discovery helpers and small display patterns, but it should not render `PluginLibrary` wholesale as the main surface.

## Options Considered

### Option A: Pure carousel

| Dimension        | Assessment                                                                   |
| ---------------- | ---------------------------------------------------------------------------- |
| Complexity       | Low for v1                                                                   |
| Density          | Poor for hundreds of skills                                                  |
| Discovery        | Strong for a small subset                                                    |
| Future fit       | Weak because management/search/catalog actions need a complete inventory     |
| Provider clarity | Weak unless every card carries source and alternate browse paths still exist |

Pros:

- Visually memorable.
- Simple mental model for a small number of skills.
- Fits the initial phrase “skill carousel.”

Cons:

- Hides most installed skills off-screen.
- Scales poorly to 200+ skills.
- Makes search, filtering, result counts, and future management awkward.

### Option B: Reuse `PluginLibrary` skills tab as the Settings experience

| Dimension        | Assessment                                                                |
| ---------------- | ------------------------------------------------------------------------- |
| Complexity       | Low to medium                                                             |
| Density          | Existing utilitarian density                                              |
| Discovery        | Weak as a first-class Settings module                                     |
| Future fit       | Medium, but tied to plugin marketplace browsing assumptions               |
| Provider clarity | Strong within one provider, weaker for cross-provider installed inventory |

Pros:

- Reuses existing code.
- Already knows provider discovery contracts.
- Lower implementation cost.

Cons:

- Provider-filtered rather than unified across providers.
- Route-level plugin browser semantics leak into Settings.
- Does not create the distinct Skill Library module JCode needs.

### Option C: Settings-native dense provider-grouped inventory

| Dimension        | Assessment                                                                |
| ---------------- | ------------------------------------------------------------------------- |
| Complexity       | Medium                                                                    |
| Density          | Strong for hundreds of skills                                             |
| Discovery        | Strong through search, source filters, and grouped rows                   |
| Future fit       | Strong for details, install, uninstall, enable/disable, and catalog seams |
| Provider clarity | Strong because each row/card keeps explicit source metadata               |

Pros:

- Balances visual flair with real scan speed.
- Keeps Skill Library first-class inside Settings.
- Preserves provider source boundaries.
- Creates a durable seam for future management actions and remote catalogs such as skills.sh.

Cons:

- More custom UI than reusing `PluginLibrary` wholesale.
- Requires helper logic for aggregation, filtering, counts, and row rendering.
- Needs browser verification because it is visible Settings UI.

## Trade-Off Analysis

Option C best matches JCode's cockpit model. A cockpit should expose high-value operational capability surfaces without leaking provider protocol details, while still making provider source boundaries explicit when those boundaries affect behavior.

The dense inventory follows proven large-catalog patterns: search first, source filters, visible counts, grouped results, and clear empty states. This keeps the first version contained in the Settings layout and avoids horizontal browsing for large installed skill sets.

Keeping install and uninstall out of v1 avoids pretending all providers support the same management actions. Future management should be gated by provider-specific capability flags instead of generic buttons.

## Consequences

- `/settings` gains a durable `Skill Library` section.
- Provider discovery remains the source of installed skill data.
- UI code should aggregate provider-tagged skill rows client-side for v1.
- Provider source badges and groupings are mandatory, not decorative.
- A pure carousel must not be used as the complete browse surface for installed skills.
- `PluginLibrary` can be used as a reference, but not as the primary Settings Skill Library implementation.
- Future install, uninstall, enable/disable, detail drawers, trust metadata, and remote catalog search must respect provider capability differences.

## Skill Management Architecture (v2)

v1 shipped a read-only installed-skills inventory. v2 adds four management actions: install, uninstall, disable, and enable. This section records the architecture decisions for those actions.

### Management action primitives

| Action         | User-facing                                                                   | RPC                             | Server implementation                                                                                         | Provider gating flag                               |
| -------------- | ----------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Install        | "Install Skill" button in header → search modal → provider dropdown → install | `provider.installSkill`         | Shell out to `npx skills add <owner/repo> --agent <provider> --skill <name> -y`                               | `supportsSkillInstall`                             |
| Uninstall      | Trash icon per skill row → confirmation dialog                                | `provider.uninstallSkill`       | Shell out to `npx skills remove <skill> --agent <provider> -y`                                                | `supportsSkillUninstall`                           |
| Enable         | Toggle switch per skill row (on/off)                                          | `provider.setSkillEnabled`      | Provider-specific: Pi toggles `disableModelInvocation`; others rename skill directory with `.disabled` suffix | `supportsSkillToggle`                              |
| Disable        | Same toggle as Enable (flip to off)                                           | Same `provider.setSkillEnabled` | Same as Enable                                                                                                | `supportsSkillToggle`                              |
| Catalog search | Embedded in install modal search input                                        | `provider.searchSkillsCatalog`  | Shell out to `npx skills find <query>` and parse structured output, or query skills.sh API                    | `supportsSkillInstall` (search is part of install) |

### Hot-reload

No provider restart is required after install, uninstall, enable, or disable. The existing `forceReload` mechanism is sufficient:

- **Pi**: `session.reload()` or `resourceLoader.reload()` clears and rebuilds the skill list from disk.
- **Codex**: Cache bust + `skills/list` re-request to the app server.
- **OpenCode**: `client.app.skills({ directory })` re-queries the SDK, which reads from current disk state.
- **Claude**: Not applicable (returns empty skill list).

After any management mutation, the client should invalidate the `providerSkills` React Query cache and, if the provider supports `forceReload`, pass `forceReload: true` on the next `listSkills` call.

### Capability gating

All four management actions are gated behind new `ProviderComposerCapabilities` flags:

```
supportsSkillInstall: boolean
supportsSkillUninstall: boolean
supportsSkillToggle: boolean
```

These flags follow the same pattern as existing `supportsSkillDiscovery` and `supportsSkillMentions`. Install buttons, uninstall icons, and enable/disable toggles must not render when the provider does not declare the corresponding capability. The install modal's provider dropdown should only list providers with `supportsSkillInstall: true`.

### Why shell out to `npx skills`

The `skills` npm package (the CLI behind skills.sh) already knows each provider's skill directory conventions, handles GitHub repo resolution, symlink vs copy semantics, lockfile management, and skill name disambiguation. Reimplementing this in JCode would duplicate complex, provider-specific directory logic that the `skills` CLI already maintains.

Trade-offs:

- **Pro**: Correct by default for each provider. Handles edge cases like multi-skill repos and lockfiles.
- **Pro**: Automatically supports new providers when the `skills` CLI adds them.
- **Con**: Requires `npx` available in PATH. Adds ~2-5s latency per operation for package resolution.
- **Con**: `npx skills find` output parsing is fragile if the CLI changes format.

Mitigation: Pin the `skills` package version and wrap all `npx skills` calls in a `SkillManagementService` that returns typed results. If the CLI becomes a bottleneck, the service can be replaced with direct GitHub API calls later.

### New contracts

Four new input/result schemas in `packages/contracts/src/providerDiscovery.ts`:

```
ProviderInstallSkillInput   → { provider, cwd, packageRef, skillName, global?, providerOptions? }
ProviderInstallSkillResult  → { installedSkill: ProviderSkillDescriptor }

ProviderUninstallSkillInput → { provider, cwd, skillName, global?, providerOptions? }
ProviderUninstallSkillResult → { success: boolean }

ProviderSetSkillEnabledInput → { provider, cwd, skillPath, enabled, providerOptions? }
ProviderSetSkillEnabledResult → { success: boolean }

ProviderSearchCatalogInput  → { query: string }
ProviderSearchCatalogResult → { results: CatalogSkillEntry[] }
```

Four new WS RPC method names in `packages/contracts/src/ws.ts`:

```
providerInstallSkill: "provider.installSkill"
providerUninstallSkill: "provider.uninstallSkill"
providerSetSkillEnabled: "provider.setSkillEnabled"
providerSearchSkillsCatalog: "provider.searchSkillsCatalog"
```

### UI design

1. **Install**: Header "Install Skill" button (visible when any provider supports install) → modal with search input (debounced, calls catalog search) → results list with install counts → provider dropdown (filtered to `supportsSkillInstall` providers) → "Install" action button → loading state → success/refresh.
2. **Uninstall**: Trash icon on each skill row (visible when the row's provider supports uninstall) → confirmation dialog ("Remove [skill name] from [provider]?") → loading state → success/refresh.
3. **Enable/Disable**: Toggle switch on each skill row (visible when the row's provider supports toggle) → immediate mutation → loading state on toggle → success/refresh.

## Action Items

1. [x] Keep `CONTEXT.md` terminology aligned with this ADR.
2. [x] Keep the design spec in `docs/superpowers/specs/2026-06-01-skill-library-design.md` linked to this decision.
3. [x] Verify the Settings Skill Library renders with at least one provider runtime exposing skills.
4. [x] Gate future skill management actions behind provider capability flags.
5. [ ] Implement new contracts (`ProviderInstallSkillInput`, etc.) and WS RPC methods.
6. [ ] Implement `SkillManagementService` server layer wrapping `npx skills` calls.
7. [ ] Add capability flags to each provider adapter.
8. [ ] Implement Install modal UI in `SkillLibrarySettingsPanel`.
9. [ ] Implement Uninstall action (trash icon + confirmation) per row.
10. [ ] Implement Enable/Disable toggle per row.
11. [ ] Browser QA with Playwright verifying all four management actions.
