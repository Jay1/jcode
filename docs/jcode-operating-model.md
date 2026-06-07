# JCode Operating Model

## Intent

JCode is an independent OpenCode cockpit. It should optimize for daily utility,
fast recovery, local control, and low ceremony.

It is intentionally practical before it is promotional. The main job is to stay
useful without depending on another maintainer's roadmap, taste, or project
philosophy.

## Project Direction

JCode is independently directed. DPCode and T3Code are historical lineage and
may still be useful references, but they do not define JCode's product
philosophy, roadmap, contribution style, or release decisions.

- OpenCode is the engine boundary.
- JCode-specific user workflow is the product boundary.
- External ideas are evaluated only when they fit JCode's local-first direction.

Do not blindly merge external work into the stable branch. Review any external
idea on a short-lived feature branch, test it, then keep only the pieces that
match JCode's architecture and maintenance standards.

## Branch Strategy

- `main`: stable JCode source.
- `feature/*`: bounded changes.

Tag known-good deployable points before risky changes:

```bash
git tag -a jcode-known-good-YYYY-MM-DD -m "Known-good JCode state"
```

## External Reference Workflow

When reviewing historical-lineage repositories or other external projects, fetch
them explicitly and inspect changes before adapting any idea:

```bash
git fetch upstream-dpcode
git fetch upstream-t3code
```

Inspect before adapting anything:

```bash
git log --oneline main..upstream-dpcode/main
git log --oneline main..upstream-t3code/main
```

Prefer small, JCode-native changes over large merge commits or wholesale imports.

## Public Repo Hygiene

Keep committed defaults publishable:

- No tokens or owner pairing links.
- No private tailnet URLs as default app configuration.
- No machine-specific service files as live defaults.
- Local service units and scripts should be examples or ignored overlays.
