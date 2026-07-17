import { mkdir } from "node:fs/promises";
import * as NodePath from "node:path";
import {
  query as claudeQuery,
  type Options,
  type SDKUserMessage,
} from "@anthropic-ai/claude-agent-sdk";
import { Effect, Option, Result } from "effect";

const CLAUDE_SUBSCRIPTION_PROBE_TIMEOUT_MS = 8_000;

// Security boundary: retain only child launch, network, locale/temp, and recognized
// provider-auth compatibility. Parent project/config context must never reach the probe.
const CLAUDE_SUBSCRIPTION_PROBE_ENVIRONMENT_KEYS = [
  "PATH",
  "Path",
  "PATHEXT",
  "SYSTEMROOT",
  "SystemRoot",
  "WINDIR",
  "COMSPEC",
  "ComSpec",
  "SHELL",
  "LANG",
  "LANGUAGE",
  "LC_ALL",
  "LC_CTYPE",
  "TZ",
  "TMPDIR",
  "TMP",
  "TEMP",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "ALL_PROXY",
  "NO_PROXY",
  "http_proxy",
  "https_proxy",
  "all_proxy",
  "no_proxy",
  "NODE_EXTRA_CA_CERTS",
  "SSL_CERT_FILE",
  "SSL_CERT_DIR",
  "REQUESTS_CA_BUNDLE",
  "CURL_CA_BUNDLE",
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_AUTH_TOKEN",
  "ANTHROPIC_BASE_URL",
  "ANTHROPIC_CUSTOM_HEADERS",
  "CLAUDE_CODE_OAUTH_TOKEN",
  "CLAUDE_CODE_USE_BEDROCK",
  "CLAUDE_CODE_USE_VERTEX",
  "CLAUDE_CODE_USE_FOUNDRY",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SESSION_TOKEN",
  "AWS_PROFILE",
  "AWS_REGION",
  "AWS_DEFAULT_REGION",
  "AWS_ROLE_ARN",
  "AWS_WEB_IDENTITY_TOKEN_FILE",
  "AWS_BEARER_TOKEN_BEDROCK",
  "AWS_CONTAINER_CREDENTIALS_FULL_URI",
  "AWS_CONTAINER_CREDENTIALS_RELATIVE_URI",
  "AWS_EC2_METADATA_DISABLED",
  "GOOGLE_APPLICATION_CREDENTIALS",
  "GOOGLE_CLOUD_PROJECT",
  "GCLOUD_PROJECT",
  "CLOUD_ML_REGION",
  "ANTHROPIC_VERTEX_PROJECT_ID",
  "ANTHROPIC_FOUNDRY_API_KEY",
  "ANTHROPIC_FOUNDRY_BASE_URL",
  "ANTHROPIC_FOUNDRY_RESOURCE",
] as const;

export type ClaudeSubscriptionQueryInput = {
  readonly prompt: AsyncIterable<SDKUserMessage>;
  readonly options: Options;
};

export type ClaudeSubscriptionProbeDependencies = {
  readonly createAbortController: () => AbortController;
  readonly makeDirectory: (path: string) => Promise<void>;
  readonly query: (input: ClaudeSubscriptionQueryInput) => {
    readonly initializationResult: () => Promise<{
      readonly account?: { readonly subscriptionType?: string };
    }>;
  };
};

type ClaudeSubscriptionProbeInput = {
  readonly homeDir: string;
  readonly environment: NodeJS.ProcessEnv;
  readonly dependencies?: ClaudeSubscriptionProbeDependencies;
  readonly timeoutMs?: number;
};

const defaultDependencies: ClaudeSubscriptionProbeDependencies = {
  createAbortController: () => new AbortController(),
  makeDirectory: async (path) => {
    await mkdir(path, { recursive: true });
  },
  query: (input) => claudeQuery(input),
};

export function buildClaudeSubscriptionProbeQuery(input: {
  readonly abortController: AbortController;
  readonly homeDir: string;
  readonly environment: NodeJS.ProcessEnv;
}): { readonly cwd: string; readonly options: Options } {
  const home = NodePath.resolve(input.homeDir.trim());
  const cwd = NodePath.join(home, ".jcode", "provider-probes", "claude");
  const environment: Record<string, string> = {};
  for (const key of CLAUDE_SUBSCRIPTION_PROBE_ENVIRONMENT_KEYS) {
    const value = input.environment[key];
    if (typeof value === "string") environment[key] = value;
  }
  return {
    cwd,
    options: {
      abortController: input.abortController,
      cwd,
      env: {
        ...environment,
        HOME: home,
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
      stderr: () => {},
    },
  };
}

export function probeClaudeSubscription(
  input: ClaudeSubscriptionProbeInput,
): Effect.Effect<{ readonly subscriptionType: string | undefined } | undefined> {
  const dependencies = input.dependencies ?? defaultDependencies;
  const abortController = dependencies.createAbortController();
  const built = buildClaudeSubscriptionProbeQuery({
    abortController,
    homeDir: input.homeDir,
    environment: input.environment,
  });

  return Effect.tryPromise({
    try: async () => {
      await dependencies.makeDirectory(built.cwd);
      const query = dependencies.query({
        // oxlint-disable-next-line require-yield
        prompt: (async function* (): AsyncGenerator<SDKUserMessage> {
          if (abortController.signal.aborted) return;
          await new Promise<void>((resolve) => {
            abortController.signal.addEventListener("abort", () => resolve(), { once: true });
          });
        })(),
        options: built.options,
      });
      const initialization = await query.initializationResult();
      return { subscriptionType: initialization.account?.subscriptionType };
    },
    catch: (cause) => cause,
  }).pipe(
    Effect.ensuring(
      Effect.sync(() => {
        if (!abortController.signal.aborted) abortController.abort();
      }),
    ),
    Effect.timeoutOption(input.timeoutMs ?? CLAUDE_SUBSCRIPTION_PROBE_TIMEOUT_MS),
    Effect.result,
    Effect.map((result) => {
      if (Result.isFailure(result)) return undefined;
      return Option.isSome(result.success) ? result.success.value : undefined;
    }),
  );
}
