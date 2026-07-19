import { CommandId, SIDEBAR_LAYOUT_ID } from "@jcode/contracts";
import { assert, it } from "@effect/vitest";
import { Effect, Layer, Option } from "effect";

import { OrchestrationCommandReceiptRepository } from "../Services/OrchestrationCommandReceipts.ts";
import { OrchestrationCommandReceiptRepositoryLive } from "./OrchestrationCommandReceipts.ts";
import { SqlitePersistenceMemory } from "./Sqlite.ts";

const layer = it.layer(
  OrchestrationCommandReceiptRepositoryLive.pipe(Layer.provideMerge(SqlitePersistenceMemory)),
);

layer("OrchestrationCommandReceiptRepository", (it) => {
  it.effect("round-trips sidebar-layout aggregate receipts", () =>
    Effect.gen(function* () {
      // Given: a receipt for the singleton sidebar-layout aggregate.
      const receipts = yield* OrchestrationCommandReceiptRepository;
      const commandId = CommandId.makeUnsafe("cmd-sidebar-layout-receipt");

      // When: the receipt is stored and read through SQLite.
      yield* receipts.upsert({
        commandId,
        aggregateKind: "sidebar-layout",
        aggregateId: SIDEBAR_LAYOUT_ID,
        acceptedAt: "2026-07-18T00:00:00.000Z",
        resultSequence: 41,
        status: "accepted",
        error: null,
      });
      const persisted = yield* receipts.getByCommandId({ commandId });

      // Then: the singleton aggregate identity survives typed decoding.
      assert.strictEqual(Option.getOrNull(persisted)?.aggregateId, SIDEBAR_LAYOUT_ID);
      assert.strictEqual(Option.getOrNull(persisted)?.aggregateKind, "sidebar-layout");
    }),
  );
});
