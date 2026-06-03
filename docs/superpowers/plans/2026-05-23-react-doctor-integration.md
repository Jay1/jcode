# React Doctor Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install React Doctor and make it a first-class report-only check in the root test workflow.

## File Structure

- `package.json`: add root `react-doctor` and `react-doctor:changed` scripts, update `test` to include the changed-file gate, and add `react-doctor` as a root dev dependency.
- `bun.lock`: update dependency resolution for `react-doctor` and its transitive packages.
- `docs/superpowers/specs/2026-05-23-react-doctor-integration-design.md`: record the design and trade-offs.
- `docs/superpowers/plans/2026-05-23-react-doctor-integration.md`: record this implementation plan.

## Tasks

- [ ] Source-check React Doctor CLI options from upstream docs.
- [ ] Install `react-doctor` as a root dev dependency with Bun.
- [ ] Add a root `react-doctor` script that scans `apps/web` in report-only mode.
- [ ] Add a root `react-doctor:changed` script that gates changed `apps/web` files with `--fail-on warning`.
- [ ] Update root `test` to run `turbo run test` and then `bun run react-doctor:changed`.
- [ ] Run `bun run react-doctor` and `bun run react-doctor:changed` and capture whether they exit successfully.
- [ ] Run focused verification for the changed workflow with `bun run test` if feasible; if too slow, run the closest focused commands and report the limitation.
- [ ] Run formatting or diff checks for changed docs and config.
- [ ] Run the mandatory Aikido scan for changed code/config files.
- [ ] Summarize changes, verification, and any React Doctor findings.

## Notes

- Keep the full scan non-blocking with `--fail-on none` so this adds visibility without failing existing CI on the historical backlog.
- Keep the test integration scoped to changed source files so it catches new React Doctor warnings without requiring a full historical React refactor first.
- Do not add a separate GitHub Actions workflow in this pass; root CI already runs `bun run test`.
- Do not commit automatically unless the user explicitly asks for a commit.
