import { getPairingTokenFromUrl } from "../pairingUrl";

const SUPPORTED_REMOTE_BACKEND_PROTOCOLS: ReadonlySet<string> = new Set([
  "http:",
  "https:",
  "ws:",
  "wss:",
]);

export interface ResolvedRemotePairingTarget {
  readonly credential: string;
  readonly httpBaseUrl: string;
  readonly wsBaseUrl: string;
}

function assertSupportedRemoteBackendProtocol(url: URL): void {
  if (SUPPORTED_REMOTE_BACKEND_PROTOCOLS.has(url.protocol)) {
    return;
  }
  throw new Error(`Unsupported remote backend URL protocol: ${url.protocol}`);
}

function normalizeRemoteBaseUrl(rawValue: string): URL {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    throw new Error("Enter a backend URL.");
  }

  const normalizedInput =
    /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//u.test(trimmed) || trimmed.startsWith("//")
      ? trimmed
      : `https://${trimmed}`;
  const url = new URL(normalizedInput, globalThis.location?.origin ?? "https://localhost");
  assertSupportedRemoteBackendProtocol(url);
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url;
}

function toHttpBaseUrl(url: URL): string {
  const next = new URL(url.toString());
  if (next.protocol === "ws:") {
    next.protocol = "http:";
  } else if (next.protocol === "wss:") {
    next.protocol = "https:";
  }
  next.pathname = "/";
  next.search = "";
  next.hash = "";
  return next.toString();
}

function toWsBaseUrl(url: URL): string {
  const next = new URL(url.toString());
  if (next.protocol === "http:") {
    next.protocol = "ws:";
  } else if (next.protocol === "https:") {
    next.protocol = "wss:";
  }
  next.pathname = "/";
  next.search = "";
  next.hash = "";
  return next.toString();
}

function readHostedPairingRequest(url: URL): { host: string; token: string } | null {
  if (url.pathname !== "/pair") return null;
  const host = url.searchParams.get("host")?.trim() ?? "";
  const token = getPairingTokenFromUrl(url)?.trim() ?? "";
  if (!host || !token) return null;
  return { host, token };
}

export function resolveRemotePairingTarget(input: {
  readonly pairingUrl?: string;
  readonly host?: string;
  readonly pairingCode?: string;
}): ResolvedRemotePairingTarget {
  const pairingUrl = input.pairingUrl?.trim() ?? "";
  if (pairingUrl.length > 0) {
    const url = new URL(pairingUrl, globalThis.location?.origin ?? "https://localhost");
    assertSupportedRemoteBackendProtocol(url);
    const hostedPairingRequest = readHostedPairingRequest(url);
    if (hostedPairingRequest) {
      const hostedBackendUrl = normalizeRemoteBaseUrl(hostedPairingRequest.host);
      return {
        credential: hostedPairingRequest.token,
        httpBaseUrl: toHttpBaseUrl(hostedBackendUrl),
        wsBaseUrl: toWsBaseUrl(hostedBackendUrl),
      };
    }

    const credential = getPairingTokenFromUrl(url)?.trim() ?? "";
    if (!credential) {
      throw new Error("Pairing URL is missing its token.");
    }
    return {
      credential,
      httpBaseUrl: toHttpBaseUrl(url),
      wsBaseUrl: toWsBaseUrl(url),
    };
  }

  const host = input.host?.trim() ?? "";
  const pairingCode = input.pairingCode?.trim() ?? "";
  if (!host) {
    throw new Error("Enter a backend URL.");
  }
  if (!pairingCode) {
    throw new Error("Enter a pairing code.");
  }

  const normalizedHost = normalizeRemoteBaseUrl(host);
  return {
    credential: pairingCode,
    httpBaseUrl: toHttpBaseUrl(normalizedHost),
    wsBaseUrl: toWsBaseUrl(normalizedHost),
  };
}
