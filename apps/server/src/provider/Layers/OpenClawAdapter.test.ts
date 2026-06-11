import assert from "node:assert/strict";

import * as NodeServices from "@effect/platform-node/NodeServices";
import { ApprovalRequestId, ThreadId, TurnId } from "@jcode/contracts";
import { Effect, Fiber, Layer, Stream } from "effect";
import { it, vi } from "@effect/vitest";

import {
  ServerSecretStore,
  type ServerSecretStoreShape,
} from "../../auth/Services/ServerSecretStore.ts";
import { ServerSettingsService } from "../../serverSettings.ts";
import type { OpenClawRequest } from "../openclawGatewayProtocol.ts";
import {
  type OpenClawGatewayClient,
  type OpenClawGatewayConnectInput,
  type OpenClawGatewayEvent,
  type OpenClawGatewayRequestResult,
} from "../openclawGatewayClient.ts";
import { OPENCLAW_SECRET_NAMES, deriveOpenClawDeviceId } from "../openclawSecrets.ts";
import { OpenClawAdapter } from "../Services/OpenClawAdapter.ts";
import { makeOpenClawAdapterLive } from "./OpenClawAdapter.ts";

const asThreadId = (value: string): ThreadId => ThreadId.makeUnsafe(value);
const asTurnId = (value: string): TurnId => TurnId.makeUnsafe(value);
const asApprovalRequestId = (value: string): ApprovalRequestId =>
  ApprovalRequestId.makeUnsafe(value);

const textEncoder = new TextEncoder();

class FakeOpenClawGatewayClient implements OpenClawGatewayClient {
  public connectImpl = vi.fn((_input: OpenClawGatewayConnectInput) =>
    Effect.succeed({ methods: ["chat.history", "chat.send", "chat.abort"] }),
  );
  public requestImpl = vi.fn((_request: OpenClawRequest<string, object>) =>
    Effect.succeed({} satisfies OpenClawGatewayRequestResult),
  );

  connect: OpenClawGatewayClient["connect"] = (input) => this.connectImpl(input);
  request: OpenClawGatewayClient["request"] = (request) => this.requestImpl(request);
}

type SecretStoreValue = string | Uint8Array;

function makeSecretStore(values: Record<string, SecretStoreValue>): ServerSecretStoreShape {
  return {
    get: (name) =>
      Effect.succeed(
        values[name] instanceof Uint8Array
          ? values[name]
          : values[name]
            ? textEncoder.encode(values[name])
            : null,
      ),
    set: vi.fn((_name, _value) => Effect.void),
    getOrCreateRandom: vi.fn((_name, bytes) => Effect.succeed(new Uint8Array(bytes))),
    remove: vi.fn((_name) => Effect.void),
  };
}

function makeLayer(input: {
  readonly client: FakeOpenClawGatewayClient;
  readonly secrets?: Record<string, string>;
}) {
  return makeOpenClawAdapterLive({ gatewayClient: input.client }).pipe(
    Layer.provideMerge(
      ServerSettingsService.layerTest({
        providers: {
          openclaw: {
            gatewayUrl: "https://gateway.example.test/path?token=must-not-leak",
            authMode: "token",
            hasSecret: true,
          },
        },
      }),
    ),
    Layer.provideMerge(
      Layer.succeed(
        ServerSecretStore,
        makeSecretStore(input.secrets ?? { [OPENCLAW_SECRET_NAMES.token]: "openclaw-secret" }),
      ),
    ),
    Layer.provideMerge(NodeServices.layer),
  );
}

function collectEvents(count: number) {
  return Effect.gen(function* () {
    const adapter = yield* OpenClawAdapter;
    return yield* adapter.streamEvents.pipe(Stream.take(count), Stream.runCollect);
  });
}

const startOpenClawSession = Effect.gen(function* () {
  const adapter = yield* OpenClawAdapter;
  return yield* adapter.startSession({
    threadId: asThreadId("thread-openclaw"),
    provider: "openclaw",
    runtimeMode: "full-access",
    modelSelection: { provider: "openclaw", model: "gateway" },
  });
});

