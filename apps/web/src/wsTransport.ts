import {
  ORCHESTRATION_WS_CHANNELS,
  ORCHESTRATION_WS_METHODS,
  WS_CHANNELS,
  WS_METHODS,
  WsRpcGroup,
  type AuthAccessStreamEvent,
  type GitActionProgressEvent,
  type GitRunStackedActionResult,
  type OrchestrationEvent,
  type OrchestrationShellStreamItem,
  type OrchestrationThreadStreamItem,
  type ServerConfigStreamEvent,
  type ServerLifecycleStreamEvent,
  type ServerProviderStatusesUpdatedPayload,
  type ServerSettingsUpdatedPayload,
  type TerminalEvent,
  type WsPush,
  type WsPushChannel,
  type WsPushMessage,
} from "@jcode/contracts";
import { Cause, Data, Effect, Exit, Layer, ManagedRuntime, Scope, Stream } from "effect";
import { RpcClient, RpcSerialization } from "effect/unstable/rpc";
import * as Socket from "effect/unstable/socket/Socket";

type PushListener<C extends WsPushChannel> = (message: WsPushMessage<C>) => void;

type RpcClientEffect = typeof makeRpcClient;
type RpcClientInstance =
  RpcClientEffect extends Effect.Effect<infer Client, any, any> ? Client : never;

type TransportState = "connecting" | "open" | "closed" | "disposed";
type WsUrlResolver = () => Promise<string | null> | string | null;
type WsRequestOptions = { readonly timeoutMs?: number | null };

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

export interface WsTransportTestDriver {
  readonly request?: (method: string, params: unknown) => Promise<unknown> | unknown;
  readonly subscribeChannel?: (
    channel: WsPushChannel,
    emit: (data: unknown) => void,
  ) => (() => void) | void;
  readonly subscribeShell?: (
    emit: (event: OrchestrationShellStreamItem) => void,
  ) => (() => void) | void;
  readonly subscribeThread?: (
    input: unknown,
    emit: (event: OrchestrationThreadStreamItem) => void,
  ) => (() => void) | void;
}

declare global {
  interface Window {
    __T3_WS_TRANSPORT_TEST_DRIVER__?: WsTransportTestDriver;
  }
}

class WsTransportRpcError extends Data.TaggedError("WsTransportRpcError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

const makeRpcClient = RpcClient.make(WsRpcGroup);

function resolveRpcUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  url.pathname = "/ws";
  return url.toString();
}

function makeSocketUrl(explicitUrl: string | null): string {
  if (explicitUrl) return resolveRpcUrl(explicitUrl);
  const bridgeUrl = window.desktopBridge?.getWsUrl();
  const envUrl = import.meta.env.VITE_WS_URL as string | undefined;
  const rawUrl =
    bridgeUrl && bridgeUrl.length > 0
      ? bridgeUrl
      : envUrl && envUrl.length > 0
        ? envUrl
        : `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.hostname}:${window.location.port}`;
  return resolveRpcUrl(rawUrl);
}

function makeProtocolLayer(url: string) {
  const socketLayer = Socket.layerWebSocket(url).pipe(
    Layer.provide(Socket.layerWebSocketConstructorGlobal),
  );
  return RpcClient.layerProtocolSocket().pipe(
    Layer.provide(Layer.mergeAll(socketLayer, RpcSerialization.layerJson)),
  );
}

function causeToError(cause: Cause.Cause<unknown>): Error {
  const error = Cause.squash(cause);
  return error instanceof Error ? error : new Error(String(error));
}

function omitNullUserInputAnswers(input: unknown): unknown {
  if (!input || typeof input !== "object") {
    return input;
  }
  const command = input as { type?: unknown; answers?: unknown };
  if (command.type !== "thread.user-input.respond" || !command.answers) {
    return input;
  }
  if (typeof command.answers !== "object") {
    return input;
  }
  return {
    ...command,
    answers: Object.fromEntries(
      Object.entries(command.answers).filter(
        ([, answer]) => answer !== null && answer !== undefined,
      ),
    ),
  };
}

function resolveRequestTimeoutMs(options?: WsRequestOptions): number | null {
  return options?.timeoutMs === null ? null : (options?.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS);
}

