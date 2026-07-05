import { execFile } from "node:child_process";

import { Effect } from "effect";

import type {
  ManagedSidecarBinaryVersionProbe,
  ManagedSidecarServerProbe,
} from "./managedRuntimeHealth.ts";
import { OPENCODE_CLI_SPEC } from "./opencodeRuntime.ts";

const firstOutputLine = (output: string | Buffer): string =>
  output
    .toString()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0) ?? "";

export const defaultManagedSidecarBinaryVersionProbe: ManagedSidecarBinaryVersionProbe = (
  binaryPath,
) =>
  Effect.tryPromise({
    try: () =>
      new Promise<string>((resolve, reject) => {
        execFile(
          binaryPath,
          ["--version"],
          { env: {}, timeout: 2_000 },
          (error, stdout, stderr) => {
            if (error) {
              reject(error);
              return;
            }

            const version = firstOutputLine(stdout) || firstOutputLine(stderr);
            resolve(version || "unavailable");
          },
        );
      }),
    catch: () => "unavailable",
  }).pipe(Effect.catch(() => Effect.succeed("unavailable")));

export const defaultManagedSidecarServerProbe: ManagedSidecarServerProbe = (
  serverUrl,
  serverPassword,
) =>
  Effect.tryPromise({
    try: async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2_000);
      try {
        const response = await fetch(serverUrl, {
          method: "GET",
          signal: controller.signal,
          ...(serverPassword
            ? {
                headers: {
                  Authorization: `Basic ${Buffer.from(`${OPENCODE_CLI_SPEC.serverAuthUsername}:${serverPassword}`, "utf8").toString("base64")}`,
                },
              }
            : {}),
        });
        return response.ok;
      } finally {
        clearTimeout(timeout);
      }
    },
    catch: () => false,
  }).pipe(Effect.catch(() => Effect.succeed(false)));
