# Packages Agent Guide

## Scope

- `packages/contracts` defines shared contract and RPC types used across server, web, desktop, and scripts.
- `packages/shared` contains reusable domain utilities and pure logic.
- `packages/effect-acp` wraps ACP client/agent/protocol support and includes generated schema code.

## Commands

- Contracts: `bun run --cwd packages/contracts test`, `bun run --cwd packages/contracts build`, `bun run --cwd packages/contracts typecheck`.
- Shared: `bun run --cwd packages/shared test`, `bun run --cwd packages/shared typecheck`.
- Effect ACP: `bun run --cwd packages/effect-acp test`, `bun run --cwd packages/effect-acp build`, `bun run --cwd packages/effect-acp generate` when schema generation is intentionally needed.

## Patterns

- Prefer pure functions and colocated tests in `src`.
- Contract changes can ripple through every app; run downstream focused tests when changing exported types.
- Do not hand-edit generated files unless the generator or source schema is unavailable and the reason is documented.

## Verification

- Run the package's own focused tests first.
- For `packages/contracts`, also verify at least one affected consumer when changing exported event or RPC shapes.
