# Server-Owned Sidebar Layout Design

## Summary

JCode will make the server the sole authority for manual project order and pinned-thread membership and order. Every browser or desktop client connected to the same JCode server will render the same canonical sidebar layout.

The layout will be modeled as a dedicated event-sourced aggregate. Clients will send semantic move, pin, and unpin intents instead of replacing complete arrays. The server will apply each intent to its latest state, publish the resulting canonical layout, and include that layout in shell snapshots and updates.

Device-local storage will retain presentation state such as expanded sections, but it will no longer participate in project or pin ordering after a one-time migration.

## Goals

- Synchronize manual project order across every client connected to one JCode server.
- Synchronize pinned-thread membership and order across those clients.
- Eliminate the current local/server reconciliation race that can undo an unpin.
- Preserve responsive drag, pin, and unpin interactions through optimistic rendering.
- Resolve concurrent client operations deterministically without stale whole-list replacement.
- Preserve server-side retention protection for pinned threads.
- Migrate existing local project and pin order once without allowing legacy data to overwrite later server changes.

## Non-Goals

- Synchronizing layout between independent JCode server installations.
- Moving expanded/collapsed sections, transient selection, hover state, or open panels to the server.
- Changing automatic project or thread sorting modes.
- Adding accounts, cloud storage, or Tailnet-specific persistence.
- Persisting arbitrary pending client mutations across browser restarts.

## Current Failure

Pinned membership currently has two authorities: `projection_threads.is_pinned` on the server and a persisted browser list. During unpin, the client waits for the server command before removing the browser pin. The shell stream can publish `isPinned: false` during that interval, causing the legacy migration effect to interpret the mismatch as an unmigrated local pin and immediately send `isPinned: true`.

The affected thread produced two accepted events 24 milliseconds apart: an unpin followed by a pin. The server correctly applied both commands; the client reconciliation policy created the second command.

Project order has a similar ownership problem. It is persisted by workspace root in browser local storage, so each client can maintain a different order even though all clients use the same JCode server.

## Ownership Model

### Server-owned state

One singleton `SidebarLayout` aggregate per JCode server owns:

- `projectOrder`: the explicit relative order of project IDs;
- `pinnedThreadOrder`: the ordered set of pinned thread IDs;
- aggregate revision and update metadata.

Membership in `pinnedThreadOrder` is the authoritative definition of whether a thread is pinned. The existing `projection_threads.is_pinned` value remains as a denormalized projection for retention and compatibility queries. It must only be written as a consequence of sidebar-layout events and must never drive layout commands.

The layout contains project IDs rather than workspace roots. Workspace roots are used only to map legacy browser state during migration.

### Device-local state

The following remain local because they describe a view rather than shared layout:

- project and section expansion;
- selected rows and range-selection anchors;
- transient drag and hover state;
- open panels, drawers, and routes;
- unconfirmed optimistic intents for the current session.

## Domain Contracts

### Read model

The server exposes a canonical layout in the shell snapshot and shell update stream:

```ts
interface SidebarLayout {
  readonly projectOrder: readonly ProjectId[];
  readonly pinnedThreadOrder: readonly ThreadId[];
  readonly revision: number;
  readonly updatedAt: string;
}
```

Full and shell snapshots expose `sidebarLayout: SidebarLayout | null`. `null` is the only
uninitialized state. Once initialized, every accepted layout event publishes a non-null layout
whose `revision` is that event's global orchestration sequence; `snapshotSequence` is only a
snapshot fence and is never a layout acknowledgement.

The shell query normalizes the stored layout against live projections:

- duplicate IDs are removed;
- deleted IDs are omitted;
- projects not yet explicitly ordered are appended by creation time and ID;
- pinned IDs that no longer resolve to live threads are omitted.

Normalization is deterministic and read-only. The next accepted layout command persists the normalized result as part of its canonical event.

### Commands

Clients express intent with narrow commands:

- `sidebar-layout.initialize`
  - the first accepted command initializes the layout;
  - carries legacy project and pinned-thread order candidates.
- `sidebar-layout.project.move`
  - carries a project ID and an optional `beforeProjectId` anchor;
  - a missing anchor means append.
- `sidebar-layout.thread.pin`
  - carries a thread ID and an optional `beforeThreadId` anchor;
  - an already-pinned thread is repositioned rather than duplicated.
- `sidebar-layout.thread.unpin`
  - removes the thread from pinned membership and order atomically.
- `sidebar-layout.pinned-thread.move`
  - repositions an already-pinned thread.

All commands carry the existing idempotent command ID. Clients do not send full replacement arrays and do not use a client-authored revision as a last-write-wins token.

Every accepted command returns the existing dispatch receipt sequence. A client retains its
optimistic intent until a canonical layout with `revision >= acceptedSequence` is observed. This
handles RPC-before-event, event-before-RPC, retry receipt recovery, and reconnect snapshots without
using the unrelated shell `snapshotSequence`.

