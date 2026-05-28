# OpenCode Skill Discovery Design

## Goal

Make OpenCode skills first-class in JCode so end users can discover, search, and insert available skills from the composer instead of memorizing `/skillname` invocations.

## Approved Direction

Use the existing active-provider discovery model. OpenCode should advertise skill discovery support and return its available skills through the existing `provider.listSkills` contract. The current `$skill` composer trigger, skill chips, and Skills library should then work for OpenCode without a parallel catalog system.

## Context

- `apps/web/src/composer-logic.ts` already detects `$` tokens as `skill` triggers.
- `apps/web/src/hooks/useComposerCommandMenuItems.ts` already maps provider skills into composer menu items.
- `apps/web/src/components/ChatView.tsx` already inserts selected skills with the provider-specific prefix and sends matching `ProviderSkillReference` entries with the turn.
- `packages/contracts/src/providerDiscovery.ts` already defines `ProviderSkillDescriptor`, `ProviderSkillReference`, `ProviderComposerCapabilities`, and `ProviderListSkills*` contracts.
- `apps/server/src/provider/Layers/OpenCodeAdapter.ts` currently reports `supportsSkillDiscovery: false`, so the web app does not request OpenCode skills.
- `apps/server/src/provider/openCodeRuntimeHealth.ts` already extracts skill names from OpenCode `consoleState.skills`, proving the runtime exposes at least some skill metadata.

## Options Considered

### Option A: Provider-native OpenCode discovery (recommended)

OpenCode implements the existing provider discovery contract by reading skills from the OpenCode runtime inventory and returning normalized `ProviderSkillDescriptor` values.

Trade-offs:

- Best fit with current architecture; no new frontend discovery concept.
- Keeps UX scoped to the selected provider, matching models, plugins, commands, and agents.
- Depends on OpenCode console metadata shape, so parsing must be defensive and degrade to empty results rather than failing the composer.

### Option B: Global JCode skill catalog

JCode builds a provider-agnostic skill registry across configured providers and shows one combined catalog in `$` autocomplete.

Trade-offs:

- Better long-term if skills become portable across providers.
- Harder to explain when the same name maps to different provider syntax or runtime support.
- Requires new contracts, UI grouping, deduplication, and send semantics.

### Option C: Static config/manual skill list

JCode reads known skill directories or a local config file directly and surfaces those entries.

Trade-offs:

- Fastest to build for one setup.
- Not durable for end users because it bypasses provider runtime truth and risks stale or unavailable skills.
- Does not scale to remote or external OpenCode servers.

## Design

OpenCode becomes a first-class skill-discovery provider by implementing `listSkills` in `OpenCodeAdapter` and enabling `supportsSkillMentions` and `supportsSkillDiscovery` in its composer capabilities.

Data flow:

1. User selects OpenCode and types `$` or `$query` in the composer.
2. `detectComposerTrigger` returns a `skill` trigger.
3. `ChatView` enables `providerSkillsQueryOptions` because OpenCode capabilities advertise skill discovery.
4. Web calls `provider.listSkills` with provider, cwd, thread id, and optional force reload through the existing native API.
5. OpenCode adapter loads runtime inventory through the existing discovery inventory path.
6. Adapter normalizes OpenCode skill metadata into `ProviderSkillDescriptor[]`.
7. Composer menu filters skills client-side using `buildSkillSearchBlob`.
8. Selecting a skill inserts `$skillName ` and records `{ name, path }` for the provider turn.

Skill descriptor normalization rules:

- `name` is the stable skill id/name from runtime metadata.
- `path` is a stable runtime path when provided; otherwise use a synthetic `opencode://skill/<name>` path.
- `description` comes from runtime `description` or equivalent summary fields when present.
- `interface.displayName` comes from display/title fields when present.
- `interface.shortDescription` comes from short description, summary, or description when concise enough.
- `enabled` defaults to true unless runtime metadata explicitly marks the skill disabled.
- `scope` is preserved if the runtime exposes it; otherwise omit it so current UI defaults to `Personal`.

Error behavior:

- Missing or unrecognized console skill metadata returns an empty skill list with `source: "opencode-runtime"` rather than failing the composer.
- Runtime inventory failures should surface through the existing provider discovery error path, preserving current loading and empty states.
- Kilo should remain unchanged unless its runtime exposes compatible skill metadata and product intent is explicitly expanded.

## Implementation Notes

- Reuse the `withDiscoveryInventory` helper in `OpenCodeAdapter` so active sessions and temporary discovery share one path.
- Add a small local normalizer for unknown skill metadata instead of exporting health-check internals.
- Extend `OpenCodeAdapter` tests with console state shapes covering arrays, keyed objects, missing fields, disabled skills, and empty metadata.
- Add a focused web test only if existing composer tests do not already cover OpenCode capability gating.

## Non-Goals

- No global cross-provider skill catalog.
- No new `$` syntax.
- No changes to slash command behavior.
- No skill installation or editing UI.
- No direct filesystem scanning of user skill directories.
- No changes to provider turn payload contracts.

## Acceptance Criteria

- OpenCode composer capabilities report skill discovery and skill mentions as supported.
- Typing `$` with OpenCode selected opens a skill menu populated from OpenCode runtime metadata.
- Typing `$query` filters by name, display name, short description, and description.
- Selecting a skill inserts `$skillName ` and the turn payload includes the matching `ProviderSkillReference`.
- The Skills library can show OpenCode skills through the existing provider toggle.
- Missing skill metadata degrades to an empty list without breaking composer input.
- Focused server tests pass for OpenCode skill metadata normalization and capability reporting.
- Focused web tests or manual browser QA confirm the composer menu path.

## Self-Review

- No placeholders remain.
- Scope is limited to OpenCode provider discovery, not a new catalog platform.
- The design uses existing contracts and UI surfaces instead of adding duplicate concepts.
- The main risk is OpenCode console metadata shape variance; the design mitigates it with defensive normalization and empty-list fallback.
