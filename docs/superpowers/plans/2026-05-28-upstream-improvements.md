# Upstream Improvements Import Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import useful DPCode and T3Code improvements into JCode while preserving JCode's local-first product boundary.

## Import Backlog

### Small T3Code Fixes

- [ ] T3Code #2817: prevent composer Enter submit during IME composition.
- [ ] T3Code #2694/#2825: decode auth/session timestamp fields from JSON strings if JCode still needs it.
- [ ] T3Code #2781: fix Windows provider-update command behavior if the matching maintenance runner exists.
- [ ] T3Code #2816: reduce terminal drawer resize rerenders if component structure matches.
- [ ] T3Code #2827: provider-instance dialog render optimization if an equivalent JCode component exists.
- [ ] T3Code #2552: Add Project path picker tab completion if JCode has the matching command-palette flow.
- [ ] T3Code #2403: copy path button to diff headers if JCode's diff panel matches closely.
- [ ] T3Code #2308/#2758/#2213: project collapse/archive UX if the current sidebar/thread archive model matches.

### DPCode Reliability And UX Fixes

- [ ] DPCode #113: create-PR availability guard if not already present.
- [ ] DPCode #124: AskUserQuestion empty-answer fixes across providers.
- [ ] DPCode #115/#114: Kilo/OpenCode transcript and pending user-input auto-advance fixes where applicable.
- [ ] DPCode #101: OpenCode tool progress rows if not already covered by JCode's recent command-completion fix.
- [ ] DPCode #85: packaged desktop window before backend readiness if JCode desktop still has the issue.

### DPCode Deferred High-Value Imports

- [ ] DPCode #126/#127: cap thread snapshots and optimize capped snapshot hydration.
- [ ] DPCode #129 / v0.0.49: improve diff loading and startup hot paths.
- [ ] DPCode #128: Grok provider support and follow-up Grok discovery/state fixes from DPCode main.
- [ ] DPCode v0.0.48/v0.0.49 release-adjacent runtime fixes that are not version-bump-only commits.

## Execution Rules

- [ ] Work only in this isolated `feature/upstream-improvements` worktree.
- [ ] Prefer manual ports for small T3Code changes and cherry-picks for closely related DPCode commits.
- [ ] Skip release-version bump commits from upstreams.
- [ ] Do not force-update or clobber overlapping upstream tags.
- [ ] Use TDD where a practical test harness exists.
- [ ] Run focused tests and typechecks after each group.
- [ ] Run LSP diagnostics and Aikido on changed code before completion.
