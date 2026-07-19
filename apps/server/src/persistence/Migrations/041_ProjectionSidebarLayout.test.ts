import { expect, test } from "vitest";
import { Effect, Exit } from "effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { runMigrations } from "../Migrations.ts";
import * as NodeSqliteClient from "../NodeSqliteClient.ts";

test("041_ProjectionSidebarLayout registers an idempotent singleton projection table", async () => {
  await Effect.runPromise(
    Effect.gen(function* () {
      // Given: a fresh SQLite database.
      const sql = yield* SqlClient.SqlClient;

      // When: all migrations are run twice.
      const firstRun = yield* runMigrations();
      const secondRun = yield* runMigrations();

      // Then: migration 041 runs once with the expected constrained schema and index.
      expect(firstRun).toContainEqual([41, "ProjectionSidebarLayout"]);
      expect(secondRun).toEqual([]);

      const columns = yield* sql<{
        readonly name: string;
        readonly notnull: number;
        readonly pk: number;
      }>`
        SELECT name, "notnull", pk
        FROM pragma_table_info('projection_sidebar_layout')
        ORDER BY cid
      `;
      expect(columns).toEqual([
        { name: "layout_key", notnull: 1, pk: 1 },
        { name: "project_order_json", notnull: 1, pk: 0 },
        { name: "pinned_thread_order_json", notnull: 1, pk: 0 },
        { name: "revision", notnull: 1, pk: 0 },
        { name: "initialized_at", notnull: 1, pk: 0 },
        { name: "updated_at", notnull: 1, pk: 0 },
      ]);

      const indexes = yield* sql<{ readonly name: string }>`
        SELECT name
        FROM sqlite_master
        WHERE type = 'index'
          AND tbl_name = 'projection_sidebar_layout'
          AND name = 'idx_projection_sidebar_layout_updated_at'
      `;
      expect(indexes).toEqual([{ name: "idx_projection_sidebar_layout_updated_at" }]);
    }).pipe(Effect.provide(NodeSqliteClient.layerMemory())),
  );
});

test("041_ProjectionSidebarLayout rejects invalid singleton keys and negative revisions", async () => {
  await Effect.runPromise(
    Effect.gen(function* () {
      // Given: migration 041 has created the singleton table.
      const sql = yield* SqlClient.SqlClient;
      yield* runMigrations();

      // When: invalid singleton data is inserted.
      const invalidKey = yield* Effect.exit(sql`
        INSERT INTO projection_sidebar_layout (
          layout_key,
          project_order_json,
          pinned_thread_order_json,
          revision,
          initialized_at,
          updated_at
        ) VALUES ('other-layout', '[]', '[]', 0, '2026-07-18T00:00:00.000Z', '2026-07-18T00:00:00.000Z')
      `);
      const invalidRevision = yield* Effect.exit(sql`
        INSERT INTO projection_sidebar_layout (
          layout_key,
          project_order_json,
          pinned_thread_order_json,
          revision,
          initialized_at,
          updated_at
        ) VALUES ('sidebar-layout', '[]', '[]', -1, '2026-07-18T00:00:00.000Z', '2026-07-18T00:00:00.000Z')
      `);

      // Then: both constraints reject malformed singleton rows.
      expect(Exit.isFailure(invalidKey)).toBe(true);
      expect(Exit.isFailure(invalidRevision)).toBe(true);
    }).pipe(Effect.provide(NodeSqliteClient.layerMemory())),
  );
});
