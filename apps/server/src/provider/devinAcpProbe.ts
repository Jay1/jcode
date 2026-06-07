import { spawn } from "node:child_process";

import type { ServerProviderAuthStatus, ServerProviderStatusState } from "@jcode/contracts";
import { Effect } from "effect";

export type DevinProbeResult = {
  readonly status: ServerProviderStatusState;
  readonly auth: { readonly status: ServerProviderAuthStatus };
  readonly message?: string;
};

const DEVIN_PROBE_TIMEOUT_MS = 10_000;

export function probeDevinCli(binaryPath?: string): Effect.Effect<DevinProbeResult, never> {
  const command = binaryPath || "devin";
  return Effect.async<DevinProbeResult, never>((resume) => {
    const child = spawn(command, ["--version"], {
      timeout: DEVIN_PROBE_TIMEOUT_MS,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    let settled = false;

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      if (code === 0) {
        resume(
          Effect.succeed({
            status: "ready" as const,
            auth: { status: "unknown" as const },
          }),
        );
      } else {
        resume(
          Effect.succeed({
            status: "error" as const,
            auth: { status: "unauthenticated" as const },
            message: `devin CLI exited with code ${code ?? "null (killed by timeout or signal)"}: ${(stderr || stdout).trim()}`,
          }),
        );
      }
    });

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      resume(
        Effect.succeed({
          status: "error" as const,
          auth: { status: "unauthenticated" as const },
          message: `devin CLI not found: ${err.message}`,
        }),
      );
    });
  });
}