### Command semantics

The orchestration engine serializes commands on the singleton layout stream and evaluates each command against the latest aggregate state.

- If the subject project or thread no longer exists, the command returns a typed not-found result.
- If a move anchor disappeared concurrently, the subject appends to the relevant list.
- Moving an item before itself is a no-op.
- Pin and unpin are idempotent.
- Concurrent moves of different items are both applied in server acceptance order.
- Concurrent moves of the same item resolve to the last accepted intent.
- Initialization after the layout already exists is an accepted canonical no-op: it preserves the
  existing ordered lists and emits them at a later global event sequence so the dispatch can be
  acknowledged normally.

Events contain the resulting canonical ordered lists. This keeps projection rebuilds deterministic and makes each accepted layout revision self-contained while commands remain semantic and concurrency-safe.

## Persistence And Projection

A migration adds a singleton `projection_sidebar_layout` table containing:

- layout key;
- project order JSON;
- pinned-thread order JSON;
- revision;
- initialized timestamp;
- updated timestamp.

The event store remains authoritative. The projection table is rebuildable from layout events.

When a layout event changes pinned membership, the projection pipeline updates `projection_sidebar_layout` and the affected `projection_threads.is_pinned` values in the same projection transaction. Retention therefore continues using an indexed scalar without becoming a second writer or authority.

Project and thread creation do not need to rewrite the layout. Newly created projects append deterministically until the next explicit project move stores the normalized list. Deleted projects and threads disappear through snapshot normalization; a later layout command compacts the stored arrays.

## Client State And Reconciliation

The web client stores:

- the last confirmed server layout;
- a session-only queue of pending semantic intents.

The displayed layout is derived by replaying pending intents over the confirmed server layout. It is not persisted as an independent membership or ordering source.

For each interaction:

1. Add the semantic intent to the pending queue and render it immediately.
2. Dispatch the command with a unique command ID.
3. Apply shell layout events from any client as the new confirmed layout.
4. Record the dispatch result's global event sequence as the intent's `acceptedSequence`.
5. Remove a pending intent after a canonical layout revision reaches that accepted sequence.
6. Replay any remaining pending intents over the new confirmed layout.

This model naturally handles another client changing the layout while a local command is in flight. There is no imperative rollback copy: on rejection, the client removes the rejected intent and the displayed layout derives again from the last confirmed server state. A targeted toast explains the failure.

Commands from one client are dispatched sequentially so rapid local drags preserve user intent. Server-side stream serialization remains the cross-client ordering authority.

The manual project order is rendered only when the existing sidebar project sort mode is `manual`. Other sort modes remain derived views. Switching back to manual restores the canonical server order.

## Legacy Migration

Migration is explicit, atomic, and one-time.

1. The server snapshot reports that no sidebar layout has been initialized.
2. A client reads the legacy local project order and pinned-thread list.
3. The client maps project workspace roots to project IDs from the hydrated server snapshot.
4. The client sends `sidebar-layout.initialize` with valid candidate IDs.
5. The server filters deleted or unknown IDs, removes duplicates, appends missing live projects deterministically, merges valid client pin candidates with existing server-pinned threads, and initializes the aggregate atomically. Existing server pins are preserved even when the winning client has no legacy pin storage.
6. If two clients race to initialize, only the first command changes the ordered lists. The later command is accepted as a canonical no-op event at a newer sequence, and the losing client adopts the already-initialized layout.
7. After observing initialized server state, each client removes ordering and pin authority from its legacy local storage. Local expansion and other presentation values remain.

If a client has no valid legacy order, it initializes from the deterministic server default. Legacy values are never consulted again after server initialization, so an old browser profile cannot resurrect stale pins or project order.

The final web upgrade algorithm distinguishes three candidate states. `undefined` means the hydrated
snapshot has not made candidate collection ready, a candidate object (including empty arrays) means
the client may make its one initialization attempt, and `null` means a durable migration marker or
unavailable storage forbids initialization from that profile. Candidate collection occurs at most
once per mounted EventRouter. An empty, readable profile therefore still initializes the server
default, while a marked old profile never submits another initialize command even if stale keys
later reappear.

A fully empty pushed shell snapshot is provisional because desktop startup can publish it before the
projection query is hydrated. It keeps candidates `undefined`. Any pushed snapshot containing a
project or thread is ready, including valid project-only and thread-only lifecycles. An authoritative
`getShellSnapshot` query is ready even when both collections are genuinely empty, so an empty server
still initializes deterministically without treating elapsed time as proof of readiness.

