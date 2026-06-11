# Thread Recap Auto Refresh Design

| Field           | Value                                                                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Status          | Draft                                                                                                                                         |
| Type            | Feature design                                                                                                                                |
| Owner           | Engineering                                                                                                                                   |
| Audience        | Orchestration, persistence, and web UI maintainers                                                                                            |
| Scope           | Persist thread recap state, mount the current-state UI, and add automatic recap refresh triggers before Persistent Goal Mode                  |
| Source of truth | `CONTEXT.md`, `docs/superpowers/plans/2026-06-05-thread-recap-adaptation.md`, Synara PR #142, `packages/shared/src/threadRecapSource.ts`      |
| Verification    | Migration/repository tests, projection hydration tests, recap source tests, web component tests or focused typecheck, format check, typecheck |

## Goal

Finish the Thread Recap dependency gate for Persistent Goal Mode by making recaps durable, visible, and refreshable without user babysitting. A generated recap should survive reloads, appear in the active thread UI, and refresh automatically when meaningful new thread material appears.

## Context

The first Thread Recap slice already added contracts, recap source derivation, provider-backed text generation, a websocket RPC, a React hook, and a `ThreadRecapPanel`. That work is committed at `12ac6ffcd`.

The remaining gap is ownership. `OrchestrationThread.recap` exists in the contract, but no projection table column or repository mapping stores it. `server.generateThreadRecap` returns text but does not persist the full `ThreadRecap`. The web panel exists but is not mounted in the active thread view. Persistent Goal Mode depends on current-state context, so recaps need to become durable thread model state before goal continuations rely on them.

Synara PR #142 validates the downstream dependency: its goal feature uses persisted thread goal state, hidden continuation inputs, and a continuation reactor. JCode should not add that loop until the current-state recap it will feed into continuation prompts is stable.

## Scope

This slice completes Thread Recap as a persisted current-state feature. It does not implement Persistent Goal Mode, goal lifecycle commands, sentinel completion, or continuation turns.

In scope:

- Store `ThreadRecap` on projected threads.
- Hydrate `recap` through thread detail and shell snapshots.
- Persist generated recaps from `server.generateThreadRecap`.
- Mount `ThreadRecapPanel` near active thread controls.
- Add automatic refresh after meaningful new user/assistant material accumulates.
- Keep manual refresh available.

Out of scope:

- Goal state, `/goal`, continuation reactors, and sentinel completion.
- Separate evaluator model for recap freshness.
- Automatic refresh on every token or every activity.
- Background refresh for archived/deleted/inactive threads.

## Behavior

The active thread displays a compact current-state panel near the thread header or active controls. If a recap exists, the panel shows it and offers refresh. If no recap exists, it offers generate. Errors remain local to the panel.

Manual refresh derives source material from the current thread, calls `server.generateThreadRecap`, and persists the resulting full recap. The returned `ThreadRecap` becomes visible after projection hydration or local query invalidation.

Automatic refresh runs only when all of these are true:

- The thread is active in the cockpit.
- The thread has no running provider session.
- There is new user-facing material after `recap.coveredMessageId`.
- The new material meets the same threshold used by `deriveThreadRecapSource`.
- A refresh is not already in flight.

Automatic refresh should be debounce-based and best effort. If it fails, the UI should show the stale recap and expose manual refresh; it should not block chat or provider execution.

## Data Model

Add a nullable `recap_json` column to `projection_threads` with a new migration, likely `039_ProjectionThreadsRecap.ts` unless another migration lands first.

The column stores the contract `ThreadRecap` JSON shape:

- `text`
- `coveredMessageId`
- `sourceSignature`
- `generatedAt`

`ProjectionThread` gains `recap: ThreadRecap | null`. `ProjectionThreadDbRow` maps `recap_json` through `Schema.fromJsonString(ThreadRecap)` or equivalent nullable JSON mapping.

Thread detail and shell hydration include `recap` so the existing contract field becomes populated in both active thread detail and sidebar/shell data.

## Server Flow

`server.generateThreadRecap` should persist the full recap, not just return the generated text.

Recommended server flow:

1. Load the thread detail by `threadId` from `ProjectionSnapshotQuery`.
2. Derive recap source server-side from the latest projected messages and activities.
3. Use the request payload as a compatibility fallback only if server-side derivation is temporarily unavailable.
4. Call `textGeneration.generateThreadRecap` with previous recap, new material, current state, and settings model selection.
5. Build `ThreadRecap` with generated text, `coveredMessageId`, `sourceSignature`, and `generatedAt`.
6. Save it to `projection_threads.recap_json`.
7. Return the generated recap text or full recap, depending on whether the existing RPC result is widened.

The server should own `coveredMessageId`, `sourceSignature`, and `generatedAt` so clients cannot accidentally mark unprocessed material as covered.

## Automatic Refresh Policy

The first automatic policy should be conservative:

- Trigger from the active web thread after a turn settles, not during streaming.
- Also trigger when opening a thread with no recap and enough material.
- Debounce refresh attempts per thread.
- Do not refresh while session status is `running`.
- Do not refresh on hidden or non-user-facing material.
- Do not refresh if `sourceSignature` matches the latest derived source.

This keeps automatic refresh useful without introducing a server daemon before Goal Mode needs one. A future server-side recap reactor can move the policy out of the web if Goal Mode needs recaps for inactive or long-running background threads.

## UI Placement

Mount `ThreadRecapPanel` near the active thread controls/header in `ChatView`, matching the earlier roadmap decision that current-state context belongs near the active thread entry point, not inside the transcript and not in sidebar summaries.

The panel should remain compact and should not consume transcript space. If the active design cannot support the panel inline cleanly, mount it as a collapsible or popover controlled from the header.

## Tests

Add or update tests for:

- Migration adds nullable `recap_json` without breaking legacy rows.
- Projection repository writes and reads `ThreadRecap` JSON.
- Snapshot hydration includes `recap` on thread detail and shell records.
- `server.generateThreadRecap` persists the returned recap metadata.
- Automatic refresh policy skips running sessions and no-new-material cases.
- `ThreadRecapPanel` renders existing recap and refresh action without requiring a manual page reload.

Keep `packages/shared/src/threadRecapSource.test.ts` as the source-derivation unit boundary.

## Risks

- Automatic refresh could create surprising provider/model usage. Mitigate with conservative triggers, debounce, and visible refresh state.
- Persisting recap on projection rows means repair/replay paths must keep nullable defaults safe. Mitigate with migration tests and decode defaults.
- Web-triggered automatic refresh may miss inactive thread updates. Accept this for the first quality slice because Persistent Goal Mode can later justify a server-side reactor.
- Widening the RPC result to return full `ThreadRecap` may ripple through contract users. Prefer minimal widening only if needed.

## Open Questions

1. Should `server.generateThreadRecap` return `{ recap: ThreadRecap }` instead of `{ recap: string }` now, or preserve the existing result shape and rely on snapshot hydration?
2. Should automatic refresh be opt-out in settings before Goal Mode ships, or is conservative active-thread-only behavior acceptable as the default?
3. Should the first implementation derive source exclusively server-side, or keep client-derived `newMaterial` as the public RPC contract for now?
