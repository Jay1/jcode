// Integration test for the production /api/local-image Effect-based route.
// Boots the same `localImageEffectRouteLayer` that `makeEffectHttpRouteLayer` wires
// into `effectServer.ts` and exercises it through a real HTTP listener.
import http from "node:http";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { DateTime, Effect, Exit, Layer, Scope, Stream } from "effect";
import { HttpRouter } from "effect/unstable/http";
import { afterEach, describe, expect, it } from "vitest";

import { ServerAuth, type ServerAuthShape } from "./auth/Services/ServerAuth";
import {
  SessionCredentialService,
  type SessionCredentialServiceShape,
} from "./auth/Services/SessionCredentialService";
import { ServerConfig, type ServerConfigShape } from "./config";
import { attachmentsEffectRouteLayer, authEffectRouteLayer, localImageEffectRouteLayer } from "./http";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function makeServerConfig(overrides: Partial<ServerConfigShape> = {}): ServerConfigShape {
  const baseDir = makeTempDir("jcode-effect-route-");
  const stateDir = path.join(baseDir, "userdata");
  const logsDir = path.join(stateDir, "logs");
  const providerLogsDir = path.join(logsDir, "provider");
  return {
    mode: "web",
    port: 0,
    host: undefined,
    cwd: baseDir,
    homeDir: os.homedir(),
    baseDir,
    stateDir,
    secretsDir: path.join(stateDir, "secrets"),
    dbPath: path.join(stateDir, "state.sqlite"),
    settingsPath: path.join(stateDir, "settings.json"),
    keybindingsConfigPath: path.join(baseDir, "keybindings.json"),
    worktreesDir: path.join(baseDir, "worktrees"),
    attachmentsDir: path.join(stateDir, "attachments"),
    logsDir,
    serverLogPath: path.join(logsDir, "server.log"),
    serverRuntimeStatePath: path.join(baseDir, "runtime.json"),
    providerLogsDir,
    providerEventLogPath: path.join(providerLogsDir, "events.log"),
    terminalLogsDir: path.join(logsDir, "terminals"),
    anonymousIdPath: path.join(stateDir, "anonymous-id"),
    environmentIdPath: path.join(stateDir, "environment-id"),
    staticDir: undefined,
    devUrl: undefined,
    noBrowser: true,
    authToken: undefined,
    devAutomationAccess: false,
    autoBootstrapProjectFromCwd: false,
    logProviderEvents: false,
    logWebSocketEvents: false,
    ...overrides,
  };
}

function makeFakeServerAuth(): ServerAuthShape {
  const expiresAt = Effect.runSync(DateTime.now);
  const descriptor = {
    policy: "loopback-browser" as const,
    bootstrapMethods: ["one-time-token" as const],
    sessionMethods: ["browser-session-cookie" as const, "bearer-session-token" as const],
    sessionCookieName: "t3_session",
  };
  const session = {
    sessionId: "session-id" as never,
    subject: "owner",
    method: "browser-session-cookie" as const,
    role: "owner" as const,
    expiresAt,
  };
  return {
    getDescriptor: () => Effect.succeed(descriptor),
    getSessionState: () => Effect.succeed({ authenticated: false, auth: descriptor }),
    exchangeBootstrapCredential: () =>
      Effect.succeed({
        response: {
          authenticated: true,
          role: "client" as const,
          sessionMethod: "browser-session-cookie" as const,
          expiresAt,
        },
        sessionToken: "session-token",
      }),
    exchangeBootstrapCredentialForBearerSession: () =>
      Effect.succeed({
        authenticated: true,
        role: "client" as const,
        sessionMethod: "bearer-session-token" as const,
        expiresAt,
        sessionToken: "bearer-session-token",
      }),
    issueDevAutomationSession: () =>
      Effect.succeed({
        response: {
          authenticated: true,
          role: "owner" as const,
          sessionMethod: "browser-session-cookie" as const,
          expiresAt,
        },
        sessionToken: "automation-session-token",
      }),
    issuePairingCredential: () =>
      Effect.succeed({ id: "pairing-id", credential: "PAIRINGTOKEN", expiresAt }),
    listPairingLinks: () => Effect.succeed([]),
    revokePairingLink: () => Effect.succeed(true),
    listClientSessions: () => Effect.succeed([]),
    revokeClientSession: () => Effect.succeed(true),
    revokeOtherClientSessions: () => Effect.succeed(1),
    authenticateHttpRequest: () => Effect.succeed(session),
    authenticateWebSocketUpgrade: () => Effect.succeed(session),
    issueWebSocketToken: () => Effect.succeed({ token: "ws-token", expiresAt }),
    issueStartupPairingUrl: () => Effect.succeed("http://127.0.0.1:3773/pair#token=PAIRINGTOKEN"),
  } satisfies ServerAuthShape;
}

