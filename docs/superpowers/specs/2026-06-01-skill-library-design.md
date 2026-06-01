# Skill Library Settings Design

## Summary

Add a settings-native Skill Library section that presents installed coding-agent skills across providers in a polished, source-aware discovery surface. The first iteration is read-only: it helps users recognize what skills are available, where they come from, and when they might use them. Install, uninstall, enable, disable, and remote catalog search are intentionally deferred.

## Context

JCode now has provider skill discovery for at least Codex and OpenCode. The composer can surface skills through `$` mentions, and `PluginLibrary` already contains a utilitarian provider-filtered skills tab. The requested feature is different: a memorable Settings experience that makes installed skills feel first-class and establishes a future seam for skill management.

This must fit JCode's local-first cockpit boundary. The UI should hide raw provider protocol details while still making provider source explicit.

## Goals

- Add a first-class `Skills` / `Skill Library` section to `/settings`.
- Show installed skills across all providers that support skill discovery.
- Make each skill easy to recognize at a glance: name, source provider, concise use case, installed status.
- Preserve provider boundaries for future management semantics.
- Create a clear future seam for install/uninstall/search flows, including possible `skills.sh` catalog integration.

## Non-Goals

- No installing skills in v1.
- No uninstalling, enabling, disabling, or editing skills in v1.
- No remote marketplace/catalog search in v1.
- No full prompt/content viewer in v1.
- No provider-specific management behavior hidden behind generic buttons.

## Recommended Seam

Implement this as a new Settings section using the existing settings route taxonomy in `apps/web/src/settingsNavigation.ts` and `apps/web/src/routes/_chat.settings.tsx`.

Do not reuse `PluginLibrary` as-is. It is provider-filtered and route-level, while this feature should be cross-provider, settings-native, and designed around recognition rather than plugin marketplace browsing.

The likely implementation seam is:

- Add a `skills` settings section id and nav item.
- Add a dedicated settings panel/component, for example `SkillLibrarySettingsPanel`.
- Use existing provider discovery React Query helpers such as `providerComposerCapabilitiesQueryOptions` and `providerSkillsQueryOptions`.
- Aggregate providers client-side for v1, since the existing per-provider discovery contract already exists and carries source metadata through provider identity.

## Information Architecture

The Skill Library section should use a search-first catalog pattern with a contained Settings-native inventory. This is intentionally not a carousel: with 200+ skills, users need predictable scanning, filtering, and result counts more than hidden horizontal browsing.

The section should include three levels:

1. Hero summary
   - Total installed skills.
   - Number of active skill sources/providers.
   - Read-only v1 message such as `Installed skills, ready for composer mentions`.

2. Search and source controls
   - Prominent search input directly above the complete inventory.
   - Provider/source filter chips with counts, including `All sources`.
   - Applied-filter summary when search or provider filters are active.
   - Optional density toggle between `Comfortable` and `Compact` if implementation cost stays low.

3. Provider-grouped inventory
   - Sections for OpenCode, Codex, Claude, Pi, and any future provider that exposes skills.
   - Each section shows dense capability rows by default, with a compact card treatment only where it does not reduce scannability.
   - Empty/unavailable provider states should explain whether the provider does not support skill discovery or simply returned no installed skills.

## Density Recommendation

Use a polished dense inventory, not a full-page card grid or carousel.

Public marketplace and catalog patterns converge on this split:

- Raycast Store and Chrome Web Store demonstrate how visual discovery can complement catalog search, but JCode's first Settings version should prioritize containment and scanning over rails.
- VS Code, JetBrains, GitHub Marketplace, and Open VSX use search, filters, sorting, and result counts as the durable path through large extension lists.
- Open VSX's public extension-listing architecture is the closest code-level analogue: a React listing container coordinates query state, search, category filtering, sort state, loading states, and infinite scrolling for large extension results.
- NN/g's card guidance says cards are visually engaging but less scannable and less space-efficient than lists when users are searching for a specific item.
- NN/g and Baymard filtering guidance both emphasize predictable, prioritized filters, visible applied filters, and result-count feedback for large result sets.

For JCode, the best balance is:

- Top: a compact cockpit hero with total skills, provider count, and read-only status.
- Flair: polished Settings cards, compact metrics, and provider glyphs inside contained rows.
- Workhorse: a dense grouped inventory where each row is about 72-96px tall on desktop and contains name, source badge, one-line description, and installed/read-only status.
- Scale: keep all filtering client-side for v1, but structure rendering so virtualized rows or per-provider pagination can be added if the installed count grows beyond a few hundred.
- Mobile: collapse provider filters into a tray/sheet or wrapped chips and use single-column compact rows.

Implementation notes for scale:

- Keep the v1 data model as an aggregated array of provider-tagged skill rows derived from existing per-provider queries.
- Separate query/control state from rendering state so virtualization, `Load more`, or per-provider pagination can be added without rewriting card presentation.
- Do not introduce server-side pagination in v1; installed skills are local provider data and current counts are expected to be hundreds, not tens of thousands.
- If rendering becomes heavy, prefer a virtualized dense list over paginating the user's installed inventory. `@tanstack/react-virtual` is already available in `apps/web`, so this does not require a new dependency. Pagination makes sense later for remote catalog search such as `skills.sh`.

