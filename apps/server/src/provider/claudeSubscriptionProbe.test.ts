import { describe, expect, it } from "vitest";
import { Duration, Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";

import {
  buildClaudeSubscriptionProbeQuery,
  probeClaudeSubscription,
  type ClaudeSubscriptionProbeDependencies,
  type ClaudeSubscriptionQueryInput,
} from "./claudeSubscriptionProbe";

const HOME_DIR = "/users/tester/../tester";
const PROJECT_DIR = "/hostile/project";

function makeAbortTracker(): {
  readonly controller: AbortController;
  readonly createAbortController: () => AbortController;
} {
  const controller = new AbortController();
  return { controller, createAbortController: () => controller };
}

describe("buildClaudeSubscriptionProbeQuery", () => {
  it("builds an isolated SDK configuration from a normalized home and string environment", () => {
    // Given
    const abortController = new AbortController();

    // When
    const built = buildClaudeSubscriptionProbeQuery({
      abortController,
      homeDir: HOME_DIR,
      environment: {
        HOME: PROJECT_DIR,
        PWD: PROJECT_DIR,
        OLDPWD: `${PROJECT_DIR}/previous`,
        INIT_CWD: PROJECT_DIR,
        PROJECT_HINT: `prefix:${PROJECT_DIR}:suffix`,
        npm_config_local_prefix: PROJECT_DIR,
        npm_package_json: `${PROJECT_DIR}/package.json`,
        XDG_CONFIG_HOME: `${PROJECT_DIR}/config`,
        CLAUDE_CONFIG_DIR: `${PROJECT_DIR}/claude`,
        PATH: "/usr/bin",
        HTTP_PROXY: undefined,
        HTTPS_PROXY: "https://proxy.example.test",
        NODE_EXTRA_CA_CERTS: "/etc/ssl/custom.pem",
        ANTHROPIC_API_KEY: "sk-ant-test",
        LANG: "en_CA.UTF-8",
        TMPDIR: "/tmp",
        OMITTED: undefined,
        ENABLE_CLAUDEAI_MCP_SERVERS: "true",
      },
    });

    // Then
    expect(built.cwd).toBe("/users/tester/.jcode/provider-probes/claude");
    expect(JSON.stringify(built)).not.toContain(PROJECT_DIR);
    expect(built.options).toEqual({
      abortController,
      cwd: "/users/tester/.jcode/provider-probes/claude",
      env: {
        HOME: "/users/tester",
        PATH: "/usr/bin",
        HTTPS_PROXY: "https://proxy.example.test",
        NODE_EXTRA_CA_CERTS: "/etc/ssl/custom.pem",
        ANTHROPIC_API_KEY: "sk-ant-test",
        LANG: "en_CA.UTF-8",
        TMPDIR: "/tmp",
        ENABLE_CLAUDEAI_MCP_SERVERS: "false",
      },
      settingSources: [],
      mcpServers: {},
      strictMcpConfig: true,
      tools: [],
      allowedTools: [],
      skills: [],
      plugins: [],
      agents: {},
      hooks: {},
      persistSession: false,
      stderr: expect.any(Function),
    });
  });
});

describe("probeClaudeSubscription", () => {
  it("creates the isolated cwd before returning initialization metadata without a prompt", async () => {
    // Given
    const abort = makeAbortTracker();
    const events: string[] = [];
    let promptResult: Promise<IteratorResult<unknown>> | undefined;
    let capturedInput: ClaudeSubscriptionQueryInput | undefined;
    const dependencies: ClaudeSubscriptionProbeDependencies = {
      createAbortController: abort.createAbortController,
      makeDirectory: async () => {
        events.push("mkdir");
      },
      query: (input) => {
        events.push("query");
        capturedInput = input;
        promptResult = input.prompt[Symbol.asyncIterator]().next();
        return {
          initializationResult: async () => {
            events.push("initialization");
            return { account: { subscriptionType: "pro" } };
          },
        };
      },
    };

    // When
    const result = await Effect.runPromise(
      probeClaudeSubscription({
        homeDir: HOME_DIR,
        environment: { HOME: PROJECT_DIR },
        dependencies,
      }),
    );

    // Then
    expect(result).toEqual({ subscriptionType: "pro" });
    expect(events).toEqual(["mkdir", "query", "initialization"]);
    expect(capturedInput?.options.cwd).toBe("/users/tester/.jcode/provider-probes/claude");
    expect(abort.controller.signal.aborted).toBe(true);
    expect(await promptResult).toEqual({ value: undefined, done: true });
  });

  it("soft-returns undefined and aborts when directory creation fails", async () => {
    // Given
    const abort = makeAbortTracker();
    let queried = false;
    const dependencies: ClaudeSubscriptionProbeDependencies = {
      createAbortController: abort.createAbortController,
      makeDirectory: async () => {
        throw new Error("read-only filesystem");
      },
      query: () => {
        queried = true;
        throw new Error("query must not run");
      },
    };

    // When
    const result = await Effect.runPromise(
      probeClaudeSubscription({ homeDir: HOME_DIR, environment: {}, dependencies }),
    );

    // Then
    expect(result).toBeUndefined();
    expect(queried).toBe(false);
    expect(abort.controller.signal.aborted).toBe(true);
  });

  it("soft-returns undefined and aborts when the query fails", async () => {
    // Given
    const abort = makeAbortTracker();
    const dependencies: ClaudeSubscriptionProbeDependencies = {
      createAbortController: abort.createAbortController,
      makeDirectory: async () => {},
      query: () => ({
        initializationResult: async () => {
          throw new Error("query failed");
        },
      }),
    };

    // When
    const result = await Effect.runPromise(
      probeClaudeSubscription({ homeDir: HOME_DIR, environment: {}, dependencies }),
    );

    // Then
    expect(result).toBeUndefined();
    expect(abort.controller.signal.aborted).toBe(true);
  });

  it("soft-returns undefined and aborts on a controlled timeout", async () => {
    // Given
    const abort = makeAbortTracker();
    const dependencies: ClaudeSubscriptionProbeDependencies = {
      createAbortController: abort.createAbortController,
      makeDirectory: async () => {},
      query: () => ({
        initializationResult: () => new Promise(() => {}),
      }),
    };

    // When
    const result = await Effect.gen(function* () {
      const fiber = yield* Effect.forkChild(
        probeClaudeSubscription({
          homeDir: HOME_DIR,
          environment: {},
          dependencies,
          timeoutMs: 25,
        }),
      );
      yield* Effect.yieldNow;
      yield* TestClock.adjust(Duration.millis(25));
      return yield* Fiber.join(fiber);
    }).pipe(Effect.provide(TestClock.layer()), Effect.scoped, Effect.runPromise);

    // Then
    expect(result).toBeUndefined();
    expect(abort.controller.signal.aborted).toBe(true);
  });
});
