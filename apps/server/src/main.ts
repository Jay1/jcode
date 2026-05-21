/**
 * CliConfig - CLI/runtime bootstrap service definitions.
 *
 * Defines startup-only service contracts used while resolving process config
 * and constructing server runtime layers.
 *
 * @module CliConfig
 */
import OS from "node:os";
import { Config, Data, Effect, FileSystem, Layer, Option, Path, Schema, ServiceMap } from "effect";
import { Command, Flag } from "effect/unstable/cli";
import { NetService } from "@t3tools/shared/Net";
import {
  DEFAULT_PORT,
  deriveServerPaths,
  resolveStaticDir,
  ServerConfig,
  type RuntimeMode,
  type ServerConfigShape,
} from "./config";
import { migrateLegacyHomeIfNeeded } from "./homeMigration";
import { fixPath, resolveBaseDir } from "./os-jank";
import { Open } from "./open";
import * as SqlitePersistence from "./persistence/Layers/Sqlite";
import { makeServerProviderLayer, makeServerRuntimeServicesLayer } from "./serverLayers";
import { ProjectionSnapshotQuery } from "./orchestration/Services/ProjectionSnapshotQuery";
import { ProviderHealthLive } from "./provider/Layers/ProviderHealth";
import { ProviderSessionReaperLive } from "./provider/Layers/ProviderSessionReaper";
import { Server } from "./effectServer";
import { ServerLoggerLive } from "./serverLogger";
import { formatHostForUrl, isWildcardHost } from "./startupAccess";
import { AnalyticsServiceLayerLive } from "./telemetry/Layers/AnalyticsService";
import { AnalyticsService } from "./telemetry/Services/AnalyticsService";
import { OrchestrationEngineService } from "./orchestration/Services/OrchestrationEngine";
import { startThreadRetentionJob } from "./threadRetention";

export class StartupError extends Data.TaggedError("StartupError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

interface CliInput {
  readonly mode: Option.Option<RuntimeMode>;
  readonly port: Option.Option<number>;
  readonly host: Option.Option<string>;
  readonly t3Home: Option.Option<string>;
  readonly devUrl: Option.Option<URL>;
  readonly noBrowser: Option.Option<boolean>;
  readonly authToken: Option.Option<string>;
  readonly autoBootstrapProjectFromCwd: Option.Option<boolean>;
  readonly logProviderEvents: Option.Option<boolean>;
  readonly logWebSocketEvents: Option.Option<boolean>;
}

/**
 * CliConfigShape - Startup helpers required while building server layers.
 */
export interface CliConfigShape {
  /**
   * Current process working directory.
   */
  readonly cwd: string;

  /**
   * Apply OS-specific PATH normalization.
   */
  readonly fixPath: Effect.Effect<void>;

  /**
   * Resolve static web asset directory for server mode.
   */
  readonly resolveStaticDir: Effect.Effect<string | undefined>;
}

/**
 * CliConfig - Service tag for startup CLI/runtime helpers.
 */
export class CliConfig extends ServiceMap.Service<CliConfig, CliConfigShape>()(
  "jcode/main/CliConfig",
) {
  static readonly layer = Layer.effect(
    CliConfig,
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      return {
        cwd: process.cwd(),
        fixPath: Effect.sync(fixPath),
        resolveStaticDir: resolveStaticDir().pipe(
          Effect.provideService(FileSystem.FileSystem, fileSystem),
          Effect.provideService(Path.Path, path),
        ),
      } satisfies CliConfigShape;
    }),
  );
}

const firstDefined = <T>(values: ReadonlyArray<T | undefined>): T | undefined =>
  values.find((value): value is T => value !== undefined);

const optionalStringEnvConfig = (...names: ReadonlyArray<string>) =>
  Config.all(
    names.map((name) =>
      Config.string(name).pipe(Config.option, Config.map(Option.getOrUndefined)),
    ),
  ).pipe(Config.map(firstDefined));

const optionalBooleanEnvConfig = (...names: ReadonlyArray<string>) =>
  Config.all(
    names.map((name) =>
      Config.boolean(name).pipe(Config.option, Config.map(Option.getOrUndefined)),
    ),
  ).pipe(Config.map(firstDefined));

