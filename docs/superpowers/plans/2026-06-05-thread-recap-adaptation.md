# Thread Recap Adaptation Plan

| Field           | Value                                                                                                                                              |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status          | Proposed                                                                                                                                           |
| Type            | Upstream adaptation dossier and implementation plan                                                                                                |
| Owner           | Engineering                                                                                                                                        |
| Audience        | Maintainers, reviewers, and automation agents                                                                                                      |
| Scope           | Thread recap/current-state context, manual recap refresh UI, stored recap projection state, upstream adaptation, and the Persistent Goal Mode gate |
| Canonical path  | `docs/superpowers/plans/2026-06-05-thread-recap-adaptation.md`                                                                                     |
| Last reviewed   | 2026-06-05                                                                                                                                         |
| Review cadence  | Review before implementing thread recaps, goal mode, or any recap-backed continuation feature                                                      |
| Source of truth | `CONTEXT.md`, `docs/adr/0001-local-coding-agent-cockpit.md`, Synara commit `ff69476`, T3Code PRs #2013 and #2858, and JCode orchestration source   |
| Verification    | Focused contract, orchestration, persistence, web component, and recap-generation tests for each implementation slice                              |

## Decision Summary

Thread Recaps are the first upstream-roadmap implementation slice and the dependency gate for Persistent Goal Mode.

The first JCode slice should:

- store JCode-owned recap projection state on the thread model;
- expose a manual refresh UI near active thread controls;
- keep automatic refresh policy out of scope;
- avoid transcript insertion and sidebar snippets in the first UI;
- adapt upstream mechanics from Synara and T3Code before rewriting anything from scratch.

## Upstream Sources To Inspect

### Synara Recap Commit

Source: `Emanuele-web04/synara` commit `ff69476a69a3dba31d7f024e02ee3656938e00a6`, message `Add chat recap panel and terminal safeguards`.

High-signal files touched by that commit:

| Upstream file                                                                    | Adaptation interest                                                                    |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `docs/RECAP-thread-recap-panel.md`                                               | Read first for intended behavior, UI shape, and known caveats.                         |
| `apps/web/src/hooks/useThreadRecap.ts`                                           | Candidate for recap fetch/refresh hook mechanics.                                      |
| `apps/web/src/lib/threadRecap.ts` and `threadRecap.test.ts`                      | Candidate for client-side recap formatting/state helpers and tests.                    |
| `apps/web/src/components/ChatView.tsx` and `ChatView.logic.ts`                   | Candidate for active-thread UI integration and refresh state handling.                 |
| `apps/server/src/orchestration/decider.ts`                                       | Inspect for command/event shape, but adapt only if it fits JCode event-sourcing seams. |
| `apps/server/src/orchestration/projector.ts` and `Layers/ProjectionPipeline.ts`  | Candidate for projection update mechanics.                                             |
| `packages/contracts/src/rpc.ts`, `server.ts`, and `ws.ts`                        | Candidate for transport and contract shape, but do not copy names blindly.             |
| `apps/server/src/git/Layers/*TextGeneration.ts` and `Services/TextGeneration.ts` | Candidate for provider-backed text-generation abstraction used by recap refresh.       |

Adaptation notes:

- Treat Synara as the primary source for the recap panel and manual refresh workflow.
- Separate terminal-safeguard changes from recap work; they are not part of the JCode first slice.
- Preserve compatible tests when the behavior maps cleanly to JCode contracts.

### T3Code Shared Runtime And Scoped Auth Work

Sources:

- `pingdotgg/t3code` PR #2013, `T3 Code Mobile [WIP]`.
- `pingdotgg/t3code` PR #2858, `Use HttpApi for Environment APIs & standardize authn/authz`.

High-signal file groups from #2013:

| Upstream area                                               | Adaptation interest                                                            |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `apps/mobile/src/lib/connection.ts` and tests               | Inspect for client connection state and reconnect expectations, not mobile UI. |
| `packages/client-runtime` files from the PR                 | Inspect for reusable thread/detail/git/runtime state boundaries.               |
| `packages/shared` changes                                   | Inspect for state helpers that keep web and mobile clients consistent.         |
| Web connection, composer, sidebar, and git action refactors | Mine only if they clarify shared current-state flow.                           |