async function withRequestTimeout<T>(
  method: string,
  options: WsRequestOptions | undefined,
  request: () => Promise<T>,
): Promise<T> {
  const timeoutMs = resolveRequestTimeoutMs(options);
  if (timeoutMs === null) {
    return await request();
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`WebSocket request ${method} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([request(), timeout]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

export function isServerLifecyclePushChannel(channel: string): boolean {
  return channel === WS_CHANNELS.serverWelcome || channel === WS_CHANNELS.serverMaintenanceUpdated;
}

export function shouldKeepServerLifecycleStream(activeChannels: ReadonlySet<string>): boolean {
  return (
    activeChannels.has(WS_CHANNELS.serverWelcome) ||
    activeChannels.has(WS_CHANNELS.serverMaintenanceUpdated)
  );
}

export class WsTransport {
  private readonly explicitUrl: string | null;
  private readonly urlResolver: WsUrlResolver | null;
  private readonly testDriver: WsTransportTestDriver | null;
  private readonly listeners = new Map<string, Set<(message: WsPush) => void>>();
  private readonly latestPushByChannel = new Map<string, WsPush>();
  private sequence = 0;
  private state: TransportState = "connecting";
  private disposed = false;
  private runtime: ManagedRuntime.ManagedRuntime<RpcClient.Protocol, never> | null;
  private clientScope: Scope.Closeable | null;
  private clientPromise: Promise<RpcClientInstance> | null;
  private reconnectPromise: Promise<RpcClientInstance> | null = null;
  private reconnectFailures = 0;
  private readonly streamCleanups = new Map<string, () => void>();
  private readonly stoppingStreams = new Set<string>();
  private shellSubscribed = false;
  private readonly threadSubscriptions = new Map<string, unknown>();

  constructor(url?: string | WsUrlResolver) {
    this.explicitUrl = typeof url === "string" ? url : null;
    this.urlResolver = typeof url === "function" ? url : null;
    this.testDriver =
      typeof window !== "undefined" ? (window.__T3_WS_TRANSPORT_TEST_DRIVER__ ?? null) : null;
    if (this.testDriver) {
      this.state = "open";
      this.runtime = null;
      this.clientScope = null;
      this.clientPromise = null;
    } else {
      const session = this.createSession();
      this.runtime = session.runtime;
      this.clientScope = session.clientScope;
      this.clientPromise = session.clientPromise;
    }
  }

  async request<T = unknown>(
    method: string,
    params?: unknown,
    options?: WsRequestOptions,
  ): Promise<T> {
    if (this.disposed) throw new Error("Transport disposed");

    if (this.testDriver) {
      if (method === ORCHESTRATION_WS_METHODS.subscribeShell) {
        this.shellSubscribed = true;
        this.startTestShellStream();
        return undefined as T;
      }
      if (method === ORCHESTRATION_WS_METHODS.unsubscribeShell) {
        this.shellSubscribed = false;
        this.stopStream("orchestration.shell");
        return undefined as T;
      }
      if (method === ORCHESTRATION_WS_METHODS.subscribeThread) {
        const threadId = (params as { threadId: string }).threadId;
        this.threadSubscriptions.set(threadId, params);
        this.startTestThreadStream(threadId, params);
        return undefined as T;
      }
      if (method === ORCHESTRATION_WS_METHODS.unsubscribeThread) {
        const threadId = (params as { threadId: string }).threadId;
        this.threadSubscriptions.delete(threadId);
        this.stopStream(`orchestration.thread:${threadId}`);
        return undefined as T;
      }
      return await withRequestTimeout(
        method,
        options,
        async () => (await this.testDriver?.request?.(method, params ?? {})) as T,
      );
    }

    if (method === WS_METHODS.gitRunStackedAction) {
      return await withRequestTimeout(method, options, async () => {
        const client = await this.getClient();
        return (await this.runGitActionStream(client, params)) as T;
      });
    }

    if (method === ORCHESTRATION_WS_METHODS.subscribeShell) {
      const client = await this.getClient();
      this.shellSubscribed = true;
      this.startShellStream(client);
      return undefined as T;
    }
    if (method === ORCHESTRATION_WS_METHODS.unsubscribeShell) {
      this.shellSubscribed = false;
      this.stopStream("orchestration.shell");
      return undefined as T;
    }
    if (method === ORCHESTRATION_WS_METHODS.subscribeThread) {
      const client = await this.getClient();
      const threadId = (params as { threadId: string }).threadId;
      this.threadSubscriptions.set(threadId, params);
      this.startThreadStream(client, threadId, params as never);
      return undefined as T;
    }
    if (method === ORCHESTRATION_WS_METHODS.unsubscribeThread) {
      const threadId = (params as { threadId: string }).threadId;
      this.threadSubscriptions.delete(threadId);
      this.stopStream(`orchestration.thread:${threadId}`);
      return undefined as T;
    }

    return await withRequestTimeout(method, options, async () => {
      const client = await this.getClient();
      const runtime = this.runtime;
      if (!runtime) throw new WsTransportRpcError({ message: "WebSocket RPC runtime unavailable" });

      const rpcInput =
        method === ORCHESTRATION_WS_METHODS.dispatchCommand
          ? (params as { command: unknown }).command
          : (params ?? {});
      const normalizedRpcInput = omitNullUserInputAnswers(rpcInput);
      const call = (
        client as unknown as Record<
          string,
          (input: unknown) => Effect.Effect<unknown, WsTransportRpcError, never>
        >
      )[method];
      if (!call) throw new WsTransportRpcError({ message: `Unknown RPC method: ${method}` });
      return (await runtime.runPromise(call(normalizedRpcInput))) as T;
    });
  }

  subscribe<C extends WsPushChannel>(
    channel: C,
    listener: PushListener<C>,
    options?: { readonly replayLatest?: boolean },
  ): () => void {
    let channelListeners = this.listeners.get(channel);
    if (!channelListeners) {
      channelListeners = new Set<(message: WsPush) => void>();
      this.listeners.set(channel, channelListeners);
      if (this.testDriver) {
        this.startTestChannelStream(channel);
      } else {
        this.startChannelStream(channel);
      }
    }

    const wrappedListener = (message: WsPush) => listener(message as WsPushMessage<C>);
    channelListeners.add(wrappedListener);

    if (options?.replayLatest) {
      const latest = this.latestPushByChannel.get(channel);
      if (latest) wrappedListener(latest);
    }

    return () => {
      channelListeners?.delete(wrappedListener);
      if (channelListeners?.size === 0) {
        this.listeners.delete(channel);
        this.stopChannelStream(channel);
      }
    };
  }

  getLatestPush<C extends WsPushChannel>(channel: C): WsPushMessage<C> | null {
    const latest = this.latestPushByChannel.get(channel);
    return latest ? (latest as WsPushMessage<C>) : null;
  }

  getState(): TransportState {
    return this.state;
  }

  dispose() {
    this.disposed = true;
    this.state = "disposed";
    for (const cleanup of this.streamCleanups.values()) cleanup();
    this.streamCleanups.clear();
    if (this.runtime && this.clientScope) {
      const runtime = this.runtime;
      void runtime.runPromise(Scope.close(this.clientScope, Exit.void)).finally(() => {
        runtime.dispose();
      });
    }
  }

  private createSession() {
    if (this.urlResolver) {
      const clientPromise = Promise.resolve()
        .then(async () => {
          const resolvedUrl = await this.urlResolver?.();
          if (this.disposed) throw new Error("Transport disposed");

          const runtime = ManagedRuntime.make(
            makeProtocolLayer(makeSocketUrl(resolvedUrl ?? this.explicitUrl)),
          );
          const clientScope = runtime.runSync(Scope.make());
          this.runtime = runtime;
          this.clientScope = clientScope;
          return runtime.runPromise(Scope.provide(clientScope)(makeRpcClient));
        })
        .then((client) => {
          this.state = "open";
          return client;
        })
        .catch((error) => {
          if (!this.disposed) this.state = "closed";
          throw error;
        });
      return { runtime: null, clientScope: null, clientPromise };
    }

    const runtime = ManagedRuntime.make(makeProtocolLayer(makeSocketUrl(this.explicitUrl)));
    const clientScope = runtime.runSync(Scope.make());
    const clientPromise = runtime
      .runPromise(Scope.provide(clientScope)(makeRpcClient))
      .then((client) => {
        this.state = "open";
        return client;
      })
      .catch((error) => {
        if (!this.disposed) this.state = "closed";
        throw error;
      });
    return { runtime, clientScope, clientPromise };
  }

  private async getClient(): Promise<RpcClientInstance> {
    if (!this.clientPromise) {
      throw new Error("Transport client unavailable");
    }
    try {
      return await this.clientPromise;
    } catch {
      if (this.disposed) throw new Error("Transport disposed");
      return this.reconnect();
    }
  }

  private reconnect(): Promise<RpcClientInstance> {
    if (this.reconnectPromise) return this.reconnectPromise;
    if ((this.runtime && !this.clientScope) || (!this.runtime && this.clientScope)) {
      return Promise.reject(new Error("Transport client unavailable"));
    }

    const oldRuntime = this.runtime;
    const oldClientScope = this.clientScope;
    for (const cleanup of this.streamCleanups.values()) cleanup();
    this.streamCleanups.clear();
    this.stoppingStreams.clear();

    this.state = "connecting";

    if (oldRuntime && oldClientScope) {
      void oldRuntime.runPromise(Scope.close(oldClientScope, Exit.void)).finally(() => {
        oldRuntime.dispose();
      });
    }

    this.reconnectPromise = this.openReconnectSession().finally(() => {
      this.reconnectPromise = null;
    });
    return this.reconnectPromise;
  }

  private async openReconnectSession(): Promise<RpcClientInstance> {
    const delayMs = Math.min(500 * 2 ** this.reconnectFailures, 5_000);
    this.reconnectFailures += 1;
    await new Promise((resolve) => window.setTimeout(resolve, delayMs));

    const session = this.createSession();
    this.runtime = session.runtime;
    this.clientScope = session.clientScope;
    this.clientPromise = session.clientPromise;

    const client = await session.clientPromise;
    this.reconnectFailures = 0;
    for (const channel of this.listeners.keys()) {
      this.startChannelStream(channel as WsPushChannel);
    }
    if (this.shellSubscribed) {
      this.startShellStream(client);
    }
    for (const [threadId, input] of this.threadSubscriptions) {
      this.startThreadStream(client, threadId, input);
    }
    return client;
  }

  private emit<C extends WsPushChannel>(channel: C, data: WsPushMessage<C>["data"]): void {
    const message = {
      type: "push" as const,
      sequence: ++this.sequence,
      channel,
      data,
    } as WsPush;
    this.latestPushByChannel.set(channel, message);
    const listeners = this.listeners.get(channel);
    if (!listeners) return;
    for (const listener of listeners) {
      try {
        listener(message);
      } catch {
        // Listener errors must not break transport streams.
      }
    }
  }

  private startChannelStream(channel: WsPushChannel): void {
    void this.getClient()
      .then((client) => {
        const restartChannel = () => {
          if (this.listeners.has(channel)) {
            this.startChannelStream(channel);
          }
        };

        if (isServerLifecyclePushChannel(channel)) {
          this.startLifecycleStream(client);
        } else if (channel === WS_CHANNELS.serverConfigUpdated) {
          this.startStream(
            "server.config",
            client[WS_METHODS.subscribeServerConfig]({}),
            (event: ServerConfigStreamEvent) => {
              if (event.type === "snapshot") {
                this.emit(WS_CHANNELS.serverConfigUpdated, {
                  issues: event.config.issues,
                  providers: event.config.providers,
                });
              } else if (event.type === "configUpdated") {
                this.emit(WS_CHANNELS.serverConfigUpdated, event.payload);
              }
            },
            restartChannel,
          );
        } else if (channel === WS_CHANNELS.serverProviderStatusesUpdated) {
          this.startStream(
            "server.providers",
            client[WS_METHODS.subscribeServerProviderStatuses]({}),
            (payload: ServerProviderStatusesUpdatedPayload) =>
              this.emit(WS_CHANNELS.serverProviderStatusesUpdated, payload),
            restartChannel,
          );
        } else if (channel === WS_CHANNELS.serverSettingsUpdated) {
          this.startStream(
            "server.settings",
            client[WS_METHODS.subscribeServerSettings]({}),
            (payload: ServerSettingsUpdatedPayload) =>
              this.emit(WS_CHANNELS.serverSettingsUpdated, payload),
            restartChannel,
          );
        } else if (channel === WS_CHANNELS.authAccess) {
          this.startStream(
            "server.authAccess",
            client[WS_METHODS.subscribeAuthAccess]({}),
            (event: AuthAccessStreamEvent) => this.emit(WS_CHANNELS.authAccess, event),
            restartChannel,
          );
        } else if (channel === WS_CHANNELS.terminalEvent) {
          this.startStream(
            "terminal.events",
            client[WS_METHODS.subscribeTerminalEvents]({}),
            (event: TerminalEvent) => this.emit(WS_CHANNELS.terminalEvent, event),
            restartChannel,
          );
        } else if (channel === ORCHESTRATION_WS_CHANNELS.domainEvent) {
          this.startStream(
            "orchestration.domain",
            client[WS_METHODS.subscribeOrchestrationDomainEvents]({}),
            (event: OrchestrationEvent) => this.emit(ORCHESTRATION_WS_CHANNELS.domainEvent, event),
            restartChannel,
          );
        }
      })
      .catch((error) => {
        if (!this.disposed && this.listeners.has(channel)) {
          console.warn("WebSocket RPC channel failed to start", error);
          window.setTimeout(() => this.startChannelStream(channel), 500);
        }
      });
  }

  private stopChannelStream(channel: WsPushChannel): void {
    if (this.testDriver) {
      this.stopStream(`channel:${channel}`);
      return;
    }
    if (isServerLifecyclePushChannel(channel)) {
      if (!this.shouldKeepLifecycleStream()) this.stopStream("server.lifecycle");
    } else if (channel === WS_CHANNELS.serverConfigUpdated) this.stopStream("server.config");
    else if (channel === WS_CHANNELS.serverProviderStatusesUpdated)
      this.stopStream("server.providers");
    else if (channel === WS_CHANNELS.serverSettingsUpdated) this.stopStream("server.settings");
    else if (channel === WS_CHANNELS.authAccess) this.stopStream("server.authAccess");
    else if (channel === WS_CHANNELS.terminalEvent) this.stopStream("terminal.events");
    else if (channel === ORCHESTRATION_WS_CHANNELS.domainEvent)
      this.stopStream("orchestration.domain");
  }

  private startTestChannelStream(channel: WsPushChannel): void {
    const key = `channel:${channel}`;
    if (this.streamCleanups.has(key)) return;
    const cleanup = this.testDriver?.subscribeChannel?.(channel, (data) => {
      this.emit(channel, data as never);
    });
    this.streamCleanups.set(key, cleanup ?? (() => undefined));
  }

  private startTestShellStream(): void {
    const key = "orchestration.shell";
    this.stopStream(key);
    const cleanup = this.testDriver?.subscribeShell?.((event) => {
      this.emit(ORCHESTRATION_WS_CHANNELS.shellEvent, event);
    });
    this.streamCleanups.set(key, cleanup ?? (() => undefined));
  }

  private startTestThreadStream(threadId: string, input: unknown): void {
    const key = `orchestration.thread:${threadId}`;
    this.stopStream(key);
    const cleanup = this.testDriver?.subscribeThread?.(input, (event) => {
      this.emit(ORCHESTRATION_WS_CHANNELS.threadEvent, event);
    });
    this.streamCleanups.set(key, cleanup ?? (() => undefined));
  }

  private shouldKeepLifecycleStream(): boolean {
    return shouldKeepServerLifecycleStream(new Set(this.listeners.keys()));
  }

  private startLifecycleStream(client: RpcClientInstance): void {
    const restartLifecycle = () => {
      if (!this.shouldKeepLifecycleStream()) return;
      void this.getClient()
        .then((nextClient) => this.startLifecycleStream(nextClient))
        .catch((error) => console.warn("WebSocket RPC lifecycle stream failed to restart", error));
    };
    this.startStream(
      "server.lifecycle",
      client[WS_METHODS.subscribeServerLifecycle]({}),
      (event: ServerLifecycleStreamEvent) => {
        if (event.type === "welcome") {
          this.emit(WS_CHANNELS.serverWelcome, event.payload);
        } else if (event.type === "maintenance") {
          this.emit(WS_CHANNELS.serverMaintenanceUpdated, event);
        }
      },
      restartLifecycle,
    );
  }

  private startShellStream(client: RpcClientInstance): void {
    const restartShell = () => {
      void this.getClient()
        .then((nextClient) => this.startShellStream(nextClient))
        .catch((error) => console.warn("WebSocket RPC shell stream failed to restart", error));
    };
    this.startStream(
      "orchestration.shell",
      client[ORCHESTRATION_WS_METHODS.subscribeShell]({}),
      (event: OrchestrationShellStreamItem) =>
        this.emit(ORCHESTRATION_WS_CHANNELS.shellEvent, event),
      restartShell,
    );
  }

  private startThreadStream(client: RpcClientInstance, threadId: string, input: unknown): void {
    const key = `orchestration.thread:${threadId}`;
    this.stopStream(key);
    this.stoppingStreams.delete(key);
    const restartThread = () => {
      void this.getClient()
        .then((nextClient) => this.startThreadStream(nextClient, threadId, input))
        .catch((error) => console.warn("WebSocket RPC thread stream failed to restart", error));
    };
    this.startStream(
      key,
      client[ORCHESTRATION_WS_METHODS.subscribeThread](input as never),
      (event: OrchestrationThreadStreamItem) =>
        this.emit(ORCHESTRATION_WS_CHANNELS.threadEvent, event),
      restartThread,
    );
  }

  private startStream<T>(
    key: string,
    stream: unknown,
    listener: (event: T) => void,
    restart?: (() => void) | undefined,
  ): void {
    if (this.streamCleanups.has(key)) return;
    const runtime = this.runtime;
    if (!runtime) return;
    const runnableStream = stream as Stream.Stream<T, WsTransportRpcError, never>;
    const cancel = runtime.runCallback(
      Stream.runForEach(runnableStream, (event) => Effect.sync(() => listener(event))),
      {
        onExit: (exit) => {
          if (this.streamCleanups.get(key) === cancel) {
            this.streamCleanups.delete(key);
          }
          const wasStoppedIntentionally = this.stoppingStreams.delete(key);
          if (wasStoppedIntentionally || this.disposed) {
            return;
          }
          if (restart && Exit.isFailure(exit)) {
            window.setTimeout(
              () => {
                if (!this.disposed && !this.streamCleanups.has(key)) {
                  void this.reconnect()
                    .then(() => restart())
                    .catch((error) => console.warn("WebSocket RPC stream reconnect failed", error));
                }
              },
              Cause.hasInterruptsOnly(exit.cause) ? 0 : 500,
            );
            return;
          }
          if (Exit.isFailure(exit) && !this.disposed && !Cause.hasInterruptsOnly(exit.cause)) {
            console.warn("WebSocket RPC stream failed", causeToError(exit.cause));
          }
        },
      },
    );
    this.streamCleanups.set(key, cancel);
  }

  private stopStream(key: string): void {
    const cleanup = this.streamCleanups.get(key);
    if (!cleanup) return;
    this.stoppingStreams.add(key);
    this.streamCleanups.delete(key);
    cleanup();
  }

  private async runGitActionStream(
    client: RpcClientInstance,
    params: unknown,
  ): Promise<GitRunStackedActionResult> {
    let result: GitRunStackedActionResult | null = null;
    const runtime = this.runtime;
    if (!runtime) throw new WsTransportRpcError({ message: "WebSocket RPC runtime unavailable" });
    await runtime.runPromise(
      Stream.runForEach(client[WS_METHODS.gitRunStackedAction](params as never), (event) =>
        Effect.sync(() => {
          this.emit(WS_CHANNELS.gitActionProgress, event as GitActionProgressEvent);
          if ((event as GitActionProgressEvent).kind === "action_finished") {
            result = (event as Extract<GitActionProgressEvent, { kind: "action_finished" }>).result;
          }
        }),
      ),
    );
    if (!result) throw new Error("Git action stream completed without a final result.");
    return result;
  }
}