it.effect(
  "starts a session by resolving settings/secrets, validating methods, and loading history",
  () =>
    Effect.gen(function* () {
      const client = new FakeOpenClawGatewayClient();
      client.requestImpl.mockImplementation((request) =>
        request.method === "chat.history"
          ? Effect.succeed({
              messages: [{ id: "existing-message", role: "assistant", text: "Hi" }],
            })
          : Effect.succeed({}),
      );

      const session = yield* Effect.gen(function* () {
        const adapter = yield* OpenClawAdapter;
        return yield* adapter.startSession({
          threadId: asThreadId("thread-openclaw"),
          provider: "openclaw",
          cwd: "/tmp/project",
          runtimeMode: "full-access",
          modelSelection: { provider: "openclaw", model: "gateway" },
        });
      }).pipe(Effect.provide(makeLayer({ client })));

      assert.equal(session.provider, "openclaw");
      assert.equal(session.status, "ready");
      assert.equal(session.threadId, asThreadId("thread-openclaw"));
      assert.equal(session.model, "gateway");

      assert.equal(
        client.connectImpl.mock.calls[0]?.[0].websocketUrl,
        "wss://gateway.example.test/path",
      );
      assert.deepEqual(client.connectImpl.mock.calls[0]?.[0].auth, {
        type: "token",
        token: "openclaw-secret",
      });
      assert.deepEqual(client.requestImpl.mock.calls[0]?.[0], {
        method: "chat.history",
        params: { sessionKey: "jcode:thread-openclaw" },
      });
    }),
);

it.effect("uses settings gateway URL and ignores browser-supplied OpenClaw provider options", () =>
  Effect.gen(function* () {
    const client = new FakeOpenClawGatewayClient();

    yield* Effect.gen(function* () {
      const adapter = yield* OpenClawAdapter;
      yield* adapter.startSession({
        threadId: asThreadId("thread-openclaw"),
        provider: "openclaw",
        providerOptions: { openclaw: { gatewayUrl: "https://browser.example.test/steal" } },
        runtimeMode: "full-access",
      });
    }).pipe(Effect.provide(makeLayer({ client })));

    assert.equal(
      client.connectImpl.mock.calls[0]?.[0].websocketUrl,
      "wss://gateway.example.test/path",
    );
  }),
);

it.effect("sends stable derived device ids instead of raw binary device keys", () =>
  Effect.gen(function* () {
    const client = new FakeOpenClawGatewayClient();
    const deviceKey = new Uint8Array([1, 2, 3, 4]);

    yield* Effect.gen(function* () {
      const adapter = yield* OpenClawAdapter;
      yield* adapter.startSession({
        threadId: asThreadId("thread-openclaw"),
        provider: "openclaw",
        runtimeMode: "full-access",
      });
    }).pipe(
      Effect.provide(
        makeOpenClawAdapterLive({ gatewayClient: client }).pipe(
          Layer.provideMerge(
            ServerSettingsService.layerTest({
              providers: {
                openclaw: {
                  gatewayUrl: "https://gateway.example.test/path",
                  authMode: "device",
                  paired: true,
                },
              },
            }),
          ),
          Layer.provideMerge(
            Layer.succeed(
              ServerSecretStore,
              makeSecretStore({
                [OPENCLAW_SECRET_NAMES.deviceKey]: deviceKey,
                [OPENCLAW_SECRET_NAMES.deviceToken]: "paired-token",
              }),
            ),
          ),
          Layer.provideMerge(NodeServices.layer),
        ),
      ),
    );

    assert.deepEqual(client.connectImpl.mock.calls[0]?.[0].device, {
      id: deriveOpenClawDeviceId(deviceKey),
      token: "paired-token",
    });
  }),
);

it.effect("rejects gateways missing required chat methods", () =>
  Effect.gen(function* () {
    const client = new FakeOpenClawGatewayClient();
    client.connectImpl.mockImplementation(() => Effect.succeed({ methods: ["chat.history"] }));

    const result = yield* Effect.gen(function* () {
      const adapter = yield* OpenClawAdapter;
      return yield* adapter
        .startSession({
          threadId: asThreadId("thread-openclaw"),
          provider: "openclaw",
          runtimeMode: "full-access",
        })
        .pipe(Effect.result);
    }).pipe(Effect.provide(makeLayer({ client })));

    assert.equal(result._tag, "Failure");
    if (result._tag === "Failure") {
      assert.equal(result.failure._tag, "ProviderAdapterRequestError");
      assert.match(result.failure.message, /chat\.send/);
      assert.match(result.failure.message, /chat\.abort/);
    }
  }),
);

