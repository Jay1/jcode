# JCode

[![CI](https://github.com/Jay1/jcode/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Jay1/jcode/actions/workflows/ci.yml)
[![Release Desktop](https://github.com/Jay1/jcode/actions/workflows/release.yml/badge.svg)](https://github.com/Jay1/jcode/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/github/license/Jay1/jcode)](./LICENSE)
![Bun](https://img.shields.io/badge/Bun-1.3.9-000000?logo=bun&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-24.13-5FA04E?logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)
![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/Jay1/jcode?utm_source=oss&utm_medium=github&utm_campaign=Jay1%2Fjcode&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)

JCode is a small personal code cockpit built around OpenCode.

It is seeded from a known-good DPCode state and keeps T3Code/DPCode as
attributed source lineages and cherry-pick sources. The goal is not to compete
as a product. The goal is to keep a useful daily coding surface that can move
at Jay's pace without depending on any single fast-moving UI project.

## Status

This repository is early and pragmatic:

- OpenCode is the engine boundary.
- DPCode is the current source baseline.
- T3Code and DPCode are parts bins for deliberate cherry-picks.
- Local deployment details should stay in ignored overlays or documented
  templates, not hard-coded into public defaults.

## Repository Shape

Recommended remotes:

```bash
git remote add upstream-dpcode https://github.com/Emanuele-web04/dpcode.git
git remote add upstream-t3code https://github.com/pingdotgg/t3code.git
```

Recommended branches:

- `main`: current stable JCode source.
- `canary`: upstream pull/cherry-pick testing.
- short feature branches for local changes before promotion.

Known baseline tag:

```bash
jcode-baseline-2026-05-21
```

## Development

This is still the inherited monorepo shape. Avoid broad package renames until
the deployment path is boring and rollback is obvious.

Common inherited commands:

```bash
bun install
bun run build
bun run typecheck
bun run dev
```

## Credits

Built from [DPCode](https://github.com/Emanuele-web04/dpcode) and
[T3Code](https://github.com/pingdotgg/t3code), with love. Powered by
[OpenCode](https://opencode.ai/).

See [CREDITS.md](./CREDITS.md) for lineage and attribution notes.
