# Update Local Stable JCode

| Field           | Value                                                                                   |
| --------------- | --------------------------------------------------------------------------------------- |
| Status          | Active                                                                                  |
| Type            | Runbook                                                                                 |
| Owner           | Operations and Engineering                                                              |
| Audience        | JCode maintainers and local coding agents                                               |
| Scope           | Promote the latest GitHub `main` into Jay's local stable JCode service                  |
| Canonical path  | `docs/runbooks/update-local-stable-jcode.md`                                            |
| Last reviewed   | 2026-05-31                                                                              |
| Review cadence  | Event-driven; review when `jcup`, `jcu`, or JCode service wiring changes                |
| Source of truth | `/home/jay/.local/bin/jcode-stable-update`, `jcup`, `jcu`, `jcs`, `jcr`                 |
| Verification    | `jcup`, `jcup --fast`, `jcu main --dry-run`, `jcu main`, `jcs`, local HTTP smoke checks |

## Purpose

Use this when Jay says something like:

> Update my local stable JCode with the new stuff on GitHub.

The live service does **not** run from the dev repo at
`/home/jay/code/jcode`. It runs from the stable checkout at
`/home/jay/code/jcode-stable`.

The daily-driver promotion command is:

```bash
jcup
```

Use `jcup --fast` for rapid partial-release testing when build-level checks are
enough. `jcup` runs the dry run, the real promotion, and `jcs`. `jcu` remains
the lower-level wrapper for `/home/jay/.local/bin/jcode-stable-update`. It performs
the important checks, updates the stable checkout, builds, typechecks, restarts
JCode, runs local smoke checks, records the promotion, and rolls back if a
post-checkout failure happens.

## Quick Prompt For The JCode LLM

```text
Update Jay's local stable JCode from the latest GitHub main.

Important context:
- Dev repo: /home/jay/code/jcode
- Live stable repo: /home/jay/code/jcode-stable
- Live service runs from jcode-stable, not from the dev repo.
- Use `jcup` for frequent stable updates. It wraps the dry run, real promotion,
  and status check.
- Use `jcup --fast` only when build-level checks are enough for rapid partial-release testing.
- Use lower-level `jcu` only when diagnosing or rolling back. Do not manually
  git pull/reset the stable checkout unless the helper fails and you have diagnosed why.
- After promotion, run jcs and confirm jcode.service and
  jcode-opencode.service are active.
- Verify local endpoints:
  - http://127.0.0.1:3775/
  - http://127.0.0.1:4096/
- If the promotion fails, read the helper output. It may auto-roll back. Do not
  force through failures or use --allow-baseline-missing unless Jay explicitly
  approves a deliberate lane migration.

Report back:
- Previous stable SHA
- New stable SHA
- Promotion record path
- Whether services are active
- Whether local smoke checks passed
- Any rollback or blocker
```

## Frequent Testing Shortcut

For the normal 10-50x/day testing loop, use:

```bash
jcup
```

For a faster partial-release loop that skips typecheck and tests but still runs
fetch, build, restart, status, and local smoke checks, use:

```bash
jcup --fast
```

If the stable checkout is already at `origin/main`, `jcu` exits after service
preflight and smoke checks without writing a new promotion record.

## Standard Procedure

1. Check the live status.

   ```bash
   jcs
   ```

2. Confirm the stable checkout is clean.

   ```bash
   git -C /home/jay/code/jcode-stable status --short --branch
   ```

   If there are local changes, stop and report them. Do not discard them.

3. Run the dry run.

   ```bash
   jcu main --dry-run
   ```

   The dry run should:
   - fetch `origin/main`;
   - show the current stable SHA and target SHA;
   - refuse if `origin/main` does not contain the current live SHA;
   - check that `jcode.service` and `jcode-opencode.service` are active;
   - smoke the local JCode and OpenCode endpoints.

4. Promote stable.

   ```bash
   jcup
   ```

   Use `jcu main` directly only when debugging the lower-level helper.

   By default this runs the standard gate:
   - `bun install --frozen-lockfile`;
   - `bun run build`;
   - `bun run typecheck`;
   - `jcr`;
   - local HTTP smoke checks.

5. Confirm service health.

   ```bash
   jcs
   curl --max-time 8 -fsS -o /dev/null http://127.0.0.1:3775/
   curl --max-time 8 -fsS -o /dev/null http://127.0.0.1:4096/
   ```

6. Report the result to Jay.

   Include:
   - previous SHA;
   - new SHA;
   - promotion record path under
     `/home/jay/.local/state/jcode-stable-promotions/`;
   - service status;
   - smoke-check result;
   - any failure, rollback, or manual follow-up.

## Optional Dev Repo Sync

The dev repo is useful for source inspection and normal development:

```bash
git -C /home/jay/code/jcode status --short --branch
git -C /home/jay/code/jcode pull --ff-only
```

Only fast-forward the dev repo when it is clean. Do not use the dev repo as the
live service target.

## Failure Rules

- If `jcu main --dry-run` fails, do not run the real promotion.
- If `jcu main` fails, read the output first. The helper may have already
  rolled stable back to the previous SHA.
- Do not run `git reset --hard` manually in either repo unless Jay explicitly
  asks for that exact recovery.
- Do not use `--allow-baseline-missing` unless Jay explicitly approves a
  deliberate branch/lane migration.
- Do not use `--skip-tests` unless Jay accepts a build-only promotion.

## Useful Commands

```bash
jcup
jcup --fast
jcup feature/my-branch
jcu --help
jcu main --dry-run
jcu main
jcu main --test-level full
jcu --rollback
jcs
jcr
jclog
jcpair
```
