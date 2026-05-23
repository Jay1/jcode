import { assert, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import { AuthBootstrapResult } from "./auth";

const decode = <S extends Schema.Top>(
  schema: S,
  input: unknown,
): Effect.Effect<Schema.Schema.Type<S>, Schema.SchemaError, never> =>
  Schema.decodeUnknownEffect(schema as never)(input) as Effect.Effect<
    Schema.Schema.Type<S>,
    Schema.SchemaError,
    never
  >;

it.effect("decodes auth timestamp fields from JSON strings", () =>
  Effect.gen(function* () {
    const parsed = yield* decode(AuthBootstrapResult, {
      authenticated: true,
      role: "owner",
      sessionMethod: "browser-session-cookie",
      expiresAt: "2026-02-26T12:00:00.000Z",
    });

    assert.match(parsed.expiresAt.toString(), /2026-02-26T12:00:00\.000Z/);
  }),
);