function makeFakeSessionCredentials(): SessionCredentialServiceShape {
  const expiresAt = Effect.runSync(DateTime.now);
  const verifiedSession = {
    sessionId: "session-id" as never,
    token: "automation-session-token",
    method: "browser-session-cookie" as const,
    client: { label: "Dev automation", deviceType: "desktop" as const },
    expiresAt,
    subject: "dev-automation",
    role: "owner" as const,
  };

  return {
    cookieName: "t3_session",
    issue: () => Effect.succeed({ ...verifiedSession, token: "automation-session-token" }),
    verify: () => Effect.succeed(verifiedSession),
    issueWebSocketToken: () => Effect.succeed({ token: "ws-token", expiresAt }),
    verifyWebSocketToken: () => Effect.succeed(verifiedSession),
    listActive: () => Effect.succeed([]),
    streamChanges: Stream.empty,
    revoke: () => Effect.succeed(true),
    revokeAllExcept: () => Effect.succeed(0),
    markConnected: () => Effect.void,
    markDisconnected: () => Effect.void,
  };
}

async function withEffectServer(
  config: ServerConfigShape,
  routeLayer: typeof localImageEffectRouteLayer | typeof attachmentsEffectRouteLayer,
  run: (origin: string) => Promise<void>,
): Promise<void> {
  const scope = await Effect.runPromise(Scope.make("sequential"));
  let nodeServer: http.Server | null = null;
  try {
    await Effect.runPromise(
      Scope.provide(
        Effect.gen(function* () {
          const httpServer = yield* NodeHttpServer.make(
            () => {
              nodeServer = http.createServer();
              return nodeServer;
            },
            { port: 0, host: "127.0.0.1" },
          );
          const httpApp = yield* HttpRouter.toHttpEffect(routeLayer);
          yield* httpServer.serve(httpApp);
        }).pipe(
          Effect.provide(
            Layer.mergeAll(
              Layer.succeed(ServerConfig, config),
              Layer.succeed(ServerAuth, makeFakeServerAuth()),
              Layer.succeed(SessionCredentialService, makeFakeSessionCredentials()),
              NodeServices.layer,
            ),
          ),
        ),
        scope,
      ),
    );
    const address = (nodeServer as http.Server | null)?.address();
    if (!address || typeof address !== "object") {
      throw new Error("Expected effect server to expose an address");
    }
    const origin = `http://127.0.0.1:${address.port}`;
    await run(origin);
  } finally {
    await Effect.runPromise(Scope.close(scope, Exit.void));
  }
}

async function withAuthEffectServer(
  config: ServerConfigShape,
  run: (origin: string) => Promise<void>,
): Promise<void> {
  const scope = await Effect.runPromise(Scope.make("sequential"));
  let nodeServer: http.Server | null = null;
  try {
    await Effect.runPromise(
      Scope.provide(
        Effect.gen(function* () {
          const httpServer = yield* NodeHttpServer.make(
            () => {
              nodeServer = http.createServer();
              return nodeServer;
            },
            { port: 0, host: "127.0.0.1" },
          );
          const httpApp = yield* HttpRouter.toHttpEffect(authEffectRouteLayer);
          yield* httpServer.serve(httpApp);
        }).pipe(
          Effect.provide(
            Layer.mergeAll(
              Layer.succeed(ServerConfig, config),
              Layer.succeed(ServerAuth, makeFakeServerAuth()),
              Layer.succeed(SessionCredentialService, makeFakeSessionCredentials()),
              NodeServices.layer,
            ),
          ),
        ),
        scope,
      ),
    );
    const address = (nodeServer as http.Server | null)?.address();
    if (!address || typeof address !== "object") {
      throw new Error("Expected effect server to expose an address");
    }
    const origin = `http://127.0.0.1:${address.port}`;
    await run(origin);
  } finally {
    await Effect.runPromise(Scope.close(scope, Exit.void));
  }
}