it.effect("sends text turns and emits assistant/completion events from gateway events", () =>
  Effect.gen(function* () {
    const client = new FakeOpenClawGatewayClient();
    const gatewayEvents: ReadonlyArray<OpenClawGatewayEvent> = [
      { type: "assistant.delta", runId: "run-1", text: "Hel" },
      { type: "assistant.delta", runId: "run-1", text: "lo" },
      { type: "assistant.completed", runId: "run-1", text: "Hello" },
      { type: "run.completed", runId: "run-1", stopReason: "end_turn" },
    ];
    client.requestImpl.mockImplementation((request) =>
      request.method === "chat.send"
        ? Effect.succeed({ runId: "run-1", events: gatewayEvents })
        : Effect.succeed({}),
    );

    const { result, events } = yield* Effect.gen(function* () {
      const eventsFiber = yield* collectEvents(5).pipe(Effect.forkChild);
      const adapter = yield* OpenClawAdapter;
      yield* startOpenClawSession;
      client.requestImpl.mockClear();
      const result = yield* adapter.sendTurn({
        threadId: asThreadId("thread-openclaw"),
        input: "Hello OpenClaw",
      });
      const events = Array.from(yield* Fiber.join(eventsFiber));
      return { result, events };
    }).pipe(Effect.provide(makeLayer({ client })));

    assert.equal(result.threadId, asThreadId("thread-openclaw"));
    assert.deepEqual(client.requestImpl.mock.calls[0]?.[0], {
      method: "chat.send",
      params: {
        sessionKey: "jcode:thread-openclaw",
        message: "Hello OpenClaw",
        deliver: false,
        idempotencyKey: `jcode:thread-openclaw:${result.turnId}`,
      },
    });
    assert.deepEqual(
      events.map((event) => event.type),
      ["turn.started", "content.delta", "content.delta", "item.completed", "turn.completed"],
    );
    assert.deepEqual(events[1]?.payload, { streamKind: "assistant_text", delta: "Hel" });
    assert.deepEqual(events[2]?.payload, { streamKind: "assistant_text", delta: "lo" });
    assert.deepEqual(events[3]?.payload, {
      itemType: "assistant_message",
      status: "completed",
      data: { text: "Hello" },
    });
    assert.deepEqual(events[4]?.payload, { state: "completed", stopReason: "end_turn" });
  }),
);

it.effect("emits failed canonical events with redacted gateway raw payloads", () =>
  Effect.gen(function* () {
    const client = new FakeOpenClawGatewayClient();
    client.requestImpl.mockImplementation((request) =>
      request.method === "chat.send"
        ? Effect.succeed({
            runId: "run-2",
            events: [
              {
                type: "error",
                runId: "run-2",
                message: "gateway failed",
                token: "secret-token",
                password: "secret-password",
                nested: { authorization: "Bearer secret" },
              },
            ],
          })
        : Effect.succeed({}),
    );

    const events = yield* Effect.gen(function* () {
      const eventsFiber = yield* collectEvents(3).pipe(Effect.forkChild);
      const adapter = yield* OpenClawAdapter;
      yield* startOpenClawSession;
      yield* adapter.sendTurn({ threadId: asThreadId("thread-openclaw"), input: "fail" });
      return Array.from(yield* Fiber.join(eventsFiber));
    }).pipe(Effect.provide(makeLayer({ client })));

    assert.deepEqual(
      events.map((event) => event.type),
      ["turn.started", "runtime.error", "turn.completed"],
    );
    assert.deepEqual(events[1]?.payload, {
      message: "gateway failed",
      class: "provider_error",
    });
    assert.equal(events[1]?.raw?.source, "openclaw.gateway.event");
    assert.equal(JSON.stringify(events[1]?.raw?.payload).includes("secret"), false);
    assert.deepEqual(events[2]?.payload, { state: "failed", errorMessage: "gateway failed" });
  }),
);

