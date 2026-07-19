import type { OrchestrationCommand, OrchestrationReadModel } from "@jcode/contracts";
import { Effect } from "effect";

import { OrchestrationCommandInvariantError } from "./Errors.ts";
import {
  initializeSidebarLayout,
  movePinnedThreadBefore,
  moveProjectBefore,
  normalizeSidebarLayout,
  pinThreadBefore,
  type SidebarLayoutOrder,
  unpinThread,
} from "./sidebarLayout.ts";

type SidebarLayoutCommand = Extract<
  OrchestrationCommand,
  {
    readonly type:
      | "sidebar-layout.initialize"
      | "sidebar-layout.project.move"
      | "sidebar-layout.thread.pin"
      | "sidebar-layout.thread.unpin"
      | "sidebar-layout.pinned-thread.move";
  }
>;

function requireInitializedSidebarLayout(
  command: SidebarLayoutCommand,
  readModel: OrchestrationReadModel,
): Effect.Effect<
  Exclude<OrchestrationReadModel["sidebarLayout"], null>,
  OrchestrationCommandInvariantError
> {
  if (readModel.sidebarLayout !== null) {
    return Effect.succeed(readModel.sidebarLayout);
  }
  return Effect.fail(
    new OrchestrationCommandInvariantError({
      commandType: command.type,
      detail: "Sidebar layout has not been initialized.",
    }),
  );
}

function normalizeCurrentLayout(
  layout: Exclude<OrchestrationReadModel["sidebarLayout"], null>,
  readModel: OrchestrationReadModel,
): SidebarLayoutOrder {
  return normalizeSidebarLayout({
    projectOrder: layout.projectOrder,
    pinnedThreadOrder: layout.pinnedThreadOrder,
    projects: readModel.projects,
    threads: readModel.threads,
  });
}

export const decideSidebarLayoutCommand = Effect.fn("decideSidebarLayoutCommand")(
  function* (input: {
    readonly command: SidebarLayoutCommand;
    readonly readModel: OrchestrationReadModel;
  }): Effect.fn.Return<SidebarLayoutOrder, OrchestrationCommandInvariantError> {
    const { command, readModel } = input;
    switch (command.type) {
      case "sidebar-layout.initialize":
        return readModel.sidebarLayout === null
          ? initializeSidebarLayout({
              projectOrderCandidates: command.projectOrder,
              pinnedThreadOrderCandidates: command.pinnedThreadOrder,
              projects: readModel.projects,
              threads: readModel.threads,
            })
          : normalizeCurrentLayout(readModel.sidebarLayout, readModel);

      case "sidebar-layout.project.move": {
        const current = normalizeCurrentLayout(
          yield* requireInitializedSidebarLayout(command, readModel),
          readModel,
        );
        const result = moveProjectBefore({
          projectOrder: current.projectOrder,
          projectId: command.projectId,
          beforeProjectId: command.beforeProjectId ?? null,
          projects: readModel.projects,
        });
        switch (result.kind) {
          case "applied":
            return { ...current, projectOrder: result.projectOrder };
          case "subject-not-found":
            return yield* new OrchestrationCommandInvariantError({
              commandType: command.type,
              detail: `Project '${result.subjectId}' does not exist.`,
            });
          default:
            return result satisfies never;
        }
      }

      case "sidebar-layout.thread.pin": {
        const current = normalizeCurrentLayout(
          yield* requireInitializedSidebarLayout(command, readModel),
          readModel,
        );
        const result = pinThreadBefore({
          pinnedThreadOrder: current.pinnedThreadOrder,
          threadId: command.threadId,
          beforeThreadId: command.beforeThreadId ?? null,
          threads: readModel.threads,
        });
        switch (result.kind) {
          case "applied":
            return { ...current, pinnedThreadOrder: result.pinnedThreadOrder };
          case "subject-not-found":
            return yield* new OrchestrationCommandInvariantError({
              commandType: command.type,
              detail: `Thread '${result.subjectId}' does not exist.`,
            });
          default:
            return result satisfies never;
        }
      }

      case "sidebar-layout.thread.unpin": {
        const current = normalizeCurrentLayout(
          yield* requireInitializedSidebarLayout(command, readModel),
          readModel,
        );
        const result = unpinThread({
          pinnedThreadOrder: current.pinnedThreadOrder,
          threadId: command.threadId,
          threads: readModel.threads,
        });
        switch (result.kind) {
          case "applied":
            return { ...current, pinnedThreadOrder: result.pinnedThreadOrder };
          case "subject-not-found":
            return yield* new OrchestrationCommandInvariantError({
              commandType: command.type,
              detail: `Thread '${result.subjectId}' does not exist.`,
            });
          default:
            return result satisfies never;
        }
      }

      case "sidebar-layout.pinned-thread.move": {
        const current = normalizeCurrentLayout(
          yield* requireInitializedSidebarLayout(command, readModel),
          readModel,
        );
        const result = movePinnedThreadBefore({
          pinnedThreadOrder: current.pinnedThreadOrder,
          threadId: command.threadId,
          beforeThreadId: command.beforeThreadId ?? null,
          threads: readModel.threads,
        });
        switch (result.kind) {
          case "applied":
            return { ...current, pinnedThreadOrder: result.pinnedThreadOrder };
          case "subject-not-found":
            return yield* new OrchestrationCommandInvariantError({
              commandType: command.type,
              detail: `Thread '${result.subjectId}' does not exist.`,
            });
          case "subject-not-pinned":
            return yield* new OrchestrationCommandInvariantError({
              commandType: command.type,
              detail: `Thread '${result.threadId}' is not pinned.`,
            });
          default:
            return result satisfies never;
        }
      }

      default:
        return command satisfies never;
    }
  },
);
