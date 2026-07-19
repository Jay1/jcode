import { describe, expect, it } from "vitest";
import { classifyShellStreamEvent } from "./shellEventOrdering";

describe("shell event ordering", () => {
  it("buffers every entity event before the first shell snapshot", () => {
    // Given: no shell snapshot has established an event fence.
    const shellSnapshotSequence = -1;

    // When: an entity upsert arrives.
    const disposition = classifyShellStreamEvent(shellSnapshotSequence, 4);

    // Then: the event is buffered for the snapshot flush instead of routed immediately.
    expect(disposition).toBe("buffer");
  });

  it.each([
    ["stale project remove", 9],
    ["equal project upsert", 10],
    ["stale thread remove", 8],
    ["equal thread upsert", 10],
  ])("ignores %s behind the latest shell event fence", (_caseName, eventSequence) => {
    // Given: a snapshot or newer event established sequence 10.
    const shellSnapshotSequence = 10;

    // When: a lower or equal entity event arrives.
    const disposition = classifyShellStreamEvent(shellSnapshotSequence, eventSequence);

    // Then: it cannot reach either lifecycle routing or the rendered store.
    expect(disposition).toBe("ignore");
  });

  it("applies an event strictly newer than the latest shell event fence", () => {
    // Given: sequence 10 is the latest applied shell item.
    const shellSnapshotSequence = 10;

    // When: sequence 11 arrives.
    const disposition = classifyShellStreamEvent(shellSnapshotSequence, 11);

    // Then: it is routed and advances the fence once.
    expect(disposition).toBe("apply");
  });
});