it.effect("aborts active turns and stopped sessions with chat.abort", () =>
  Effect.gen(function* () {
    const client = new FakeOpenClawGatewayClient();
    client.requestImpl.mockImplementation((request) =>
      request.method === "chat.send" ? Effect.succeed({ runId: "run-1" }) : Effect.succeed({}),
    );

    yield* Effect.gen(function* () {
      const adapter = yield* OpenClawAdapter;
      yield* startOpenClawSession;
      client.requestImpl.mockClear();
      const turn = yield* adapter.sendTurn({
        threadId: asThreadId("thread-openclaw"),
        input: "abort me",
      });
      yield* adapter.interruptTurn(asThreadId("thread-openclaw"), turn.turnId, "provider-thread-1");
      yield* adapter.stopSession(asThreadId("thread-openclaw"));
    }).pipe(Effect.provide(makeLayer({ client })));

    const requests = client.requestImpl.mock.calls.map((call) => call[0]);
    const sendRequest = requests[0];
    assert.ok(sendRequest);
    assert.equal(sendRequest.method, "chat.send");
    assert.ok("sessionKey" in sendRequest.params);
    assert.ok("message" in sendRequest.params);
    assert.ok("deliver" in sendRequest.params);
    assert.ok("idempotencyKey" in sendRequest.params);
    assert.equal(sendRequest.params.sessionKey, "jcode:thread-openclaw");
    assert.equal(sendRequest.params.message, "abort me");
    assert.equal(sendRequest.params.deliver, false);
    assert.match(String(sendRequest.params.idempotencyKey), /^jcode:thread-openclaw:/);
    assert.deepEqual(requests.slice(1), [
      { method: "chat.abort", params: { sessionKey: "jcode:thread-openclaw", runId: "run-1" } },
      { method: "chat.abort", params: { sessionKey: "jcode:thread-openclaw" } },
    ]);
  }),
);

it.effect("fails unsupported approvals and structured user-input clearly", () =>
  Effect.gen(function* () {
    const client = new FakeOpenClawGatewayClient();

    const result = yield* Effect.gen(function* () {
      const adapter = yield* OpenClawAdapter;
      const approval = yield* adapter
        .respondToRequest(asThreadId("thread-openclaw"), asApprovalRequestId("request-1"), "accept")
        .pipe(Effect.result);
      const userInput = yield* adapter
        .respondToUserInput(asThreadId("thread-openclaw"), asApprovalRequestId("request-2"), {})
        .pipe(Effect.result);
      return { approval, userInput };
    }).pipe(Effect.provide(makeLayer({ client })));

    assert.equal(result.approval._tag, "Failure");
    assert.equal(result.userInput._tag, "Failure");
    if (result.approval._tag === "Failure") {
      assert.equal(result.approval.failure._tag, "ProviderAdapterValidationError");
      assert.match(result.approval.failure.message, /does not support approvals/);
    }
    if (result.userInput._tag === "Failure") {
      assert.equal(result.userInput.failure._tag, "ProviderAdapterValidationError");
      assert.match(result.userInput.failure.message, /does not support structured user input/);
    }
  }),
);

it.effect("redacts gateway secrets when the production gateway client cannot connect", () =>
  Effect.gen(function* () {
    const result = yield* Effect.gen(function* () {
      const adapter = yield* OpenClawAdapter;
      return yield* adapter
        .startSession({
          threadId: asThreadId("thread-openclaw"),
          provider: "openclaw",
          runtimeMode: "full-access",
        })
        .pipe(Effect.result);
    }).pipe(
      Effect.provide(
        makeOpenClawAdapterLive().pipe(
          Layer.provideMerge(
            ServerSettingsService.layerTest({
              providers: {
                openclaw: {
                  gatewayUrl: "https://user:pass@gateway.example.test/ws?token=secret",
                },
              },
            }),
          ),
          Layer.provideMerge(Layer.succeed(ServerSecretStore, makeSecretStore({}))),
          Layer.provideMerge(NodeServices.layer),
        ),
      ),
    );

    assert.equal(result._tag, "Failure");
    if (result._tag === "Failure") {
      assert.equal(result.failure._tag, "ProviderAdapterRequestError");
      assert.equal(result.failure.message.includes("secret"), false);
      assert.equal(result.failure.message.includes("pass"), false);
      assert.match(result.failure.message, /gateway\.example\.test/);
    }
  }),
);
