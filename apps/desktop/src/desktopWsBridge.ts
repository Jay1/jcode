// FILE: desktopWsBridge.ts
// Purpose: Shares the desktop WebSocket bridge channel and env fallback rules.
// Exports: channel name plus helpers used by Electron main, preload, and tests.

export const DESKTOP_WS_URL_CHANNEL = "desktop:get-ws-url";
export const DESKTOP_LOCAL_ENVIRONMENT_BOOTSTRAP_CHANNEL =
  "desktop:get-local-environment-bootstrap";
export const DESKTOP_CONNECTION_SECRET_READ_CHANNEL = "desktop:connection-secret-read";
export const DESKTOP_CONNECTION_SECRET_WRITE_CHANNEL = "desktop:connection-secret-write";
export const DESKTOP_CONNECTION_SECRET_REMOVE_CHANNEL = "desktop:connection-secret-remove";

export function normalizeDesktopWsUrl(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function resolveDesktopWsUrlFromEnv(env: NodeJS.ProcessEnv): string | null {
  return (
    normalizeDesktopWsUrl(env.DPCODE_DESKTOP_WS_URL) ??
    normalizeDesktopWsUrl(env.T3CODE_DESKTOP_WS_URL)
  );
}