describe("localImageEffectRouteLayer", () => {
  it("grants dev automation sessions through the production Effect auth route", async () => {
    const config = makeServerConfig({ host: "127.0.0.1", devAutomationAccess: true });

    await withAuthEffectServer(config, async (origin) => {
      const response = await fetch(`${origin}/api/auth/automation-access-grant`, {
        method: "POST",
        headers: { Origin: origin },
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("set-cookie")).toContain(
        "t3_session=automation-session-token",
      );
      await expect(response.json()).resolves.toMatchObject({
        authenticated: true,
        role: "owner",
        sessionMethod: "browser-session-cookie",
      });

      const badOriginResponse = await fetch(`${origin}/api/auth/automation-access-grant`, {
        method: "POST",
        headers: { Origin: "http://evil.test" },
      });
      expect(badOriginResponse.status).toBe(403);
      expect(badOriginResponse.headers.get("set-cookie")).toBeNull();
    });
  });

  it("serves an allowlisted workspace image and signals downloads via Content-Disposition", async () => {
    const workspace = makeTempDir("jcode-effect-image-workspace-");
    writeFileSync(path.join(workspace, ".git"), "gitdir: .git");
    const imagePath = path.join(workspace, "hero.png");
    writeFileSync(imagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const config = makeServerConfig({ cwd: workspace });

    await withEffectServer(config, localImageEffectRouteLayer, async (origin) => {
      const params = new URLSearchParams({ path: imagePath, cwd: workspace });
      const previewResponse = await fetch(`${origin}/api/local-image?${params}`);
      expect(previewResponse.status).toBe(200);
      expect(previewResponse.headers.get("content-type")).toContain("image/png");
      expect(previewResponse.headers.get("content-disposition")).toBeNull();

      params.set("download", "1");
      const downloadResponse = await fetch(`${origin}/api/local-image?${params}`);
      expect(downloadResponse.status).toBe(200);
      expect(downloadResponse.headers.get("content-disposition")).toContain("hero.png");
    });
  });

  it("returns 404 when the requested path has an unsupported extension", async () => {
    const workspace = makeTempDir("jcode-effect-image-bad-ext-");
    writeFileSync(path.join(workspace, ".git"), "gitdir: .git");
    const docPath = path.join(workspace, "notes.txt");
    writeFileSync(docPath, "hello");
    const config = makeServerConfig({ cwd: workspace });

    await withEffectServer(config, localImageEffectRouteLayer, async (origin) => {
      const params = new URLSearchParams({ path: docPath, cwd: workspace });
      const response = await fetch(`${origin}/api/local-image?${params}`);
      expect(response.status).toBe(404);
    });
  });

  it("returns 404 for missing files", async () => {
    const workspace = makeTempDir("jcode-effect-image-missing-");
    writeFileSync(path.join(workspace, ".git"), "gitdir: .git");
    const ghostPath = path.join(workspace, "does-not-exist.png");
    const config = makeServerConfig({ cwd: workspace });

    await withEffectServer(config, localImageEffectRouteLayer, async (origin) => {
      const params = new URLSearchParams({ path: ghostPath, cwd: workspace });
      const response = await fetch(`${origin}/api/local-image?${params}`);
      expect(response.status).toBe(404);
    });
  });
});

describe("attachmentsEffectRouteLayer", () => {
  it("serves persisted image attachments by id without the file response helper", async () => {
    const config = makeServerConfig({ authToken: "desktop-secret" });
    mkdirSync(config.attachmentsDir, { recursive: true });
    writeFileSync(
      path.join(config.attachmentsDir, "thread-1-6ec544e7-9130-4a8b-993d-9635297d04d3.png"),
      Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    );

    await withEffectServer(config, attachmentsEffectRouteLayer, async (origin) => {
      const response = await fetch(
        `${origin}/attachments/thread-1-6ec544e7-9130-4a8b-993d-9635297d04d3?token=desktop-secret`,
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("image/png");
      expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
      await expect(response.arrayBuffer()).resolves.toHaveProperty("byteLength", 4);
    });
  });
});
