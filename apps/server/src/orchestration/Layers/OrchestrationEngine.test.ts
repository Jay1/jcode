import {
  CheckpointRef,
  CommandId,
  DEFAULT_PROVIDER_INTERACTION_MODE,
  EventId,
  MessageId,
  ProjectId,
  ThreadId,
  TurnId,
  type ProjectIconMetadata,
  type OrchestrationEvent,
} from "@jcode/contracts";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Effect, Layer, ManagedRuntime, Queue, Stream } from "effect";
import { describe, expect, it } from "vitest";

import { PersistenceSqlError } from "../../persistence/Errors.ts";
import { OrchestrationCommandReceiptRepositoryLive } from "../../persistence/Layers/OrchestrationCommandReceipts.ts";
import { OrchestrationEventStoreLive } from "../../persistence/Layers/OrchestrationEventStore.ts";
import {
  makeSqlitePersistenceLive,
  SqlitePersistenceMemory,
} from "../../persistence/Layers/Sqlite.ts";
import {
  OrchestrationEventStore,
  type OrchestrationEventStoreShape,
} from "../../persistence/Services/OrchestrationEventStore.ts";
import { OrchestrationEngineLive } from "./OrchestrationEngine.ts";
import { OrchestrationProjectionPipelineLive } from "./ProjectionPipeline.ts";
import {
  OrchestrationEngineService,
  type OrchestrationEngineShape,
} from "../Services/OrchestrationEngine.ts";
import {
  OrchestrationProjectionPipeline,
  type OrchestrationProjectionPipelineShape,
} from "../Services/ProjectionPipeline.ts";
import { ServerConfig } from "../../config.ts";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { ProjectLanguageIconResolver } from "../../project/Services/ProjectLanguageIconResolver.ts";

const asProjectId = (value: string): ProjectId => ProjectId.makeUnsafe(value);
const asMessageId = (value: string): MessageId => MessageId.makeUnsafe(value);
const asTurnId = (value: string): TurnId => TurnId.makeUnsafe(value);
const asCheckpointRef = (value: string): CheckpointRef => CheckpointRef.makeUnsafe(value);

const NoopProjectLanguageIconResolverLayer = Layer.succeed(ProjectLanguageIconResolver, {
  resolveMetadata: () => Effect.succeed(null),
} satisfies typeof ProjectLanguageIconResolver.Service);

async function createOrchestrationSystem(
  input: {
    readonly resolveProjectIconMetadata?: (
      cwd: string,
    ) => Effect.Effect<ProjectIconMetadata | null>;
  } = {},
) {
  const ServerConfigLayer = ServerConfig.layerTest(process.cwd(), {
    prefix: "t3-orchestration-engine-test-",
  });
  const projectLanguageIconResolverLayer = input.resolveProjectIconMetadata
    ? Layer.succeed(ProjectLanguageIconResolver, {
        resolveMetadata: input.resolveProjectIconMetadata,
      } satisfies typeof ProjectLanguageIconResolver.Service)
    : NoopProjectLanguageIconResolverLayer;
  const orchestrationLayer = OrchestrationEngineLive.pipe(
    Layer.provide(OrchestrationProjectionPipelineLive),
    Layer.provide(OrchestrationEventStoreLive),
    Layer.provide(OrchestrationCommandReceiptRepositoryLive),
    Layer.provide(projectLanguageIconResolverLayer),
    Layer.provide(SqlitePersistenceMemory),
    Layer.provideMerge(ServerConfigLayer),
    Layer.provideMerge(NodeServices.layer),
  );
  const runtime = ManagedRuntime.make(orchestrationLayer);
  const engine = await runtime.runPromise(Effect.service(OrchestrationEngineService));
  return {
    engine,
    run: <A, E>(effect: Effect.Effect<A, E>) => runtime.runPromise(effect),
    dispose: () => runtime.dispose(),
  };
}

function now() {
  return new Date().toISOString();
}

function waitForProjectIconMetadata(engine: OrchestrationEngineShape, projectId: ProjectId) {
  return Effect.gen(function* () {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const current = yield* engine.getReadModel();
      const project = current.projects.find((entry) => entry.id === projectId);
      if (project?.iconMetadata !== null && project?.iconMetadata !== undefined) {
        return current;
      }
      yield* Effect.sleep("100 millis");
    }
    return yield* engine.getReadModel();
  });
}

function waitForProjectIconMetadataValue(
  engine: OrchestrationEngineShape,
  projectId: ProjectId,
  expected: ProjectIconMetadata,
) {
  return Effect.gen(function* () {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const current = yield* engine.getReadModel();
      const project = current.projects.find((entry) => entry.id === projectId);
      if (
        project?.iconMetadata?.iconId === expected.iconId &&
        project.iconMetadata.label === expected.label
      ) {
        return current;
      }
      yield* Effect.sleep("100 millis");
    }
    return yield* engine.getReadModel();
  });
}

function makePersistentOrchestrationRuntime(input: {
  readonly dbPath: string;
  readonly prefix: string;
  readonly resolveProjectIconMetadata?: (cwd: string) => Effect.Effect<ProjectIconMetadata | null>;
}) {
  const ServerConfigLayer = ServerConfig.layerTest(process.cwd(), {
    prefix: input.prefix,
  });
  const projectLanguageIconResolverLayer = input.resolveProjectIconMetadata
    ? Layer.succeed(ProjectLanguageIconResolver, {
        resolveMetadata: input.resolveProjectIconMetadata,
      } satisfies typeof ProjectLanguageIconResolver.Service)
    : NoopProjectLanguageIconResolverLayer;
  const orchestrationLayer = OrchestrationEngineLive.pipe(
    Layer.provide(OrchestrationProjectionPipelineLive),
    Layer.provide(OrchestrationEventStoreLive),
    Layer.provide(OrchestrationCommandReceiptRepositoryLive),
    Layer.provide(projectLanguageIconResolverLayer),
    Layer.provideMerge(makeSqlitePersistenceLive(input.dbPath)),
    Layer.provideMerge(ServerConfigLayer),
    Layer.provideMerge(NodeServices.layer),
  );
  return ManagedRuntime.make(orchestrationLayer);
}

function makePersistentEventStoreRuntime(dbPath: string) {
  const seedLayer = OrchestrationEventStoreLive.pipe(
    Layer.provideMerge(makeSqlitePersistenceLive(dbPath)),
    Layer.provideMerge(NodeServices.layer),
  );
  return ManagedRuntime.make(seedLayer);
}

