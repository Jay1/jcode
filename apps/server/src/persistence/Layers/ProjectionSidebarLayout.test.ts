import { ProjectId, SIDEBAR_LAYOUT_ID, ThreadId } from "@jcode/contracts";
import { assert, it } from "@effect/vitest";
import { Effect, Layer, Option, Schema } from "effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { PersistenceDecodeError } from "../Errors.ts";
import { ProjectionSidebarLayoutRepository } from "../Services/ProjectionSidebarLayout.ts";
import { ProjectionSidebarLayoutRepositoryLive } from "./ProjectionSidebarLayout.ts";
import { SqlitePersistenceMemory } from "./Sqlite.ts";

const projectionSidebarLayoutLayer = it.layer(
  ProjectionSidebarLayoutRepositoryLive.pipe(Layer.provideMerge(SqlitePersistenceMemory)),
);

projectionSidebarLayoutLayer("ProjectionSidebarLayoutRepository", (it) => {
  it.effect("round-trips and replaces the singleton layout row", () =>
    Effect.gen(function* () {
      // Given: an initialized canonical sidebar layout.
      const layouts = yield* ProjectionSidebarLayoutRepository;
      const initial = {
        layoutKey: SIDEBAR_LAYOUT_ID,
        projectOrder: [ProjectId.makeUnsafe("project-a"), ProjectId.makeUnsafe("project-b")],
        pinnedThreadOrder: [ThreadId.makeUnsafe("thread-a")],
        revision: 12,
        initializedAt: "2026-07-18T00:00:00.000Z",
        updatedAt: "2026-07-18T00:00:12.000Z",
      };
      yield* layouts.upsert(initial);

      // When: the same singleton is upserted with a later canonical layout.
      const replacement = {
        ...initial,
        projectOrder: [ProjectId.makeUnsafe("project-b")],
        pinnedThreadOrder: [ThreadId.makeUnsafe("thread-b"), ThreadId.makeUnsafe("thread-a")],
        revision: 13,
        updatedAt: "2026-07-18T00:00:13.000Z",
      };
      yield* layouts.upsert(replacement);

      // Then: read returns the typed replacement with the original initialization time.
      const persisted = yield* layouts.get();
      assert.deepStrictEqual(Option.getOrNull(persisted), replacement);
    }),
  );

  it.effect("resets the singleton layout to the uninitialized state", () =>
    Effect.gen(function* () {
      // Given: a persisted singleton layout.
      const layouts = yield* ProjectionSidebarLayoutRepository;
      yield* layouts.upsert({
        layoutKey: SIDEBAR_LAYOUT_ID,
        projectOrder: [],
        pinnedThreadOrder: [],
        revision: 1,
        initializedAt: "2026-07-18T00:00:00.000Z",
        updatedAt: "2026-07-18T00:00:01.000Z",
      });

      // When: the rebuild reset operation runs.
      yield* layouts.reset();

      // Then: the layout is explicitly uninitialized again.
      assert.isTrue(Option.isNone(yield* layouts.get()));
    }),
  );

  it.effect("returns a typed decode failure for malformed persisted JSON", () =>
    Effect.gen(function* () {
      // Given: corrupted JSON exists at the SQLite trust boundary.
      const layouts = yield* ProjectionSidebarLayoutRepository;
      const sql = yield* SqlClient.SqlClient;
      yield* sql`
        INSERT INTO projection_sidebar_layout (
          layout_key,
          project_order_json,
          pinned_thread_order_json,
          revision,
          initialized_at,
          updated_at
        ) VALUES (
          'sidebar-layout',
          '{',
          '[]',
          1,
          '2026-07-18T00:00:00.000Z',
          '2026-07-18T00:00:01.000Z'
        )
      `;

      // When: the repository decodes the row.
      const error = yield* Effect.flip(layouts.get());

      // Then: corruption is reported as the typed persistence decode error.
      assert.isTrue(Schema.is(PersistenceDecodeError)(error));
      assert.strictEqual(error.operation, "ProjectionSidebarLayoutRepository.get:decodeRow");
    }),
  );
});
