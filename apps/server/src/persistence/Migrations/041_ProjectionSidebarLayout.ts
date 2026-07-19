import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    CREATE TABLE IF NOT EXISTS projection_sidebar_layout (
      layout_key TEXT PRIMARY KEY NOT NULL CHECK (layout_key = 'sidebar-layout'),
      project_order_json TEXT NOT NULL,
      pinned_thread_order_json TEXT NOT NULL,
      revision INTEGER NOT NULL CHECK (revision >= 0),
      initialized_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_projection_sidebar_layout_updated_at
    ON projection_sidebar_layout(updated_at)
  `;
});
