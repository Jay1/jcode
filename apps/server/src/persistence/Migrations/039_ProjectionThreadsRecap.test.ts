import { expect, test } from "bun:test";
import { Effect } from "effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { runMigrations } from "../Migrations.ts";
import * as NodeSqliteClient from "../NodeSqliteClient.ts";

test("039_ProjectionThreadsRecap adds nullable recap_json to projected threads", async () => {
  await Effect.runPromise(
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      yield* runMigrations();

      const columns = yield* sql<{ readonly name: string; readonly notnull: number }>`
        SELECT name, "notnull"
        FROM pragma_table_info('projection_threads')
        WHERE name = 'recap_json'
      `;

      expect(columns).toHaveLength(1);
      expect(columns[0]?.notnull).toBe(0);
    }).pipe(Effect.provide(NodeSqliteClient.layerMemory())),
  );
});