Recommended implementation shape:

- Add `skills` to `SETTINGS_SECTION_IDS` and `SETTINGS_NAV_ITEMS` in `apps/web/src/settingsNavigation.ts`.
- Add a dedicated `SkillLibrarySettingsPanel` rather than rendering `PluginLibrary` inside Settings.
- Reuse provider display names/icons and the existing discovery helpers from `apps/web/src/lib/providerDiscovery.ts` and `apps/web/src/lib/providerDiscoveryReactQuery.ts`.
- Query provider capabilities first, then list skills for providers whose capabilities report skill discovery support.
- Normalize the aggregated rows into `{ provider, providerLabel, skill, searchBlob }` so search, counts, and rendering do not duplicate provider-specific logic.
- Keep future management actions behind capability flags; v1 should show no active install/uninstall controls.

Primary references:

- `https://code.visualstudio.com/docs/configure/extensions/extension-marketplace`
- `https://www.raycast.com/store`
- `https://www.jetbrains.com/help/idea/managing-plugins.html`
- `https://chromewebstore.google.com/`
- `https://github.com/marketplace`
- `https://deepwiki.com/eclipse/openvsx/3.2-extension-listing-and-search`
- `https://www.nngroup.com/articles/cards-component/`
- `https://www.nngroup.com/articles/filter-categories-values/`
- `https://www.nngroup.com/articles/applying-filters/`
- `https://baymard.com/blog/current-state-product-list-and-filtering`

Avoid these alternatives:

- Pure carousel: poor for 200+ skills because most items are hidden off-screen.
- Pure masonry/card grid: attractive but slow to scan, especially for similarly structured skill metadata.
- Plain table: dense but visually generic and not aligned with the desired first-class JCode feature feel.

## Card Model

Skill cards optimize for recognition, not actionability.

Each card should show:

- Skill name.
- Provider/source badge, e.g. `OpenCode`, `Codex`, `Claude`, `Pi`.
- Concise description derived from `interface.shortDescription`, `description`, or fallback text.
- Status badge: `Installed`.
- Reserved action slot for future management, visually present but not interactive if no action exists.

Avoid showing on-card file paths, dependency blobs, full skill content, raw provider protocol terms, or install/uninstall controls in v1.

## Interaction Design

The first iteration should support:

- Search across all visible skill names and descriptions.
- Provider filter, including `All sources` and one filter per provider with skill discovery support.
- Visible result counts for all skills, filtered skills, and each provider filter.
- Applied filter pills for active search/provider filters, each removable with one action.
- Loading skeletons per provider group.
- Error/empty states that do not imply the feature is broken when a provider lacks skill discovery.

Filtering should be instant and should not scroll the user away from their current position unless the active query changes from empty to non-empty. Search should reuse the existing provider discovery normalization path so `$analyze`, `analyze`, and related descriptions behave consistently with composer skill lookup.

## Visual Direction

Use a refined cockpit-library aesthetic rather than a generic marketplace grid.

Recommended visual cues:

- A compact overview card with subtle depth, source counts, and read-only status.
- Rows that feel like operational capability entries, not app-store listings.
- Existing JCode typography, spacing, theme tokens, sidebar route chrome, and Settings panel language.
- Provider icons where available, but keep names visible because source is semantically important.
- Dense rows with subtle gradient left rails or provider glyphs so the inventory has visual identity without sacrificing scan speed.
- A sticky or near-sticky search/filter band inside the settings panel if it does not fight the existing Settings header.

Do not introduce a separate visual universe. The page should feel like a premium Settings section inside JCode, not a detached marketing page.

## Future Extension Points

Reserve clear seams for later work:

- Details drawer for full skill content, path, dependencies, source metadata, and usage examples.
- `skills.sh` or remote catalog search.
- Install flow per provider.
- Uninstall/disable flow per provider.
- Trust/security metadata before installing third-party skills.
- Provider-specific management capability flags so unsupported actions never appear as generic broken buttons.
- Saved user preference for density or view mode, if later introduced.

## Risks

- Aggregating all providers can hide provider capability differences. Mitigation: keep source badges and provider sections explicit.
- A pure carousel will not scale to large skill counts. Mitigation: use the complete provider-grouped inventory as the primary surface.
- A full card grid can look better in screenshots but degrade real scanning. Mitigation: default to dense contained rows.
- Filter labels can mirror provider internals instead of user intent. Mitigation: use plain labels such as source provider, installed status, and capability family; avoid protocol jargon.
- Showing future management buttons too early can imply behavior that does not exist. Mitigation: reserve visual space without active install/uninstall controls.
- Reusing `PluginLibrary` wholesale could create a bland or provider-filtered experience. Mitigation: share helper logic where useful, but make a dedicated Settings panel.

## Acceptance Criteria

- `/settings` has a first-class Skill Library section.
- The section can show skills from every provider whose composer capabilities report skill discovery support.
- Users can search installed skills across providers.
- Users can filter installed skills by source provider and see result counts.
- Users can visually distinguish each skill's source provider.
- The first version is read-only and does not expose working or fake install/uninstall controls.
- The UI remains usable with hundreds of installed skills.
- Browser QA verifies the Settings section renders and at least OpenCode skills appear when the OpenCode runtime exposes `/skill` data.
