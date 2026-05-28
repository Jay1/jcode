# Contributing

Thanks for taking the time to improve JCode. This project is still evolving, so the best contributions are focused, well-explained, and easy to review.

## Before You Start

Open an issue first for non-trivial changes, product behavior changes, broad refactors, dependency swaps, or anything that changes project direction. Small bug fixes, typo fixes, and tightly scoped maintenance PRs can usually go straight to a pull request.

PRs are automatically labeled with a `vouch:*` trust status and a `size:*` diff size based on changed lines. External contributors may start as `vouch:unvouched` until we explicitly add them to [.github/VOUCHED.td](.github/VOUCHED.td).

## What Makes A Good PR

- Keep the change small and focused.
- Explain what changed and why it should exist.
- Include tests or a clear validation note for the affected area.
- Include before/after screenshots for UI changes.
- Include a short recording for animation, timing, or interaction changes.
- Avoid mixing unrelated fixes in one PR.
- Do not include secrets, personal environment files, build output, logs, or local editor state.

## Development Basics

Install dependencies with:

```bash
bun install
```

Use focused checks while developing:

```bash
bun run --cwd <workspace> test <path>
bun run --cwd <workspace> build
bun run --cwd <workspace> typecheck
```

Run only the checks that match the files you changed unless a maintainer asks for a broader verification pass.

## Project Boundaries

JCode is a local-first Bun/TypeScript monorepo for a coding-agent cockpit. Changes should preserve the local workflow, publishable defaults, MIT attribution, and the project boundaries documented in [AGENTS.md](./AGENTS.md), [CONTEXT.md](./CONTEXT.md), and [CREDITS.md](./CREDITS.md).

## Review Expectations

Maintainers may ask you to reduce scope, add tests, update docs, or split a PR before merging. A clear, focused PR with reproducible validation is the fastest path to review.