High-signal file groups from #2858:

| Upstream area                                                            | Adaptation interest                                                          |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `apps/server/src/auth/EnvironmentAuth*`                                  | Compare with JCode's proposed scoped capability-token model.                 |
| `apps/server/src/auth/Layers/*` and `Services/*`                         | Inspect auth-control-plane boundaries before writing JCode remote auth code. |
| `packages/contracts/src/environmentHttp.ts` or equivalent contract files | Use as a reference for typed remote-client HTTP boundaries.                  |
| Mobile connection tests                                                  | Mine for expected remote-client failure/retry semantics.                     |

Adaptation notes:

- T3Code #2013 is high-risk and broad; do not import the mobile app as a whole.
- Use T3Code as the secondary source for client-runtime and current-state boundary mechanics.
- Use #2858 to inform the remote auth ADR implementation, not the first recap UI slice.

## JCode Target Surfaces

These are likely JCode integration points. Confirm each against current source before editing implementation code.

| JCode area           | Candidate files                                                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Contracts            | `packages/contracts/src/orchestration.ts`, `packages/contracts/src/server.ts`, `packages/contracts/src/ws.ts`                                          |
| Server orchestration | `apps/server/src/orchestration/decider.ts`, `apps/server/src/orchestration/projector.ts`, `apps/server/src/orchestration/Layers/ProjectionPipeline.ts` |
| Persistence          | `apps/server/src/persistence`, migrations, and thread-detail snapshot hydration paths                                                                  |
| Text generation      | Existing provider text-generation services under `apps/server/src/git/Services/TextGeneration.ts` and provider-specific layers                         |
| Web state            | `apps/web/src/store.ts`, thread-detail state, and active-thread selectors                                                                              |
| Web UI               | `apps/web/src/components/ChatView.tsx`, `ChatHeader.tsx`, active-thread controls, and any focused panel/popover components                             |
| Shared helpers       | `packages/shared/src/threadSummary.ts` only for contrast; recap is not a sidebar summary                                                               |

## First Vertical Slice

Build a manual-refresh recap slice:

1. Add a recap contract owned by JCode thread state.
2. Persist recap projection state with timestamp, source turn, markdown content, and refresh status.
3. Add a server command/RPC to refresh the recap for a thread through provider-backed text generation.
4. Add projection and snapshot hydration so the web client sees the current recap state.
5. Add a compact `Current state` entry point near active thread controls.
6. Open a focused panel or popover showing recap content, last refresh metadata, refresh-in-progress state, and errors.
7. Add focused tests for contract decoding, projection fold, persistence/hydration, refresh failure handling, and UI logic.

Out of scope for this slice:

- automatic recap refresh after turns;
- transcript-inserted recap cards;
- sidebar recap snippets;
- goal-mode continuation turns;
- remote-client recap sync;
- mobile UI.

## Rewrite-Only Areas

Rewrite instead of adapting upstream directly when:

- upstream names expose provider or protocol details that conflict with JCode's cockpit language;
- the upstream code assumes mobile/shared-runtime architecture that JCode has not accepted yet;
- the upstream auth model conflicts with ADR 0005 scoped capability tokens;
- the upstream implementation mixes unrelated terminal safeguards, release plumbing, or broad web cleanup into recap code;
- copying a migration would conflict with JCode's current schema history.

Every rewrite should include a short reason in the implementation plan or issue.

## Test Plan

Focused tests should cover:

- recap contract schema accepts valid stored recap state and rejects malformed state;
- projection updates recap state on refresh success/failure;
- persisted thread snapshots hydrate recap state without blocking thread loading;
- refresh command refuses missing or archived threads if current JCode rules require that;
- provider text-generation failures produce visible recap refresh errors without corrupting prior recap content;
- web logic shows empty, stale, loading, success, and error states;
- recap UI is available near active thread controls and not inserted into the transcript.

## Follow-Up Roadmap

After the first recap slice proves useful:

1. Add automatic refresh policy with explicit thresholds.
2. Feed current recap context into Persistent Goal Mode continuation turns.
3. Add recap editing or pinning only if user corrections become necessary.
4. Expose read-only recap state to observe-and-approve remote clients after ADR 0005 is implemented.
