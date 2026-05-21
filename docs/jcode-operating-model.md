# JCode Operating Model

## Intent

JCode is Jay's personal OpenCode cockpit. It should optimize for daily utility,
fast recovery, and low ceremony.

It is intentionally not a product bet. If a few people use it, fine. The main
job is to stay useful for Jay without depending on another maintainer's roadmap.

## Source Strategy

Treat upstream projects as source material:

- OpenCode is the engine boundary.
- DPCode is the current source baseline.
- T3Code is a parts bin for specific features or fixes.
- DPCode is also a parts bin after the baseline, not a boss.

Do not blindly merge upstream work into the stable branch. Use a canary branch
or service, test it, then promote only the useful pieces.

## Branch Strategy

- `main`: stable JCode source.
- `canary`: upstream pulls, experiments, and risky upgrades.
- `feature/*`: bounded changes.

Tag known-good deployable points before risky changes:

```bash
git tag -a jcode-known-good-YYYY-MM-DD -m "Known-good JCode state"
```

## Upstream Workflow

Fetch both upstreams:

```bash
git fetch upstream-dpcode
git fetch upstream-t3code
```

Inspect before cherry-picking:

```bash
git log --oneline main..upstream-dpcode/main
git log --oneline main..upstream-t3code/main
```

Prefer cherry-picks or small rebased branches over large merge commits until
JCode has enough independent test coverage.

## Public Repo Hygiene

Keep committed defaults publishable:

- No tokens or owner pairing links.
- No private tailnet URLs as default app configuration.
- No machine-specific service files as live defaults.
- Local service units and scripts should be examples or ignored overlays.
