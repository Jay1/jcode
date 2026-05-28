# Repository Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the GitHub-facing contribution flow professional, present JCode as independently directed, and verify the repository has no obvious committed secrets or generated artifacts.

## Files

- `.github/pull_request_template.md`: custom JCode PR checklist and reviewer context.
- `CONTRIBUTING.md`: public contribution expectations and review flow.
- `README.md`: public project identity and attribution pointer.
- `CREDITS.md`: required lineage attribution with independent-project framing.
- `AGENTS.md`, `CONTEXT.md`, and governance/runbook docs: repo policy and upstream posture.
- `docs/superpowers/specs/2026-05-28-repository-polish-design.md`: design record for this cleanup.
- `docs/superpowers/plans/2026-05-28-repository-polish.md`: implementation plan for this cleanup.

## Steps

- [x] Replace the inherited PR warning with a concise JCode PR template.
- [x] Rewrite `CONTRIBUTING.md` to welcome focused contributions while setting clear scope and quality expectations.
- [x] Rewrite public identity docs so DPCode/T3Code are historical lineage only, not active philosophy or direction setters.
- [x] Re-scan for obvious secrets and committed artifact patterns.
- [x] Run docs whitespace verification with `git diff --check`.
- [x] Run Aikido scan on modified first-party files.
- [x] Report findings, changed files, and any residual cleanup recommendations.

## Verification

- `git diff --check`
- Secret/artifact grep scans over the repository
- Aikido scan for modified first-party files
