import { Effect, Layer } from "effect";

import { runProcess } from "../../processRunner.ts";
import { ProviderAdapterRequestError } from "../Errors.ts";
import {
  buildSkillsAddArgs,
  buildSkillsFindArgs,
  buildSkillsRemoveArgs,
  parseSkillsFindOutput,
  SkillManagementService,
  type SkillManagementServiceShape,
} from "../Services/SkillManagementService.ts";

function toRequestError(input: {
  readonly provider: string;
  readonly method: string;
  readonly cause: unknown;
}): ProviderAdapterRequestError {
  const detail = input.cause instanceof Error ? input.cause.message : String(input.cause);
  return new ProviderAdapterRequestError({
    provider: input.provider,
    method: input.method,
    detail,
    cause: input.cause,
  });
}

const make = Effect.succeed<SkillManagementServiceShape>({
  install: (input) =>
    Effect.tryPromise({
      try: async () => {
        await runProcess("npx", buildSkillsAddArgs(input), {
          cwd: input.cwd,
          timeoutMs: 120_000,
          outputMode: "truncate",
        });
      },
      catch: (cause) => toRequestError({ provider: input.agent, method: "skills.add", cause }),
    }),
  uninstall: (input) =>
    Effect.tryPromise({
      try: async () => {
        await runProcess("npx", buildSkillsRemoveArgs(input), {
          cwd: input.cwd,
          timeoutMs: 120_000,
          outputMode: "truncate",
        });
      },
      catch: (cause) => toRequestError({ provider: input.agent, method: "skills.remove", cause }),
    }),
  searchCatalog: (query) =>
    Effect.tryPromise({
      try: async () => {
        const result = await runProcess("npx", buildSkillsFindArgs(query), {
          timeoutMs: 60_000,
          outputMode: "truncate",
        });
        return { results: parseSkillsFindOutput(`${result.stdout}\n${result.stderr}`) };
      },
      catch: (cause) => toRequestError({ provider: "skills", method: "skills.find", cause }),
    }),
});

export const SkillManagementServiceLive = Layer.effect(SkillManagementService, make);
