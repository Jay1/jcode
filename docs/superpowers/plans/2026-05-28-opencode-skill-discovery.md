# OpenCode Skill Discovery Implementation Plan

| Field  | Value                                                                                     |
| ------ | ----------------------------------------------------------------------------------------- |
| Status | Ready                                                                                     |
| Date   | 2026-05-28                                                                                |
| Design | [OpenCode Skill Discovery Design](../specs/2026-05-28-opencode-skill-discovery-design.md) |

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make OpenCode skills discoverable through JCode's existing active-provider `$skill` composer flow and Skills library.

## File Structure

- `apps/server/src/provider/Layers/OpenCodeAdapter.ts`: add defensive OpenCode skill metadata normalization, implement `listSkills`, and advertise skill capabilities for OpenCode.
- `apps/server/src/provider/Layers/OpenCodeAdapter.test.ts`: add focused tests for capability flags and normalization of array, keyed object, missing, disabled, and empty skill metadata.
- `apps/web/src/components/ChatView.tsx`: only touch if existing query gating blocks OpenCode once capabilities are enabled; otherwise leave unchanged.
- `apps/web/src/hooks/useComposerCommandMenuItems.ts`: only touch if existing filtering/rendering fails for OpenCode descriptors; otherwise leave unchanged.
- `docs/superpowers/specs/2026-05-28-opencode-skill-discovery-design.md`: source design; update only if implementation reveals a contradiction.

## Acceptance Criteria

- OpenCode composer capabilities report `supportsSkillDiscovery: true` and `supportsSkillMentions: true`.
- `provider.listSkills` for OpenCode returns normalized `ProviderSkillDescriptor[]` from OpenCode runtime inventory metadata.
- `$` with OpenCode selected can populate the existing composer skill menu from provider discovery.
- `$query` filtering matches name, display name, short description, and description through existing web search helpers.
- Selecting a skill inserts `$skillName ` and preserves the selected `ProviderSkillReference` send path.
- Empty or missing OpenCode skill metadata returns an empty list without breaking composer input.
- Focused OpenCode adapter tests pass.
- LSP diagnostics show no new errors in modified files.
- Aikido scan reports no introduced security or secret findings for changed code files.
- Manual QA exercises the actual OpenCode skill discovery path or documents why it cannot run in the current environment.

## Tasks

- [ ] Load the implementation discipline skills: `test-driven-development` before code changes and `verification-before-completion` before claiming completion.
- [ ] Inspect the existing OpenCode adapter test helpers around mocked `OpenCodeInventory` and `withDiscoveryInventory` behavior.
- [ ] Write failing tests in `apps/server/src/provider/Layers/OpenCodeAdapter.test.ts` for `getComposerCapabilities()` advertising skill discovery and skill mentions.
- [ ] Run the focused OpenCode adapter test file and confirm the new capability test fails for the current implementation.
- [ ] Write failing tests for `listSkills()` using mocked `consoleState.skills` as an array of records with name, path, description, display metadata, scope, and enabled state.
- [ ] Add failing tests for keyed-object skill metadata, string-only metadata, empty metadata, and explicitly disabled metadata.
- [ ] Implement a local OpenCode skill normalizer in `OpenCodeAdapter.ts` with small helper functions for trimming strings, reading records, selecting names, selecting paths, and filtering invalid entries.
- [ ] Implement `listSkills()` in `OpenCodeAdapter.ts` using `withDiscoveryInventory`, returning `source: "opencode-runtime"` and `cached: false`.
- [ ] Update OpenCode composer capabilities to set `supportsSkillMentions: true` and `supportsSkillDiscovery: true`.
- [ ] Run the focused OpenCode adapter test file and make the server tests pass.
- [ ] Inspect web query gating in `ChatView.tsx`; only change web code if OpenCode capabilities still do not enable `providerSkillsQueryOptions`.
- [ ] If web code changes are needed, add or update a focused web test for OpenCode skill trigger menu enablement.
- [ ] Run LSP diagnostics on each modified TypeScript file.
- [ ] Run focused server tests for OpenCode adapter changes.
- [ ] Run focused web tests only if web code changed.
- [ ] Run an Aikido scan on changed TypeScript files.
- [ ] Manually QA by exercising `provider.listSkills` or the browser composer path with OpenCode selected; record the observed output or blocker.
- [ ] Do not commit unless the user explicitly requests a commit.

## Verification Commands

- `bun run --cwd apps/server test src/provider/Layers/OpenCodeAdapter.test.ts`
- `bun run --cwd apps/web test <focused-web-test>` if web tests are changed or added.
- `lsp_diagnostics` on modified files.
- Aikido scan on changed code files.

## Notes

- Keep the first implementation server-side. The existing web composer path is already provider-capability driven and should not need a new UI concept.
- Do not add a global skill catalog in this work.
- Do not scan local skill directories from the web app or server filesystem unless OpenCode runtime metadata proves insufficient and the design is revisited.
