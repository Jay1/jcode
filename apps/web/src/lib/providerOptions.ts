import type { ProviderKind, ProviderStartOptions } from "@jcode/contracts";

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

export function buildProviderOptionsKey(
  provider: ProviderKind,
  providerOptions: ProviderStartOptions | null | undefined,
): string | null {
  if (provider === "codex") return buildCodexProviderOptionsKey(providerOptions);

  if (provider === "claudeAgent") {
    const options = providerOptions?.claudeAgent;
    if (!options) return null;
    return JSON.stringify({ binaryPath: options.binaryPath ?? null });
  }

  if (provider === "cursor") {
    const options = providerOptions?.cursor;
    if (!options) return null;
    return JSON.stringify({
      apiEndpoint: options.apiEndpoint ?? null,
      binaryPath: options.binaryPath ?? null,
    });
  }

  if (provider === "gemini") {
    const options = providerOptions?.gemini;
    if (!options) return null;
    return JSON.stringify({ binaryPath: options.binaryPath ?? null });
  }

  if (provider === "kilo") {
    const options = providerOptions?.kilo;
    if (!options) return null;
    return JSON.stringify({
      binaryPath: options.binaryPath ?? null,
      serverUrl: options.serverUrl ?? null,
    });
  }

  if (provider === "opencode") {
    const options = providerOptions?.opencode;
    if (!options) return null;
    return JSON.stringify({
      binaryPath: options.binaryPath ?? null,
      serverUrl: options.serverUrl ?? null,
    });
  }

  if (provider === "pi") {
    const options = providerOptions?.pi;
    if (!options) return null;
    return JSON.stringify({
      agentDir: options.agentDir ?? null,
      binaryPath: options.binaryPath ?? null,
    });
  }

  return null;
}
