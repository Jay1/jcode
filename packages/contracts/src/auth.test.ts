import { assert, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import {
  AuthAccessStreamEvent,
  AuthBootstrapResult,
  AuthClientSession,
  AuthHttpRoutes,
} from "./auth";

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

it.effect("decodes auth client session timestamps from JSON strings", () =>
  Effect.gen(function* () {
    const parsed = yield* decode(AuthClientSession, {
      sessionId: "session_123",
      subject: "owner",
      role: "owner",
      method: "browser-session-cookie",
      client: {
        label: "Chrome on macOS",
        deviceType: "desktop",
      },
      issuedAt: "2026-02-26T12:00:00.000Z",
      expiresAt: "2026-02-27T12:00:00.000Z",
      lastConnectedAt: "2026-02-26T12:30:00.000Z",
      connected: true,
      current: false,
    });

    assert.match(parsed.issuedAt.toString(), /2026-02-26T12:00:00\.000Z/);
    assert.match(parsed.expiresAt.toString(), /2026-02-27T12:00:00\.000Z/);
    assert.match(parsed.lastConnectedAt?.toString() ?? "", /2026-02-26T12:30:00\.000Z/);
  }),
);

it.effect("decodes auth access stream event timestamps from JSON strings", () =>
  Effect.gen(function* () {
    const parsed = yield* decode(AuthAccessStreamEvent, {
      type: "pairingLinkUpserted",
      revision: 1,
      pairingLink: {
        id: "pairing_123",
        credential: "credential_123",
        role: "owner",
        subject: "owner",
        label: "Laptop",
        createdAt: "2026-02-26T11:00:00.000Z",
        expiresAt: "2026-02-26T12:00:00.000Z",
      },
    });

    if (parsed.type !== "pairingLinkUpserted") {
      throw new Error("Expected pairing link upsert event.");
    }
    assert.match(parsed.pairingLink.createdAt.toString(), /2026-02-26T11:00:00\.000Z/);
    assert.match(parsed.pairingLink.expiresAt.toString(), /2026-02-26T12:00:00\.000Z/);
  }),
);

it("exposes shared auth HTTP endpoint metadata", () => {
  assert.deepStrictEqual(
    {
      session: [AuthHttpRoutes.session.method, AuthHttpRoutes.session.pathname],
      bootstrap: [AuthHttpRoutes.bootstrap.method, AuthHttpRoutes.bootstrap.pathname],
      bearer: [AuthHttpRoutes.bootstrapBearer.method, AuthHttpRoutes.bootstrapBearer.pathname],
      wsToken: [AuthHttpRoutes.webSocketToken.method, AuthHttpRoutes.webSocketToken.pathname],
    },
    {
      session: ["GET", "/api/auth/session"],
      bootstrap: ["POST", "/api/auth/bootstrap"],
      bearer: ["POST", "/api/auth/bootstrap/bearer"],
      wsToken: ["POST", "/api/auth/ws-token"],
    },
  );
});