const optionalPortEnvConfig = (...names: ReadonlyArray<string>) =>
  Config.all(
    names.map((name) => Config.port(name).pipe(Config.option, Config.map(Option.getOrUndefined))),
  ).pipe(Config.map(firstDefined));

const CliEnvConfig = Config.all({
  mode: optionalStringEnvConfig("JCODE_MODE", "DPCODE_MODE", "T3CODE_MODE").pipe(
    Config.map((value): RuntimeMode => (value === "desktop" ? "desktop" : "web")),
  ),
  port: optionalPortEnvConfig("JCODE_PORT", "DPCODE_PORT", "T3CODE_PORT"),
  host: optionalStringEnvConfig("JCODE_HOST", "DPCODE_HOST", "T3CODE_HOST"),
  t3Home: optionalStringEnvConfig("JCODE_HOME", "DPCODE_HOME", "T3CODE_HOME"),
  devUrl: Config.url("VITE_DEV_SERVER_URL").pipe(Config.option, Config.map(Option.getOrUndefined)),
  noBrowser: optionalBooleanEnvConfig("JCODE_NO_BROWSER", "DPCODE_NO_BROWSER", "T3CODE_NO_BROWSER"),
  authToken: optionalStringEnvConfig("JCODE_AUTH_TOKEN", "DPCODE_AUTH_TOKEN", "T3CODE_AUTH_TOKEN"),
  autoBootstrapProjectFromCwd: optionalBooleanEnvConfig(
    "JCODE_AUTO_BOOTSTRAP_PROJECT_FROM_CWD",
    "DPCODE_AUTO_BOOTSTRAP_PROJECT_FROM_CWD",
    "T3CODE_AUTO_BOOTSTRAP_PROJECT_FROM_CWD",
  ),
  logProviderEvents: optionalBooleanEnvConfig(
    "JCODE_LOG_PROVIDER_EVENTS",
    "DPCODE_LOG_PROVIDER_EVENTS",
    "T3CODE_LOG_PROVIDER_EVENTS",
  ),
  logWebSocketEvents: optionalBooleanEnvConfig(
    "JCODE_LOG_WS_EVENTS",
    "DPCODE_LOG_WS_EVENTS",
    "T3CODE_LOG_WS_EVENTS",
  ),
});

const resolveBooleanFlag = (flag: Option.Option<boolean>, envValue: boolean) =>
  Option.getOrElse(Option.filter(flag, Boolean), () => envValue);

const ServerConfigLive = (input: CliInput) =>
  Layer.effect(
    ServerConfig,
    Effect.gen(function* () {
      const cliConfig = yield* CliConfig;
      const { findAvailablePort } = yield* NetService;
      const env = yield* CliEnvConfig.asEffect().pipe(
        Effect.mapError(
          (cause) =>
            new StartupError({ message: "Failed to read environment configuration", cause }),
        ),
      );

      const mode = Option.getOrElse(input.mode, () => env.mode);

      const port = yield* Option.match(input.port, {
        onSome: (value) => Effect.succeed(value),
        onNone: () => {
          if (env.port) {
            return Effect.succeed(env.port);
          }
          if (mode === "desktop") {
            return Effect.succeed(DEFAULT_PORT);
          }
          return findAvailablePort(DEFAULT_PORT);
        },
      });

      const devUrl = Option.getOrElse(input.devUrl, () => env.devUrl);
      const baseDir = yield* resolveBaseDir(Option.getOrUndefined(input.t3Home) ?? env.t3Home);
      // Import legacy JCode/T3Code state before runtime paths are derived under ~/.jcode.
      yield* migrateLegacyHomeIfNeeded({
        baseDir,
        homeDir: OS.homedir(),
        devUrl,
      }).pipe(
        Effect.mapError(
          (cause) =>
            new StartupError({
              message: "Failed to migrate legacy home directory",
              cause,
            }),
        ),
      );
      const derivedPaths = yield* deriveServerPaths(baseDir, devUrl);
      const noBrowser = resolveBooleanFlag(input.noBrowser, env.noBrowser ?? mode === "desktop");
      const authToken = Option.getOrUndefined(input.authToken) ?? env.authToken;
      const autoBootstrapProjectFromCwd = resolveBooleanFlag(
        input.autoBootstrapProjectFromCwd,
        env.autoBootstrapProjectFromCwd ?? mode === "web",
      );
      // Provider event NDJSON logging is helpful for debugging, but it is too
      // expensive to keep enabled on the streaming hot path by default.
      const logProviderEvents = resolveBooleanFlag(
        input.logProviderEvents,
        env.logProviderEvents ?? false,
      );
      // Keep websocket payload logging opt-in in dev. Terminal/TUI traffic is
      // high-volume enough that automatic logging adds noticeable CPU and I/O.
      const logWebSocketEvents = resolveBooleanFlag(
        input.logWebSocketEvents,
        env.logWebSocketEvents ?? false,
      );
      const staticDir = devUrl ? undefined : yield* cliConfig.resolveStaticDir;
      const host =
        Option.getOrUndefined(input.host) ??
        env.host ??
        (mode === "desktop" ? "127.0.0.1" : undefined);

      const config: ServerConfigShape = {
        mode,
        port,
        cwd: cliConfig.cwd,
        homeDir: OS.homedir(),
        host,
        baseDir,
        ...derivedPaths,
        staticDir,
        devUrl,
        noBrowser,
        authToken,
        autoBootstrapProjectFromCwd,
        logProviderEvents,
        logWebSocketEvents,
      } satisfies ServerConfigShape;

      return config;
    }),
  );

