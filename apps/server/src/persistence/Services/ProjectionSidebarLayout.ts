/**
 * Singleton sidebar-layout projection persistence contract.
 *
 * The event store remains authoritative; this row is a rebuildable read model.
 */
import {
  IsoDateTime,
  NonNegativeInt,
  ProjectId,
  SidebarLayoutId,
  ThreadId,
} from "@jcode/contracts";
import { Option, Schema, ServiceMap } from "effect";
import type { Effect } from "effect";

import type { ProjectionRepositoryError } from "../Errors.ts";

export const ProjectionSidebarLayout = Schema.Struct({
  layoutKey: SidebarLayoutId,
  projectOrder: Schema.Array(ProjectId),
  pinnedThreadOrder: Schema.Array(ThreadId),
  revision: NonNegativeInt,
  initializedAt: IsoDateTime,
  updatedAt: IsoDateTime,
});
export type ProjectionSidebarLayout = typeof ProjectionSidebarLayout.Type;

export interface ProjectionSidebarLayoutRepositoryShape {
  readonly upsert: (row: ProjectionSidebarLayout) => Effect.Effect<void, ProjectionRepositoryError>;
  readonly get: () => Effect.Effect<
    Option.Option<ProjectionSidebarLayout>,
    ProjectionRepositoryError
  >;
  readonly reset: () => Effect.Effect<void, ProjectionRepositoryError>;
}

export class ProjectionSidebarLayoutRepository extends ServiceMap.Service<
  ProjectionSidebarLayoutRepository,
  ProjectionSidebarLayoutRepositoryShape
>()("jcode/persistence/Services/ProjectionSidebarLayout/ProjectionSidebarLayoutRepository") {}
