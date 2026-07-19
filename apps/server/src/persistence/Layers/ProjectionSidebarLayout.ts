import { ProjectId, SIDEBAR_LAYOUT_ID, ThreadId } from "@jcode/contracts";
import { Effect, Layer, Schema, Struct } from "effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as SqlSchema from "effect/unstable/sql/SqlSchema";

import { toPersistenceDecodeError, toPersistenceSqlError } from "../Errors.ts";
import {
  ProjectionSidebarLayout,
  ProjectionSidebarLayoutRepository,
  type ProjectionSidebarLayoutRepositoryShape,
} from "../Services/ProjectionSidebarLayout.ts";

const ProjectionSidebarLayoutDbRow = ProjectionSidebarLayout.mapFields(
  Struct.assign({
    projectOrder: Schema.fromJsonString(Schema.Array(ProjectId)),
    pinnedThreadOrder: Schema.fromJsonString(Schema.Array(ThreadId)),
  }),
);

const toSqlOrDecodeError = (sqlOperation: string, decodeOperation: string) => (cause: unknown) =>
  Schema.isSchemaError(cause)
    ? toPersistenceDecodeError(decodeOperation)(cause)
    : toPersistenceSqlError(sqlOperation)(cause);

const makeProjectionSidebarLayoutRepository = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const upsertRow = SqlSchema.void({
    Request: ProjectionSidebarLayout,
    execute: (row) =>
      sql`
        INSERT INTO projection_sidebar_layout (
          layout_key,
          project_order_json,
          pinned_thread_order_json,
          revision,
          initialized_at,
          updated_at
        ) VALUES (
          ${row.layoutKey},
          ${JSON.stringify(row.projectOrder)},
          ${JSON.stringify(row.pinnedThreadOrder)},
          ${row.revision},
          ${row.initializedAt},
          ${row.updatedAt}
        )
        ON CONFLICT (layout_key)
        DO UPDATE SET
          project_order_json = excluded.project_order_json,
          pinned_thread_order_json = excluded.pinned_thread_order_json,
          revision = excluded.revision,
          initialized_at = excluded.initialized_at,
          updated_at = excluded.updated_at
      `,
  });

  const getRow = SqlSchema.findOneOption({
    Request: Schema.Void,
    Result: ProjectionSidebarLayoutDbRow,
    execute: () =>
      sql`
        SELECT
          layout_key AS "layoutKey",
          project_order_json AS "projectOrder",
          pinned_thread_order_json AS "pinnedThreadOrder",
          revision,
          initialized_at AS "initializedAt",
          updated_at AS "updatedAt"
        FROM projection_sidebar_layout
        WHERE layout_key = ${SIDEBAR_LAYOUT_ID}
      `,
  });

  const resetRow = SqlSchema.void({
    Request: Schema.Void,
    execute: () =>
      sql`
        DELETE FROM projection_sidebar_layout
        WHERE layout_key = ${SIDEBAR_LAYOUT_ID}
      `,
  });

  const upsert: ProjectionSidebarLayoutRepositoryShape["upsert"] = (row) =>
    upsertRow(row).pipe(
      Effect.mapError(
        toSqlOrDecodeError(
          "ProjectionSidebarLayoutRepository.upsert:query",
          "ProjectionSidebarLayoutRepository.upsert:encodeRequest",
        ),
      ),
    );

  const get: ProjectionSidebarLayoutRepositoryShape["get"] = () =>
    getRow(undefined).pipe(
      Effect.mapError(
        toSqlOrDecodeError(
          "ProjectionSidebarLayoutRepository.get:query",
          "ProjectionSidebarLayoutRepository.get:decodeRow",
        ),
      ),
    );

  const reset: ProjectionSidebarLayoutRepositoryShape["reset"] = () =>
    resetRow(undefined).pipe(
      Effect.mapError(toPersistenceSqlError("ProjectionSidebarLayoutRepository.reset:query")),
    );

  return { upsert, get, reset } satisfies ProjectionSidebarLayoutRepositoryShape;
});

export const ProjectionSidebarLayoutRepositoryLive = Layer.effect(
  ProjectionSidebarLayoutRepository,
  makeProjectionSidebarLayoutRepository,
);
