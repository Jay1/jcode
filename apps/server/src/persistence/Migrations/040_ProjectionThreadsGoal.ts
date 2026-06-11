import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const columns = yield* sql<{ readonly name: string }>`
    SELECT name
    FROM pragma_table_info('projection_threads')
    WHERE name = 'goal_json'
  `;

  if (columns.length > 0) {
    return;
  }

  yield* sql`
    ALTER TABLE projection_threads
    ADD COLUMN goal_json TEXT
  `;
});