const LayerLive = (input: CliInput) => {
  const runtimeServicesLayer = makeServerRuntimeServicesLayer();
  const providerLayer = makeServerProviderLayer();
  const providerHealthLayer = ProviderHealthLive.pipe(
    // Provider health reads persisted provider settings while constructing its
    // cache, so build it with the same runtime services layer exposed to Server.
    Layer.provideMerge(runtimeServicesLayer),
  );
  const providerSessionReaperLayer = ProviderSessionReaperLive.pipe(
    // The reaper coordinates orchestration state with live provider sessions,
    // so it belongs at the top level where both layers are available.
    Layer.provideMerge(runtimeServicesLayer),
    Layer.provideMerge(providerLayer),
  );

  return Layer.empty.pipe(
    Layer.provideMerge(runtimeServicesLayer),
    Layer.provideMerge(providerLayer),
    Layer.provideMerge(providerHealthLayer),
    Layer.provideMerge(providerSessionReaperLayer),
    Layer.provideMerge(SqlitePersistence.layerConfig),
    Layer.provideMerge(ServerLoggerLive),
    Layer.provideMerge(AnalyticsServiceLayerLive),
    Layer.provideMerge(ServerConfigLive(input)),
  );
};

export const recordStartupHeartbeat = Effect.gen(function* () {
  const analytics = yield* AnalyticsService;
  const projectionSnapshotQuery = yield* ProjectionSnapshotQuery;

  const { threadCount, projectCount } = yield* projectionSnapshotQuery.getCounts().pipe(
    Effect.catch((cause) =>
      Effect.logWarning("failed to gather startup projection counts for telemetry", { cause }).pipe(
        Effect.as({
          threadCount: 0,
          projectCount: 0,
        }),
      ),
    ),
  );

  yield* analytics.record("server.boot.heartbeat", {
    threadCount,
    projectCount,
  });
});

