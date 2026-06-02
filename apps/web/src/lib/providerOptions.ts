import type { ProviderStartOptions } from "@jcode/contracts";

export function buildCodexProviderOptionsKey(
  providerOptions: ProviderStartOptions | null | undefined,
): string | null {
  const codexOptions = providerOptions?.codex;
  if (!codexOptions) {
    return null;
  }

  return JSON.stringify({
    binaryPath: codexOptions.binaryPath ?? null,
    homePath: codexOptions.homePath ?? null,
    launchArgs: codexOptions.launchArgs ?? null,
  });
}
