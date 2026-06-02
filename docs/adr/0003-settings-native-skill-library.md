# ADR 0003: Skill Library Is A Settings-Native Provider-Aware Capability Surface

| Field           | Value                                                                                                                                               |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status          | Accepted                                                                                                                                            |
| Type            | Architecture decision record                                                                                                                        |
| Owner           | Engineering                                                                                                                                         |
| Audience        | Maintainers, reviewers, and automation agents                                                                                                       |
| Scope           | Skill discovery, skill inventory UI, provider skill source boundaries, and future skill management seams                                            |
| Canonical path  | `docs/adr/0003-settings-native-skill-library.md`                                                                                                    |
| Last reviewed   | 2026-06-01                                                                                                                                          |
| Review cadence  | Event-driven; review if Skill Library becomes a remote marketplace, provider management actions ship, or source semantics change                    |
| Source of truth | `CONTEXT.md`, `docs/superpowers/specs/2026-06-01-skill-library-design.md`, `apps/web/src/settingsNavigation.ts`, and provider discovery contracts   |
| Verification    | Confirm `/settings` exposes Skill Library, provider source remains visible, and install/uninstall controls do not appear without capability support |

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

## Action Items

1. [x] Keep `CONTEXT.md` terminology aligned with this ADR.
2. [x] Keep the design spec in `docs/superpowers/specs/2026-06-01-skill-library-design.md` linked to this decision.
3. [x] Verify the Settings Skill Library renders with at least one provider runtime exposing skills.
4. [ ] Gate future skill management actions behind provider capability flags.
