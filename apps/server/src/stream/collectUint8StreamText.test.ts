import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { describe, expect, it } from "vitest";

import { collectUint8StreamText } from "./collectUint8StreamText";

const encoder = new TextEncoder();

describe("collectUint8StreamText", () => {
  it("collects stream chunks into text", async () => {
    const result = await Effect.runPromise(
      collectUint8StreamText({
        stream: Stream.fromIterable([encoder.encode("hello "), encoder.encode("world")]),
      }),
    );

    expect(result).toEqual({ text: "hello world", truncated: false });
  });

  it("truncates by bytes while draining the stream", async () => {
    const result = await Effect.runPromise(
      collectUint8StreamText({
        stream: Stream.fromIterable([encoder.encode("hello"), encoder.encode(" world")]),
        maxBytes: 7,
      }),
    );

    expect(result).toEqual({ text: "hello w", truncated: true });
  });
});