const makeServerProgram = (input: CliInput) =>
  Effect.gen(function* () {
    const cliConfig = yield* CliConfig;
    const { start, stopSignal } = yield* Server;
    const openDeps = yield* Open;
    yield* cliConfig.fixPath;

    const config = yield* ServerConfig;

    if (!config.devUrl && !config.staticDir) {
      yield* Effect.logWarning(
        "web bundle missing and no VITE_DEV_SERVER_URL; web UI unavailable",
        {
          hint: "Run `bun run --cwd apps/web build` or set VITE_DEV_SERVER_URL for dev mode.",
        },
      );
    }

    yield* start;
    const orchestrationEngine = yield* OrchestrationEngineService;
    // Start the retention loop after the server is live so startup can serve
    // existing history first, then prune inactive threads in the background.
    yield* startThreadRetentionJob(orchestrationEngine);
    yield* Effect.forkChild(recordStartupHeartbeat);

    const localUrl = `http://localhost:${config.port}`;
    const bindUrl =
      config.host && !isWildcardHost(config.host)
        ? `http://${formatHostForUrl(config.host)}:${config.port}`
        : localUrl;
    const { authToken, devUrl, ...safeConfig } = config;
    yield* Effect.logInfo("JCode running", {
      ...safeConfig,
      devUrl: devUrl?.toString(),
      authEnabled: Boolean(authToken),
    });

    if (!config.noBrowser) {
      const target = config.devUrl?.toString() ?? bindUrl;
      yield* openDeps.openBrowser(target).pipe(
        Effect.catch(() =>
          Effect.logInfo("browser auto-open unavailable", {
            hint: `Open ${target} in your browser.`,
          }),
        ),
      );
    }

    return yield* stopSignal;
  }).pipe(Effect.provide(LayerLive(input)));

/**
 * These flags mirrors the environment variables and the config shape.
 */

const modeFlag = Flag.choice("mode", ["web", "desktop"]).pipe(
  Flag.withDescription("Runtime mode. `desktop` keeps loopback defaults unless overridden."),
  Flag.optional,
);
const portFlag = Flag.integer("port").pipe(
  Flag.withSchema(Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 65535 }))),
  Flag.withDescription("Port for the HTTP/WebSocket server."),
  Flag.optional,
);
const hostFlag = Flag.string("host").pipe(
  Flag.withDescription("Host/interface to bind (for example 127.0.0.1, 0.0.0.0, or a Tailnet IP)."),
  Flag.optional,
);
const t3HomeFlag = Flag.string("home-dir").pipe(
  Flag.withDescription("Base directory for all JCode data (equivalent to JCODE_HOME)."),
  Flag.optional,
);
const devUrlFlag = Flag.string("dev-url").pipe(
  Flag.withSchema(Schema.URLFromString),
  Flag.withDescription("Dev web URL to proxy/redirect to (equivalent to VITE_DEV_SERVER_URL)."),
  Flag.optional,
);
const noBrowserFlag = Flag.boolean("no-browser").pipe(
  Flag.withDescription("Disable automatic browser opening."),
  Flag.optional,
);
const authTokenFlag = Flag.string("auth-token").pipe(
  Flag.withDescription("Auth token required for WebSocket connections."),
  Flag.withAlias("token"),
  Flag.optional,
);
const autoBootstrapProjectFromCwdFlag = Flag.boolean("auto-bootstrap-project-from-cwd").pipe(
  Flag.withDescription(
    "Create a project for the current working directory on startup when missing.",
  ),
  Flag.optional,
);
const logProviderEventsFlag = Flag.boolean("log-provider-events").pipe(
  Flag.withDescription(
    "Emit native/canonical provider NDJSON logs for debugging (equivalent to JCODE_LOG_PROVIDER_EVENTS).",
  ),
  Flag.optional,
);
const logWebSocketEventsFlag = Flag.boolean("log-websocket-events").pipe(
  Flag.withDescription(
    "Emit server-side logs for outbound WebSocket push traffic (equivalent to JCODE_LOG_WS_EVENTS).",
  ),
  Flag.withAlias("log-ws-events"),
  Flag.optional,
);

export const jcodeCli = Command.make("jcode", {
  mode: modeFlag,
  port: portFlag,
  host: hostFlag,
  t3Home: t3HomeFlag,
  devUrl: devUrlFlag,
  noBrowser: noBrowserFlag,
  authToken: authTokenFlag,
  autoBootstrapProjectFromCwd: autoBootstrapProjectFromCwdFlag,
  logProviderEvents: logProviderEventsFlag,
  logWebSocketEvents: logWebSocketEventsFlag,
}).pipe(
  Command.withDescription("Run the JCode server."),
  Command.withHandler((input) => Effect.scoped(makeServerProgram(input))),
);

export const t3Cli = jcodeCli;