describe("OrchestrationEngine", () => {
  it("returns deterministic read models for repeated reads", async () => {
    const createdAt = now();
    const system = await createOrchestrationSystem();
    const { engine } = system;

    await system.run(
      engine.dispatch({
        type: "project.create",
        commandId: CommandId.makeUnsafe("cmd-project-1-create"),
        projectId: asProjectId("project-1"),
        title: "Project 1",
        workspaceRoot: "/tmp/project-1",
        defaultModelSelection: {
          provider: "codex",
          model: "gpt-5-codex",
        },
        createdAt,
      }),
    );
    await system.run(
      engine.dispatch({
        type: "thread.create",
        commandId: CommandId.makeUnsafe("cmd-thread-1-create"),
        threadId: ThreadId.makeUnsafe("thread-1"),
        projectId: asProjectId("project-1"),
        title: "Thread",
        modelSelection: {
          provider: "codex",
          model: "gpt-5-codex",
        },
        interactionMode: DEFAULT_PROVIDER_INTERACTION_MODE,
        runtimeMode: "approval-required",
        branch: null,
        worktreePath: null,
        createdAt,
      }),
    );
    await system.run(
      engine.dispatch({
        type: "thread.turn.start",
        commandId: CommandId.makeUnsafe("cmd-turn-start-1"),
        threadId: ThreadId.makeUnsafe("thread-1"),
        message: {
          messageId: asMessageId("msg-1"),
          role: "user",
          text: "hello",
          attachments: [],
        },
        interactionMode: DEFAULT_PROVIDER_INTERACTION_MODE,
        runtimeMode: "approval-required",
        createdAt,
      }),
    );

    const readModelA = await system.run(engine.getReadModel());
    const readModelB = await system.run(engine.getReadModel());
    expect(readModelB).toEqual(readModelA);
    await system.dispose();
  });

  it("updates project icon metadata after project creation without blocking dispatch", async () => {
    const createdAt = now();
    const system = await createOrchestrationSystem({
      resolveProjectIconMetadata: () =>
        Effect.succeed({
          iconId: "typescript",
          label: "TypeScript",
        }),
    });
    const { engine } = system;

    const result = await system.run(
      engine.dispatch({
        type: "project.create",
        commandId: CommandId.makeUnsafe("cmd-project-icon-create"),
        projectId: asProjectId("project-icon-create"),
        title: "Icon Project",
        workspaceRoot: "/tmp/project-icon-create",
        defaultModelSelection: null,
        createdAt,
      }),
    );
    expect(result.sequence).toBe(1);

    const readModel = await system.run(
      waitForProjectIconMetadata(engine, asProjectId("project-icon-create")),
    );

    expect(readModel.projects).toContainEqual(
      expect.objectContaining({
        id: asProjectId("project-icon-create"),
        iconMetadata: {
          iconId: "typescript",
          label: "TypeScript",
        },
      }),
    );
    const events = await system.run(
      Stream.runCollect(engine.readEvents(0)).pipe(
        Effect.map((chunk): OrchestrationEvent[] => Array.from(chunk)),
      ),
    );
    expect(events.map((event) => event.type)).toEqual(["project.created", "project.meta-updated"]);
    await system.dispose();
  });

  it("does not let stale automatic icon detection overwrite newer metadata", async () => {
    const createdAt = now();
    let resolveDetectedMetadata: (metadata: ProjectIconMetadata) => void = () => {};
    const detectedMetadata = new Promise<ProjectIconMetadata>((resolve) => {
      resolveDetectedMetadata = resolve;
    });
    const system = await createOrchestrationSystem({
      resolveProjectIconMetadata: () => Effect.promise(() => detectedMetadata),
    });
    const { engine } = system;

    await system.run(
      engine.dispatch({
        type: "project.create",
        commandId: CommandId.makeUnsafe("cmd-project-icon-stale-create"),
        projectId: asProjectId("project-icon-stale"),
        title: "Icon Project",
        workspaceRoot: "/tmp/project-icon-stale",
        defaultModelSelection: null,
        createdAt,
      }),
    );
    await system.run(
      engine.dispatch({
        type: "project.meta.update",
        commandId: CommandId.makeUnsafe("cmd-project-icon-stale-manual-update"),
        projectId: asProjectId("project-icon-stale"),
        iconMetadata: {
          iconId: "vue",
          label: "Vue",
        },
      }),
    );
    resolveDetectedMetadata({
      iconId: "typescript",
      label: "TypeScript",
    });
    await system.run(Effect.sleep("150 millis"));

    const readModel = await system.run(engine.getReadModel());
    expect(readModel.projects).toContainEqual(
      expect.objectContaining({
        id: asProjectId("project-icon-stale"),
        iconMetadata: {
          iconId: "vue",
          label: "Vue",
        },
      }),
    );
    const events = await system.run(
      Stream.runCollect(engine.readEvents(0)).pipe(
        Effect.map((chunk): OrchestrationEvent[] => Array.from(chunk)),
      ),
    );
    expect(events.map((event) => event.type)).toEqual(["project.created", "project.meta-updated"]);
    await system.dispose();
  });

  it("backfills missing project icon metadata once when the engine starts", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "jcode-engine-icon-backfill-"));
    const dbPath = path.join(rootDir, "state.sqlite");
    let resolveCount = 0;
    let activeResolveCount = 0;
    let maxActiveResolveCount = 0;

    try {
      const seedLayer = OrchestrationEventStoreLive.pipe(
        Layer.provideMerge(makeSqlitePersistenceLive(dbPath)),
        Layer.provideMerge(NodeServices.layer),
      );
      const seedRuntime = ManagedRuntime.make(seedLayer);
      await seedRuntime.runPromise(
        Effect.gen(function* () {
          const eventStore = yield* OrchestrationEventStore;
          const createdAt = now();
          yield* eventStore.append({
            type: "project.created",
            eventId: EventId.makeUnsafe("evt-project-icon-backfill-create"),
            aggregateKind: "project",
            aggregateId: asProjectId("project-icon-backfill"),
            occurredAt: createdAt,
            commandId: CommandId.makeUnsafe("cmd-project-icon-backfill-create"),
            causationEventId: null,
            correlationId: CommandId.makeUnsafe("cmd-project-icon-backfill-create"),
            metadata: {},
            payload: {
              projectId: asProjectId("project-icon-backfill"),
              title: "Backfill Project",
              workspaceRoot: "/tmp/project-icon-backfill",
              defaultModelSelection: null,
              scripts: [],
              createdAt,
              updatedAt: createdAt,
            },
          });
          yield* eventStore.append({
            type: "project.created",
            eventId: EventId.makeUnsafe("evt-project-icon-backfill-create-2"),
            aggregateKind: "project",
            aggregateId: asProjectId("project-icon-backfill-2"),
            occurredAt: createdAt,
            commandId: CommandId.makeUnsafe("cmd-project-icon-backfill-create-2"),
            causationEventId: null,
            correlationId: CommandId.makeUnsafe("cmd-project-icon-backfill-create-2"),
            metadata: {},
            payload: {
              projectId: asProjectId("project-icon-backfill-2"),
              title: "Backfill Project 2",
              workspaceRoot: "/tmp/project-icon-backfill-2",
              defaultModelSelection: null,
              scripts: [],
              createdAt,
              updatedAt: createdAt,
            },
          });
        }),
      );
      await seedRuntime.dispose();

      const ServerConfigLayer = ServerConfig.layerTest(process.cwd(), {
        prefix: "t3-orchestration-engine-icon-backfill-",
      });
      const projectLanguageIconResolverLayer = Layer.succeed(ProjectLanguageIconResolver, {
        resolveMetadata: () =>
          Effect.gen(function* () {
            resolveCount += 1;
            activeResolveCount += 1;
            maxActiveResolveCount = Math.max(maxActiveResolveCount, activeResolveCount);
            yield* Effect.sleep("25 millis");
            activeResolveCount -= 1;
            return {
              iconId: "typescript",
              label: "TypeScript",
            } satisfies ProjectIconMetadata;
          }),
      } satisfies typeof ProjectLanguageIconResolver.Service);
      const orchestrationLayer = OrchestrationEngineLive.pipe(
        Layer.provide(OrchestrationProjectionPipelineLive),
        Layer.provide(OrchestrationEventStoreLive),
        Layer.provide(OrchestrationCommandReceiptRepositoryLive),
        Layer.provide(projectLanguageIconResolverLayer),
        Layer.provideMerge(makeSqlitePersistenceLive(dbPath)),
        Layer.provideMerge(ServerConfigLayer),
        Layer.provideMerge(NodeServices.layer),
      );
      const runtime = ManagedRuntime.make(orchestrationLayer);
      const engine = await runtime.runPromise(Effect.service(OrchestrationEngineService));

      const readModel = await runtime.runPromise(
        waitForProjectIconMetadata(engine, asProjectId("project-icon-backfill-2")),
      );

      expect(readModel.projects).toContainEqual(
        expect.objectContaining({
          id: asProjectId("project-icon-backfill"),
          iconMetadata: {
            iconId: "typescript",
            label: "TypeScript",
          },
        }),
      );
      expect(readModel.projects).toContainEqual(
        expect.objectContaining({
          id: asProjectId("project-icon-backfill-2"),
          iconMetadata: {
            iconId: "typescript",
            label: "TypeScript",
          },
        }),
      );
      expect(resolveCount).toBe(2);
      expect(maxActiveResolveCount).toBe(1);
      await runtime.runPromise(Effect.sleep("25 millis"));
      expect(resolveCount).toBe(2);
      await runtime.dispose();
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("refreshes stale automatic project icon metadata when the engine starts", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "jcode-engine-icon-refresh-"));
    const dbPath = path.join(rootDir, "state.sqlite");
    let resolveCount = 0;
    const projectId = asProjectId("project-icon-refresh");
    const refreshedMetadata = { iconId: "vue", label: "Vue" } satisfies ProjectIconMetadata;

    try {
      const seedLayer = OrchestrationEventStoreLive.pipe(
        Layer.provideMerge(makeSqlitePersistenceLive(dbPath)),
        Layer.provideMerge(NodeServices.layer),
      );
      const seedRuntime = ManagedRuntime.make(seedLayer);
      await seedRuntime.runPromise(
        Effect.gen(function* () {
          const eventStore = yield* OrchestrationEventStore;
          const createdAt = now();
          yield* eventStore.append({
            type: "project.created",
            eventId: EventId.makeUnsafe("evt-project-icon-refresh-create"),
            aggregateKind: "project",
            aggregateId: projectId,
            occurredAt: createdAt,
            commandId: CommandId.makeUnsafe("cmd-project-icon-refresh-create"),
            causationEventId: null,
            correlationId: CommandId.makeUnsafe("cmd-project-icon-refresh-create"),
            metadata: {},
            payload: {
              projectId,
              title: "Refresh Project",
              workspaceRoot: "/tmp/project-icon-refresh",
              defaultModelSelection: null,
              scripts: [],
              createdAt,
              updatedAt: createdAt,
            },
          });
          yield* eventStore.append({
            type: "project.meta-updated",
            eventId: EventId.makeUnsafe("evt-project-icon-refresh-auto"),
            aggregateKind: "project",
            aggregateId: projectId,
            occurredAt: createdAt,
            commandId: CommandId.makeUnsafe(`project-icon-detect:${projectId}`),
            causationEventId: null,
            correlationId: CommandId.makeUnsafe(`project-icon-detect:${projectId}`),
            metadata: {},
            payload: {
              projectId,
              iconMetadata: {
                iconId: "typescript",
                label: "TypeScript",
              },
              updatedAt: createdAt,
            },
          });
        }),
      );
      await seedRuntime.dispose();

      const ServerConfigLayer = ServerConfig.layerTest(process.cwd(), {
        prefix: "t3-orchestration-engine-icon-refresh-",
      });
      const projectLanguageIconResolverLayer = Layer.succeed(ProjectLanguageIconResolver, {
        resolveMetadata: () =>
          Effect.sync(() => {
            resolveCount += 1;
            return refreshedMetadata;
          }),
      } satisfies typeof ProjectLanguageIconResolver.Service);
      const orchestrationLayer = OrchestrationEngineLive.pipe(
        Layer.provide(OrchestrationProjectionPipelineLive),
        Layer.provide(OrchestrationEventStoreLive),
        Layer.provide(OrchestrationCommandReceiptRepositoryLive),
        Layer.provide(projectLanguageIconResolverLayer),
        Layer.provideMerge(makeSqlitePersistenceLive(dbPath)),
        Layer.provideMerge(ServerConfigLayer),
        Layer.provideMerge(NodeServices.layer),
      );
      const runtime = ManagedRuntime.make(orchestrationLayer);
      const engine = await runtime.runPromise(Effect.service(OrchestrationEngineService));

      const readModel = await runtime.runPromise(
        waitForProjectIconMetadataValue(engine, projectId, refreshedMetadata),
      );

      expect(readModel.projects).toContainEqual(
        expect.objectContaining({
          id: projectId,
          iconMetadata: refreshedMetadata,
        }),
      );
      expect(resolveCount).toBe(1);
      const events = await runtime.runPromise(
        Stream.runCollect(engine.readEvents(0)).pipe(
          Effect.map((chunk): OrchestrationEvent[] => Array.from(chunk)),
        ),
      );
      expect(events.map((event) => event.type)).toEqual([
        "project.created",
        "project.meta-updated",
        "project.meta-updated",
      ]);
      await runtime.dispose();
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("refreshes stale automatic project icon metadata more than once across restarts", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "jcode-engine-icon-repeat-refresh-"));
    const dbPath = path.join(rootDir, "state.sqlite");
    const projectId = asProjectId("project-icon-repeat-refresh");
    const vueMetadata = { iconId: "vue", label: "Vue" } satisfies ProjectIconMetadata;
    const reactMetadata = { iconId: "react", label: "React" } satisfies ProjectIconMetadata;

    try {
      const seedRuntime = makePersistentEventStoreRuntime(dbPath);
      await seedRuntime.runPromise(
        Effect.gen(function* () {
          const eventStore = yield* OrchestrationEventStore;
          const createdAt = now();
          yield* eventStore.append({
            type: "project.created",
            eventId: EventId.makeUnsafe("evt-project-icon-repeat-create"),
            aggregateKind: "project",
            aggregateId: projectId,
            occurredAt: createdAt,
            commandId: CommandId.makeUnsafe("cmd-project-icon-repeat-create"),
            causationEventId: null,
            correlationId: CommandId.makeUnsafe("cmd-project-icon-repeat-create"),
            metadata: {},
            payload: {
              projectId,
              title: "Repeat Refresh Project",
              workspaceRoot: "/tmp/project-icon-repeat-refresh",
              defaultModelSelection: null,
              scripts: [],
              createdAt,
              updatedAt: createdAt,
            },
          });
          yield* eventStore.append({
            type: "project.meta-updated",
            eventId: EventId.makeUnsafe("evt-project-icon-repeat-auto"),
            aggregateKind: "project",
            aggregateId: projectId,
            occurredAt: createdAt,
            commandId: CommandId.makeUnsafe(`project-icon-detect:${projectId}`),
            causationEventId: null,
            correlationId: CommandId.makeUnsafe(`project-icon-detect:${projectId}`),
            metadata: {},
            payload: {
              projectId,
              iconMetadata: { iconId: "typescript", label: "TypeScript" },
              updatedAt: createdAt,
            },
          });
        }),
      );
      await seedRuntime.dispose();

      const firstRuntime = makePersistentOrchestrationRuntime({
        dbPath,
        prefix: "t3-orchestration-engine-icon-repeat-first-",
        resolveProjectIconMetadata: () => Effect.succeed(vueMetadata),
      });
      const firstEngine = await firstRuntime.runPromise(Effect.service(OrchestrationEngineService));
      await firstRuntime.runPromise(
        waitForProjectIconMetadataValue(firstEngine, projectId, vueMetadata),
      );
      await firstRuntime.dispose();

      const secondRuntime = makePersistentOrchestrationRuntime({
        dbPath,
        prefix: "t3-orchestration-engine-icon-repeat-second-",
        resolveProjectIconMetadata: () => Effect.succeed(reactMetadata),
      });
      const secondEngine = await secondRuntime.runPromise(
        Effect.service(OrchestrationEngineService),
      );
      const readModel = await secondRuntime.runPromise(
        waitForProjectIconMetadataValue(secondEngine, projectId, reactMetadata),
      );

      expect(readModel.projects).toContainEqual(
        expect.objectContaining({ id: projectId, iconMetadata: reactMetadata }),
      );
      const events = await secondRuntime.runPromise(
        Stream.runCollect(secondEngine.readEvents(0)).pipe(
          Effect.map((chunk): OrchestrationEvent[] => Array.from(chunk)),
        ),
      );
      expect(events.map((event) => event.type)).toEqual([
        "project.created",
        "project.meta-updated",
        "project.meta-updated",
        "project.meta-updated",
      ]);
      await secondRuntime.dispose();
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("preserves persisted manual project icon metadata when the engine starts", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "jcode-engine-icon-manual-refresh-"));
    const dbPath = path.join(rootDir, "state.sqlite");
    const projectId = asProjectId("project-icon-manual-refresh");
    let resolveCount = 0;

    try {
      const seedRuntime = makePersistentEventStoreRuntime(dbPath);
      await seedRuntime.runPromise(
        Effect.gen(function* () {
          const eventStore = yield* OrchestrationEventStore;
          const createdAt = now();
          yield* eventStore.append({
            type: "project.created",
            eventId: EventId.makeUnsafe("evt-project-icon-manual-create"),
            aggregateKind: "project",
            aggregateId: projectId,
            occurredAt: createdAt,
            commandId: CommandId.makeUnsafe("cmd-project-icon-manual-create"),
            causationEventId: null,
            correlationId: CommandId.makeUnsafe("cmd-project-icon-manual-create"),
            metadata: {},
            payload: {
              projectId,
              title: "Manual Icon Project",
              workspaceRoot: "/tmp/project-icon-manual-refresh",
              defaultModelSelection: null,
              scripts: [],
              createdAt,
              updatedAt: createdAt,
            },
          });
          yield* eventStore.append({
            type: "project.meta-updated",
            eventId: EventId.makeUnsafe("evt-project-icon-manual-update"),
            aggregateKind: "project",
            aggregateId: projectId,
            occurredAt: createdAt,
            commandId: CommandId.makeUnsafe("cmd-project-icon-manual-update"),
            causationEventId: null,
            correlationId: CommandId.makeUnsafe("cmd-project-icon-manual-update"),
            metadata: {},
            payload: {
              projectId,
              iconMetadata: { iconId: "vue", label: "Vue" },
              updatedAt: createdAt,
            },
          });
        }),
      );
      await seedRuntime.dispose();

      const runtime = makePersistentOrchestrationRuntime({
        dbPath,
        prefix: "t3-orchestration-engine-icon-manual-",
        resolveProjectIconMetadata: () =>
          Effect.sync(() => {
            resolveCount += 1;
            return { iconId: "typescript", label: "TypeScript" } satisfies ProjectIconMetadata;
          }),
      });
      const engine = await runtime.runPromise(Effect.service(OrchestrationEngineService));
      await runtime.runPromise(Effect.sleep("150 millis"));
      const readModel = await runtime.runPromise(engine.getReadModel());

      expect(resolveCount).toBe(0);
      expect(readModel.projects).toContainEqual(
        expect.objectContaining({
          id: projectId,
          iconMetadata: { iconId: "vue", label: "Vue" },
        }),
      );
      await runtime.dispose();
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("caps startup project icon metadata backfill work", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "jcode-engine-icon-cap-"));
    const dbPath = path.join(rootDir, "state.sqlite");
    let resolveCount = 0;
    const cappedProjectCount = 20;

    try {
      const seedRuntime = makePersistentEventStoreRuntime(dbPath);
      await seedRuntime.runPromise(
        Effect.gen(function* () {
          const eventStore = yield* OrchestrationEventStore;
          const createdAt = now();
          for (let index = 0; index <= cappedProjectCount; index += 1) {
            const projectId = asProjectId(`project-icon-cap-${index}`);
            yield* eventStore.append({
              type: "project.created",
              eventId: EventId.makeUnsafe(`evt-project-icon-cap-create-${index}`),
              aggregateKind: "project",
              aggregateId: projectId,
              occurredAt: createdAt,
              commandId: CommandId.makeUnsafe(`cmd-project-icon-cap-create-${index}`),
              causationEventId: null,
              correlationId: CommandId.makeUnsafe(`cmd-project-icon-cap-create-${index}`),
              metadata: {},
              payload: {
                projectId,
                title: `Cap Project ${index}`,
                workspaceRoot: `/tmp/project-icon-cap-${index}`,
                defaultModelSelection: null,
                scripts: [],
                createdAt,
                updatedAt: createdAt,
              },
            });
          }
        }),
      );
      await seedRuntime.dispose();

      const runtime = makePersistentOrchestrationRuntime({
        dbPath,
        prefix: "t3-orchestration-engine-icon-cap-",
        resolveProjectIconMetadata: () =>
          Effect.sync(() => {
            resolveCount += 1;
            return { iconId: "typescript", label: "TypeScript" } satisfies ProjectIconMetadata;
          }),
      });
      const engine = await runtime.runPromise(Effect.service(OrchestrationEngineService));
      const readModel = await runtime.runPromise(
        waitForProjectIconMetadata(engine, asProjectId("project-icon-cap-19")),
      );
      await runtime.runPromise(Effect.sleep("150 millis"));
      const current = await runtime.runPromise(engine.getReadModel());

      expect(resolveCount).toBe(cappedProjectCount);
      expect(readModel.projects).toContainEqual(
        expect.objectContaining({
          id: asProjectId("project-icon-cap-19"),
          iconMetadata: { iconId: "typescript", label: "TypeScript" },
        }),
      );
      expect(current.projects).toContainEqual(
        expect.objectContaining({
          id: asProjectId("project-icon-cap-20"),
          iconMetadata: null,
        }),
      );
      await runtime.dispose();
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("replays append-only events from sequence", async () => {
    const system = await createOrchestrationSystem();
    const { engine } = system;
    const createdAt = now();

    await system.run(
      engine.dispatch({
        type: "project.create",
        commandId: CommandId.makeUnsafe("cmd-project-replay-create"),
        projectId: asProjectId("project-replay"),
        title: "Replay Project",
        workspaceRoot: "/tmp/project-replay",
        defaultModelSelection: {
          provider: "codex",
          model: "gpt-5-codex",
        },
        createdAt,
      }),
    );
    await system.run(
      engine.dispatch({
        type: "thread.create",
        commandId: CommandId.makeUnsafe("cmd-thread-replay-create"),
        threadId: ThreadId.makeUnsafe("thread-replay"),
        projectId: asProjectId("project-replay"),
        title: "replay",
        modelSelection: {
          provider: "codex",
          model: "gpt-5-codex",
        },
        interactionMode: DEFAULT_PROVIDER_INTERACTION_MODE,
        runtimeMode: "approval-required",
        branch: null,
        worktreePath: null,
        createdAt,
      }),
    );
    await system.run(
      engine.dispatch({
        type: "thread.delete",
        commandId: CommandId.makeUnsafe("cmd-thread-replay-delete"),
        threadId: ThreadId.makeUnsafe("thread-replay"),
      }),
    );

    const events = await system.run(
      Stream.runCollect(engine.readEvents(0)).pipe(
        Effect.map((chunk): OrchestrationEvent[] => Array.from(chunk)),
      ),
    );
    expect(events.map((event) => event.type)).toEqual([
      "project.created",
      "thread.created",
      "thread.deleted",
    ]);
    await system.dispose();
  });

  it("streams persisted domain events in order", async () => {
    const system = await createOrchestrationSystem();
    const { engine } = system;
    const createdAt = now();

    await system.run(
      engine.dispatch({
        type: "project.create",
        commandId: CommandId.makeUnsafe("cmd-project-stream-create"),
        projectId: asProjectId("project-stream"),
        title: "Stream Project",
        workspaceRoot: "/tmp/project-stream",
        defaultModelSelection: {
          provider: "codex",
          model: "gpt-5-codex",
        },
        createdAt,
      }),
    );

    const eventTypes: string[] = [];
    await system.run(
      Effect.gen(function* () {
        const eventQueue = yield* Queue.unbounded<OrchestrationEvent>();
        yield* Effect.forkScoped(
          Stream.take(engine.streamDomainEvents, 2).pipe(
            Stream.runForEach((event) => Queue.offer(eventQueue, event).pipe(Effect.asVoid)),
          ),
        );
        yield* Effect.sleep("10 millis");
        yield* engine.dispatch({
          type: "thread.create",
          commandId: CommandId.makeUnsafe("cmd-stream-thread-create"),
          threadId: ThreadId.makeUnsafe("thread-stream"),
          projectId: asProjectId("project-stream"),
          title: "domain-stream",
          modelSelection: {
            provider: "codex",
            model: "gpt-5-codex",
          },
          interactionMode: DEFAULT_PROVIDER_INTERACTION_MODE,
          runtimeMode: "approval-required",
          branch: null,
          worktreePath: null,
          createdAt,
        });
        yield* engine.dispatch({
          type: "thread.meta.update",
          commandId: CommandId.makeUnsafe("cmd-stream-thread-update"),
          threadId: ThreadId.makeUnsafe("thread-stream"),
          title: "domain-stream-updated",
        });
        eventTypes.push((yield* Queue.take(eventQueue)).type);
        eventTypes.push((yield* Queue.take(eventQueue)).type);
      }).pipe(Effect.scoped),
    );

    expect(eventTypes).toEqual(["thread.created", "thread.meta-updated"]);
    await system.dispose();
  });

  it("stores completed checkpoint summaries even when no files changed", async () => {
    const system = await createOrchestrationSystem();
    const { engine } = system;
    const createdAt = now();

    await system.run(
      engine.dispatch({
        type: "project.create",
        commandId: CommandId.makeUnsafe("cmd-project-turn-diff-create"),
        projectId: asProjectId("project-turn-diff"),
        title: "Turn Diff Project",
        workspaceRoot: "/tmp/project-turn-diff",
        defaultModelSelection: {
          provider: "codex",
          model: "gpt-5-codex",
        },
        createdAt,
      }),
    );
    await system.run(
      engine.dispatch({
        type: "thread.create",
        commandId: CommandId.makeUnsafe("cmd-thread-turn-diff-create"),
        threadId: ThreadId.makeUnsafe("thread-turn-diff"),
        projectId: asProjectId("project-turn-diff"),
        title: "Turn diff thread",
        modelSelection: {
          provider: "codex",
          model: "gpt-5-codex",
        },
        interactionMode: DEFAULT_PROVIDER_INTERACTION_MODE,
        runtimeMode: "approval-required",
        branch: null,
        worktreePath: null,
        createdAt,
      }),
    );
    await system.run(
      engine.dispatch({
        type: "thread.turn.diff.complete",
        commandId: CommandId.makeUnsafe("cmd-turn-diff-complete"),
        threadId: ThreadId.makeUnsafe("thread-turn-diff"),
        turnId: asTurnId("turn-1"),
        completedAt: createdAt,
        checkpointRef: asCheckpointRef("refs/t3/checkpoints/thread-turn-diff/turn/1"),
        status: "ready",
        files: [],
        checkpointTurnCount: 1,
        createdAt,
      }),
    );

    const thread = (await system.run(engine.getReadModel())).threads.find(
      (entry) => entry.id === "thread-turn-diff",
    );
    expect(thread?.checkpoints).toEqual([
      {
        turnId: asTurnId("turn-1"),
        checkpointTurnCount: 1,
        checkpointRef: asCheckpointRef("refs/t3/checkpoints/thread-turn-diff/turn/1"),
        status: "ready",
        files: [],
        assistantMessageId: null,
        completedAt: createdAt,
      },
    ]);
    await system.dispose();
  });

  it("keeps processing queued commands after a storage failure", async () => {
    type StoredEvent =
      ReturnType<OrchestrationEventStoreShape["append"]> extends Effect.Effect<infer A, any, any>
        ? A
        : never;
    const events: StoredEvent[] = [];
    let nextSequence = 1;
    let shouldFailFirstAppend = true;

    const flakyStore: OrchestrationEventStoreShape = {
      append(event) {
        if (shouldFailFirstAppend && event.commandId === CommandId.makeUnsafe("cmd-flaky-1")) {
          shouldFailFirstAppend = false;
          return Effect.fail(
            new PersistenceSqlError({
              operation: "test.append",
              detail: "append failed",
            }),
          );
        }
        const savedEvent = {
          ...event,
          sequence: nextSequence,
        } as StoredEvent;
        nextSequence += 1;
        events.push(savedEvent);
        return Effect.succeed(savedEvent);
      },
      readFromSequence(sequenceExclusive) {
        return Stream.fromIterable(events.filter((event) => event.sequence > sequenceExclusive));
      },
      readAll() {
        return Stream.fromIterable(events);
      },
    };

    const ServerConfigLayer = ServerConfig.layerTest(process.cwd(), {
      prefix: "t3-orchestration-engine-test-",
    });

    const runtime = ManagedRuntime.make(
      OrchestrationEngineLive.pipe(
        Layer.provide(OrchestrationProjectionPipelineLive),
        Layer.provide(Layer.succeed(OrchestrationEventStore, flakyStore)),
        Layer.provide(OrchestrationCommandReceiptRepositoryLive),
        Layer.provide(NoopProjectLanguageIconResolverLayer),
        Layer.provide(SqlitePersistenceMemory),
        Layer.provideMerge(ServerConfigLayer),
        Layer.provideMerge(NodeServices.layer),
      ),
    );
    const engine = await runtime.runPromise(Effect.service(OrchestrationEngineService));
    const createdAt = now();

    await runtime.runPromise(
      engine.dispatch({
        type: "project.create",
        commandId: CommandId.makeUnsafe("cmd-project-flaky-create"),
        projectId: asProjectId("project-flaky"),
        title: "Flaky Project",
        workspaceRoot: "/tmp/project-flaky",
        defaultModelSelection: {
          provider: "codex",
          model: "gpt-5-codex",
        },
        createdAt,
      }),
    );

    await expect(
      runtime.runPromise(
        engine.dispatch({
          type: "thread.create",
          commandId: CommandId.makeUnsafe("cmd-flaky-1"),
          threadId: ThreadId.makeUnsafe("thread-flaky-fail"),
          projectId: asProjectId("project-flaky"),
          title: "flaky-fail",
          modelSelection: {
            provider: "codex",
            model: "gpt-5-codex",
          },
          interactionMode: DEFAULT_PROVIDER_INTERACTION_MODE,
          runtimeMode: "approval-required",
          branch: null,
          worktreePath: null,
          createdAt,
        }),
      ),
    ).rejects.toThrow("failed unexpectedly");

    const result = await runtime.runPromise(
      engine.dispatch({
        type: "thread.create",
        commandId: CommandId.makeUnsafe("cmd-flaky-2"),
        threadId: ThreadId.makeUnsafe("thread-flaky-ok"),
        projectId: asProjectId("project-flaky"),
        title: "flaky-ok",
        modelSelection: {
          provider: "codex",
          model: "gpt-5-codex",
        },
        interactionMode: DEFAULT_PROVIDER_INTERACTION_MODE,
        runtimeMode: "approval-required",
        branch: null,
        worktreePath: null,
        createdAt,
      }),
    );

    expect(result.sequence).toBe(2);
    expect((await runtime.runPromise(engine.getReadModel())).snapshotSequence).toBe(2);
    await runtime.dispose();
  });

  it("rolls back all events for a multi-event command when projection fails mid-dispatch", async () => {
    let shouldFailRequestedProjection = true;
    const flakyProjectionPipeline: OrchestrationProjectionPipelineShape = {
      bootstrap: Effect.void,
      projectMetadataEvent: () => Effect.void,
      projectEvent: () => Effect.void,
      projectHotEvent: (event) => {
        if (
          shouldFailRequestedProjection &&
          event.commandId === CommandId.makeUnsafe("cmd-turn-start-atomic") &&
          event.type === "thread.turn-start-requested"
        ) {
          shouldFailRequestedProjection = false;
          return Effect.fail(
            new PersistenceSqlError({
              operation: "test.projection",
              detail: "projection failed",
            }),
          );
        }
        return Effect.void;
      },
      projectDeferredEvent: () => Effect.void,
    };

    const runtime = ManagedRuntime.make(
      OrchestrationEngineLive.pipe(
        Layer.provide(Layer.succeed(OrchestrationProjectionPipeline, flakyProjectionPipeline)),
        Layer.provide(OrchestrationEventStoreLive),
        Layer.provide(OrchestrationCommandReceiptRepositoryLive),
        Layer.provide(NoopProjectLanguageIconResolverLayer),
        Layer.provide(SqlitePersistenceMemory),
      ),
    );
    const engine = await runtime.runPromise(Effect.service(OrchestrationEngineService));
    const createdAt = now();

    await runtime.runPromise(
      engine.dispatch({
        type: "project.create",
        commandId: CommandId.makeUnsafe("cmd-project-atomic-create"),
        projectId: asProjectId("project-atomic"),
        title: "Atomic Project",
        workspaceRoot: "/tmp/project-atomic",
        defaultModelSelection: {
          provider: "codex",
          model: "gpt-5-codex",
        },
        createdAt,
      }),
    );
    await runtime.runPromise(
      engine.dispatch({
        type: "thread.create",
        commandId: CommandId.makeUnsafe("cmd-thread-atomic-create"),
        threadId: ThreadId.makeUnsafe("thread-atomic"),
        projectId: asProjectId("project-atomic"),
        title: "atomic",
        modelSelection: {
          provider: "codex",
          model: "gpt-5-codex",
        },
        interactionMode: DEFAULT_PROVIDER_INTERACTION_MODE,
        runtimeMode: "approval-required",
        branch: null,
        worktreePath: null,
        createdAt,
      }),
    );

    const turnStartCommand = {
      type: "thread.turn.start" as const,
      commandId: CommandId.makeUnsafe("cmd-turn-start-atomic"),
      threadId: ThreadId.makeUnsafe("thread-atomic"),
      message: {
        messageId: asMessageId("msg-atomic-1"),
        role: "user" as const,
        text: "hello",
        attachments: [],
      },
      interactionMode: DEFAULT_PROVIDER_INTERACTION_MODE,
      runtimeMode: "approval-required" as const,
      createdAt,
    };

    await expect(runtime.runPromise(engine.dispatch(turnStartCommand))).rejects.toThrow(
      "failed unexpectedly",
    );

    const eventsAfterFailure = await runtime.runPromise(
      Stream.runCollect(engine.readEvents(0)).pipe(
        Effect.map((chunk): OrchestrationEvent[] => Array.from(chunk)),
      ),
    );
    expect(eventsAfterFailure.map((event) => event.type)).toEqual([
      "project.created",
      "thread.created",
    ]);
    expect((await runtime.runPromise(engine.getReadModel())).snapshotSequence).toBe(2);

    const retryResult = await runtime.runPromise(engine.dispatch(turnStartCommand));
    expect(retryResult.sequence).toBe(4);

    const eventsAfterRetry = await runtime.runPromise(
      Stream.runCollect(engine.readEvents(0)).pipe(
        Effect.map((chunk): OrchestrationEvent[] => Array.from(chunk)),
      ),
    );
    expect(eventsAfterRetry.map((event) => event.type)).toEqual([
      "project.created",
      "thread.created",
      "thread.message-sent",
      "thread.turn-start-requested",
    ]);
    expect(
      eventsAfterRetry.filter((event) => event.commandId === turnStartCommand.commandId),
    ).toHaveLength(2);

    await runtime.dispose();
  });

  it("keeps processing later commands after an unexpected worker defect", async () => {
    type StoredEvent =
      ReturnType<OrchestrationEventStoreShape["append"]> extends Effect.Effect<infer A, any, any>
        ? A
        : never;
    const events: StoredEvent[] = [];
    let nextSequence = 1;

    const nonTransactionalStore: OrchestrationEventStoreShape = {
      append(event) {
        const savedEvent = {
          ...event,
          sequence: nextSequence,
        } as StoredEvent;
        nextSequence += 1;
        events.push(savedEvent);
        return Effect.succeed(savedEvent);
      },
      readFromSequence(sequenceExclusive) {
        return Stream.fromIterable(events.filter((event) => event.sequence > sequenceExclusive));
      },
      readAll() {
        return Stream.fromIterable(events);
      },
    };

    let shouldDieProjection = true;
    const defectiveProjectionPipeline: OrchestrationProjectionPipelineShape = {
      bootstrap: Effect.void,
      projectMetadataEvent: (event) => {
        if (
          shouldDieProjection &&
          event.commandId === CommandId.makeUnsafe("cmd-project-defect-1")
        ) {
          shouldDieProjection = false;
          return Effect.die("projection defect");
        }
        return Effect.void;
      },
      projectEvent: () => Effect.void,
      projectHotEvent: () => Effect.void,
      projectDeferredEvent: () => Effect.void,
    };

    const runtime = ManagedRuntime.make(
      OrchestrationEngineLive.pipe(
        Layer.provide(Layer.succeed(OrchestrationProjectionPipeline, defectiveProjectionPipeline)),
        Layer.provide(Layer.succeed(OrchestrationEventStore, nonTransactionalStore)),
        Layer.provide(OrchestrationCommandReceiptRepositoryLive),
        Layer.provide(NoopProjectLanguageIconResolverLayer),
        Layer.provide(SqlitePersistenceMemory),
      ),
    );
    const engine = await runtime.runPromise(Effect.service(OrchestrationEngineService));
    const createdAt = now();

    await expect(
      runtime.runPromise(
        engine.dispatch({
          type: "project.create",
          commandId: CommandId.makeUnsafe("cmd-project-defect-1"),
          projectId: asProjectId("project-defect-1"),
          title: "Defective Project",
          workspaceRoot: "/tmp/project-defect-1",
          defaultModelSelection: {
            provider: "codex",
            model: "gpt-5-codex",
          },
          createdAt,
        }),
      ),
    ).rejects.toThrow("failed unexpectedly");

    await expect(
      runtime.runPromise(
        engine.dispatch({
          type: "project.create",
          commandId: CommandId.makeUnsafe("cmd-project-defect-2"),
          projectId: asProjectId("project-defect-2"),
          title: "Recovered Project",
          workspaceRoot: "/tmp/project-defect-2",
          defaultModelSelection: {
            provider: "codex",
            model: "gpt-5-codex",
          },
          createdAt,
        }),
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        sequence: expect.any(Number),
      }),
    );

    const eventsAfterRecovery = await runtime.runPromise(
      Stream.runCollect(engine.readEvents(0)).pipe(
        Effect.map((chunk): OrchestrationEvent[] => Array.from(chunk)),
      ),
    );
    expect(eventsAfterRecovery.map((event) => event.commandId)).toEqual([
      CommandId.makeUnsafe("cmd-project-defect-1"),
      CommandId.makeUnsafe("cmd-project-defect-2"),
    ]);
    expect(eventsAfterRecovery.every((event) => event.type === "project.created")).toBe(true);

    await runtime.dispose();
  });

  it("reconciles in-memory state when append persists but projection fails", async () => {
    type StoredEvent =
      ReturnType<OrchestrationEventStoreShape["append"]> extends Effect.Effect<infer A, any, any>
        ? A
        : never;
    const events: StoredEvent[] = [];
    let nextSequence = 1;

    const nonTransactionalStore: OrchestrationEventStoreShape = {
      append(event) {
        const savedEvent = {
          ...event,
          sequence: nextSequence,
        } as StoredEvent;
        nextSequence += 1;
        events.push(savedEvent);
        return Effect.succeed(savedEvent);
      },
      readFromSequence(sequenceExclusive) {
        return Stream.fromIterable(events.filter((event) => event.sequence > sequenceExclusive));
      },
      readAll() {
        return Stream.fromIterable(events);
      },
    };

    let shouldFailProjection = true;
    const flakyProjectionPipeline: OrchestrationProjectionPipelineShape = {
      bootstrap: Effect.void,
      projectMetadataEvent: () => Effect.void,
      projectEvent: () => Effect.void,
      projectHotEvent: (event) => {
        if (
          shouldFailProjection &&
          event.commandId === CommandId.makeUnsafe("cmd-thread-meta-sync-fail")
        ) {
          shouldFailProjection = false;
          return Effect.fail(
            new PersistenceSqlError({
              operation: "test.projection",
              detail: "projection failed",
            }),
          );
        }
        return Effect.void;
      },
      projectDeferredEvent: () => Effect.void,
    };

    const runtime = ManagedRuntime.make(
      OrchestrationEngineLive.pipe(
        Layer.provide(Layer.succeed(OrchestrationProjectionPipeline, flakyProjectionPipeline)),
        Layer.provide(Layer.succeed(OrchestrationEventStore, nonTransactionalStore)),
        Layer.provide(OrchestrationCommandReceiptRepositoryLive),
        Layer.provide(NoopProjectLanguageIconResolverLayer),
        Layer.provide(SqlitePersistenceMemory),
      ),
    );
    const engine = await runtime.runPromise(Effect.service(OrchestrationEngineService));
    const createdAt = now();

    await runtime.runPromise(
      engine.dispatch({
        type: "project.create",
        commandId: CommandId.makeUnsafe("cmd-project-sync-create"),
        projectId: asProjectId("project-sync"),
        title: "Sync Project",
        workspaceRoot: "/tmp/project-sync",
        defaultModelSelection: {
          provider: "codex",
          model: "gpt-5-codex",
        },
        createdAt,
      }),
    );
    await runtime.runPromise(
      engine.dispatch({
        type: "thread.create",
        commandId: CommandId.makeUnsafe("cmd-thread-sync-create"),
        threadId: ThreadId.makeUnsafe("thread-sync"),
        projectId: asProjectId("project-sync"),
        title: "sync-before",
        modelSelection: {
          provider: "codex",
          model: "gpt-5-codex",
        },
        interactionMode: DEFAULT_PROVIDER_INTERACTION_MODE,
        runtimeMode: "approval-required",
        branch: null,
        worktreePath: null,
        createdAt,
      }),
    );

    await expect(
      runtime.runPromise(
        engine.dispatch({
          type: "thread.meta.update",
          commandId: CommandId.makeUnsafe("cmd-thread-meta-sync-fail"),
          threadId: ThreadId.makeUnsafe("thread-sync"),
          title: "sync-after-failed-projection",
        }),
      ),
    ).rejects.toThrow("failed unexpectedly");

    const readModelAfterFailure = await runtime.runPromise(engine.getReadModel());
    const updatedThread = readModelAfterFailure.threads.find(
      (thread) => thread.id === "thread-sync",
    );
    expect(readModelAfterFailure.snapshotSequence).toBe(3);
    expect(updatedThread?.title).toBe("sync-after-failed-projection");

    await runtime.dispose();
  });

  it("fails command dispatch when command invariants are violated", async () => {
    const system = await createOrchestrationSystem();
    const { engine } = system;

    await expect(
      system.run(
        engine.dispatch({
          type: "thread.turn.start",
          commandId: CommandId.makeUnsafe("cmd-invariant-missing-thread"),
          threadId: ThreadId.makeUnsafe("thread-missing"),
          message: {
            messageId: asMessageId("msg-missing"),
            role: "user",
            text: "hello",
            attachments: [],
          },
          interactionMode: DEFAULT_PROVIDER_INTERACTION_MODE,
          runtimeMode: "approval-required",
          createdAt: now(),
        }),
      ),
    ).rejects.toThrow("Thread 'thread-missing' does not exist");

    await system.dispose();
  });

  it("schedules one deferred projection catch-up after a deferred projection failure", async () => {
    let bootstrapCalls = 0;
    let deferredCalls = 0;
    let resolveRecoveryBootstrap: (() => void) | null = null;
    const recoveryBootstrap = new Promise<void>((resolve) => {
      resolveRecoveryBootstrap = resolve;
    });

    const flakyProjectionPipeline: OrchestrationProjectionPipelineShape = {
      bootstrap: Effect.sync(() => {
        bootstrapCalls += 1;
        if (bootstrapCalls === 2) {
          resolveRecoveryBootstrap?.();
        }
      }),
      projectMetadataEvent: () => Effect.void,
      projectEvent: () => Effect.void,
      projectHotEvent: () => Effect.void,
      projectDeferredEvent: () => {
        deferredCalls += 1;
        if (deferredCalls === 1) {
          return Effect.fail(
            new PersistenceSqlError({
              operation: "test.deferredProjection",
              detail: "deferred projection failed",
            }),
          );
        }
        return Effect.void;
      },
    };

    const runtime = ManagedRuntime.make(
      OrchestrationEngineLive.pipe(
        Layer.provide(Layer.succeed(OrchestrationProjectionPipeline, flakyProjectionPipeline)),
        Layer.provide(OrchestrationEventStoreLive),
        Layer.provide(OrchestrationCommandReceiptRepositoryLive),
        Layer.provide(NoopProjectLanguageIconResolverLayer),
        Layer.provide(SqlitePersistenceMemory),
      ),
    );
    const engine = await runtime.runPromise(Effect.service(OrchestrationEngineService));
    const createdAt = now();

    await runtime.runPromise(
      engine.dispatch({
        type: "project.create",
        commandId: CommandId.makeUnsafe("cmd-project-deferred-recovery"),
        projectId: asProjectId("project-deferred-recovery"),
        title: "Deferred Recovery Project",
        workspaceRoot: "/tmp/project-deferred-recovery",
        defaultModelSelection: {
          provider: "codex",
          model: "gpt-5-codex",
        },
        createdAt,
      }),
    );
    await runtime.runPromise(
      engine.dispatch({
        type: "thread.create",
        commandId: CommandId.makeUnsafe("cmd-thread-deferred-recovery"),
        threadId: ThreadId.makeUnsafe("thread-deferred-recovery"),
        projectId: asProjectId("project-deferred-recovery"),
        title: "deferred-recovery",
        modelSelection: {
          provider: "codex",
          model: "gpt-5-codex",
        },
        interactionMode: DEFAULT_PROVIDER_INTERACTION_MODE,
        runtimeMode: "approval-required",
        branch: null,
        worktreePath: null,
        createdAt,
      }),
    );

    const result = await runtime.runPromise(
      engine.dispatch({
        type: "thread.turn.start",
        commandId: CommandId.makeUnsafe("cmd-turn-start-deferred-recovery"),
        threadId: ThreadId.makeUnsafe("thread-deferred-recovery"),
        message: {
          messageId: asMessageId("msg-deferred-recovery"),
          role: "user",
          text: "hello",
          attachments: [],
        },
        interactionMode: DEFAULT_PROVIDER_INTERACTION_MODE,
        runtimeMode: "approval-required",
        createdAt,
      }),
    );

    await recoveryBootstrap;

    expect(result.sequence).toBe(4);
    expect(deferredCalls).toBeGreaterThanOrEqual(1);
    expect(bootstrapCalls).toBe(2);

    await runtime.dispose();
  });

  it("retires an empty existing project when re-adding the same workspace root", async () => {
    const system = await createOrchestrationSystem();
    const { engine } = system;
    const createdAt = now();

    await system.run(
      engine.dispatch({
        type: "project.create",
        commandId: CommandId.makeUnsafe("cmd-project-stale-create"),
        projectId: asProjectId("project-stale"),
        title: "Stale Project",
        workspaceRoot: "/tmp/readd-project",
        defaultModelSelection: {
          provider: "codex",
          model: "gpt-5-codex",
        },
        createdAt,
      }),
    );

    await expect(
      system.run(
        engine.dispatch({
          type: "project.create",
          commandId: CommandId.makeUnsafe("cmd-project-readd-create"),
          projectId: asProjectId("project-readd"),
          title: "Readded Project",
          workspaceRoot: "/tmp/readd-project",
          defaultModelSelection: {
            provider: "codex",
            model: "gpt-5-codex",
          },
          createdAt,
        }),
      ),
    ).resolves.toEqual({ sequence: 3 });

    const readModel = await system.run(engine.getReadModel());
    expect(
      readModel.projects.find((project) => project.id === asProjectId("project-stale"))?.deletedAt,
    ).toBe(createdAt);
    expect(
      readModel.projects.find((project) => project.id === asProjectId("project-readd"))?.deletedAt,
    ).toBeNull();

    await system.dispose();
  });

  it("keeps rejecting a duplicate workspace root when the existing project has threads", async () => {
    const system = await createOrchestrationSystem();
    const { engine } = system;
    const createdAt = now();

    await system.run(
      engine.dispatch({
        type: "project.create",
        commandId: CommandId.makeUnsafe("cmd-project-active-create"),
        projectId: asProjectId("project-active"),
        title: "Active Project",
        workspaceRoot: "/tmp/active-project",
        defaultModelSelection: {
          provider: "codex",
          model: "gpt-5-codex",
        },
        createdAt,
      }),
    );
    await system.run(
      engine.dispatch({
        type: "thread.create",
        commandId: CommandId.makeUnsafe("cmd-project-active-thread-create"),
        threadId: ThreadId.makeUnsafe("thread-active"),
        projectId: asProjectId("project-active"),
        title: "active",
        modelSelection: {
          provider: "codex",
          model: "gpt-5-codex",
        },
        interactionMode: DEFAULT_PROVIDER_INTERACTION_MODE,
        runtimeMode: "approval-required",
        branch: null,
        worktreePath: null,
        createdAt,
      }),
    );

    await expect(
      system.run(
        engine.dispatch({
          type: "project.create",
          commandId: CommandId.makeUnsafe("cmd-project-active-duplicate-create"),
          projectId: asProjectId("project-active-duplicate"),
          title: "Active Duplicate",
          workspaceRoot: "/tmp/active-project",
          defaultModelSelection: {
            provider: "codex",
            model: "gpt-5-codex",
          },
          createdAt,
        }),
      ),
    ).rejects.toThrow("already uses workspace root");

    await system.dispose();
  });

  it("rejects duplicate thread creation", async () => {
    const system = await createOrchestrationSystem();
    const { engine } = system;
    const createdAt = now();

    await system.run(
      engine.dispatch({
        type: "project.create",
        commandId: CommandId.makeUnsafe("cmd-project-duplicate-create"),
        projectId: asProjectId("project-duplicate"),
        title: "Duplicate Project",
        workspaceRoot: "/tmp/project-duplicate",
        defaultModelSelection: {
          provider: "codex",
          model: "gpt-5-codex",
        },
        createdAt,
      }),
    );

    await system.run(
      engine.dispatch({
        type: "thread.create",
        commandId: CommandId.makeUnsafe("cmd-thread-duplicate-1"),
        threadId: ThreadId.makeUnsafe("thread-duplicate"),
        projectId: asProjectId("project-duplicate"),
        title: "duplicate",
        modelSelection: {
          provider: "codex",
          model: "gpt-5-codex",
        },
        interactionMode: DEFAULT_PROVIDER_INTERACTION_MODE,
        runtimeMode: "approval-required",
        branch: null,
        worktreePath: null,
        createdAt,
      }),
    );

    await expect(
      system.run(
        engine.dispatch({
          type: "thread.create",
          commandId: CommandId.makeUnsafe("cmd-thread-duplicate-2"),
          threadId: ThreadId.makeUnsafe("thread-duplicate"),
          projectId: asProjectId("project-duplicate"),
          title: "duplicate",
          modelSelection: {
            provider: "codex",
            model: "gpt-5-codex",
          },
          interactionMode: DEFAULT_PROVIDER_INTERACTION_MODE,
          runtimeMode: "approval-required",
          branch: null,
          worktreePath: null,
          createdAt,
        }),
      ),
    ).rejects.toThrow("already exists");

    await system.dispose();
  });
});