Confirmation is driven only by an observed non-null canonical layout, whether it arrives in a
snapshot, a non-applied fallback/bootstrap query, or another client's shell event. Canonical-only
fallback observations pass through the layout router so they retry interrupted cleanup without
reapplying stale lifecycle data or migration candidates; layout revision monotonicity still prevents
regression. The client writes
`jcode:sidebar-layout-migrated:v1` before retiring authority fields, removes only
`projectOrderCwds` from renderer-state objects, removes the three current/DPCode/T3Code pin keys,
and leaves expansion, local project names, and unrelated device-local state intact. If field cleanup
is interrupted, the marker immediately prevents stale replay and later canonical observations retry
the remaining cleanup. Bootstrap never copies legacy pin storage into a current pin store. Until
confirmation, ordinary presentation persistence preserves an existing legacy order field unchanged;
it never derives or updates that field from the rendered project array. This preservation supports
both flat renderer objects and Zustand-style `{ state, version }` envelopes, keeps mixed legacy
arrays byte-for-value equivalent until the migration parser filters them, and retains expansion and
local project names even when persistence runs before project hydration.

The namespace bootstrap marker retires ordering authority only; it does not suppress presentation
migration. If a marked profile has only a DPCode/T3Code renderer payload, bootstrap strips
`projectOrderCwds` and copies the remaining expansion, local-name, and unrelated presentation fields
to the current JCode renderer key.

## Authorization And Transport

Layout reads follow existing shell snapshot authorization. Layout mutations require an owner session because they change shared server state for every connected client. The feature does not add Tailnet-specific trust; it remains behind JCode's Server Auth Boundary.

The web bundle and server contracts ship together. The old client-only pin migration effect and persisted pin membership store are removed from active reconciliation. Any temporary compatibility decoding must be read-only and must not reintroduce a second writer.

## Failure Handling

- Transport failure: remove the rejected pending intent, render confirmed server state, and show a specific retryable toast.
- Initialization rejection: clear the one-attempt latch and show a targeted Retry action. Retrying
  reuses the collected candidate snapshot in a fresh command only while canonical layout remains
  uninitialized; if another client wins first, the retry becomes a no-op and canonical state wins.
- Domain not found: remove the intent and refresh from the next shell snapshot; do not retry automatically.
- Lost connection after server acceptance: command ID idempotency makes an explicit retry safe, while the shell snapshot eventually confirms the canonical result.
- Projection restart or rebuild: replay layout events and reconstruct both the layout row and denormalized pinned flags.
- Corrupt persisted JSON: fail startup or projection decoding loudly using the existing typed persistence error path; do not silently fall back to browser data.
- Concurrent client changes: apply accepted server revisions in stream order and rebase local pending intents by replay.

## Testing Strategy

### Contracts and domain

- Decode valid layout snapshots and every command variant.
- Reject duplicate/invalid boundary data before it enters the domain.
- Cover initialize-once behavior.
- Cover project move, pin, unpin, and pinned move behavior.
- Cover missing subjects, missing anchors, self-moves, and idempotent retries.
- Apply interleaved intents from two clients and assert deterministic server order.

### Persistence and projections

- Migrate a database and round-trip the singleton layout row.
- Project layout events into ordered JSON and denormalized `is_pinned` flags.
- Rebuild projections from events and obtain identical layout and pin flags.
- Verify thread retention protects exactly the IDs in canonical pinned membership.
- Verify deleted IDs and newly created projects normalize deterministically.

### Web client

- Replay pending intents over confirmed layout without mutating confirmed state.
- Reconcile a local pending move with a remote server revision.
- Remove a failed intent and derive the original confirmed layout.
- Prove an unpin cannot emit a compensating pin while its RPC is in flight.
- Prove automatic project sorting ignores manual order without overwriting it.
- Prove legacy initialization runs only while the server is uninitialized.

### Browser acceptance

Use two isolated authenticated browser contexts against one loopback development server:

1. Reorder projects in client A and observe the same order in client B.
2. Pin and reorder threads in client B and observe the same order in client A.
3. Unpin the formerly failing thread and verify it remains unpinned after stream reconciliation and reload.
4. Perform overlapping moves from both clients and verify both converge to the server's canonical order.
5. Simulate a rejected command and verify optimistic state rolls back with a targeted error.
6. Restart the server and verify both orders persist.

## Rollout Sequence

1. Add contracts, aggregate behavior, projection migration, and server snapshot support behind focused tests.
2. Add the web client's confirmed-layout plus pending-intent model.
3. Add atomic legacy initialization and remove continuous local reconciliation.
4. Cut project drag-and-drop and pin controls over to layout commands.
5. Verify projection rebuilds, retention, two-client convergence, reloads, and restart persistence.
6. Remove obsolete local ordering and pin-membership code once migration coverage proves it is no longer authoritative.

## Acceptance Criteria

- All clients connected to one JCode server converge on the same manual project order and pinned-thread order.
- Pin membership has exactly one authority: the server sidebar layout.
- Unpin cannot be undone by local migration or stream timing.
- Concurrent client operations are applied as semantic intents to the latest server state.
- Legacy browser data initializes the server at most once and cannot later overwrite it.
- Pinned-thread retention behavior remains correct after projection rebuild and server restart.
- Device-local expansion and navigation state remain independent between clients.
