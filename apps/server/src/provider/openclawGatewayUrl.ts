import * as Net from "node:net";

export interface OpenClawGatewayUrlOptions {
  readonly allowInsecureRemote?: boolean;
}

export interface NormalizedOpenClawGatewayUrl {
  readonly websocketUrl: string;
  readonly redactedUrl: string;
  readonly isLoopback: boolean;
}

export class OpenClawGatewayUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenClawGatewayUrlError";
  }
}

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized === "localhost" || normalized === "::1") {
    return true;
  }
  if (Net.isIP(normalized) !== 4) {
    return false;
  }
  const firstOctet = Number(normalized.split(".")[0] ?? "0");
  return firstOctet === 127;
}

function parseGatewayUrl(value: string): URL {
  try {
    return new URL(value.trim());
  } catch (cause) {
    throw new OpenClawGatewayUrlError("OpenClaw gateway URL must be a valid URL.");
  }
}

function stripSensitiveUrlParts(url: URL): URL {
  const clone = new URL(url.toString());
  clone.username = "";
  clone.password = "";
  clone.search = "";
  clone.hash = "";
  return clone;
}

export function redactOpenClawGatewayUrl(value: string): string {
  return stripSensitiveUrlParts(parseGatewayUrl(value)).toString();
}

export function normalizeOpenClawGatewayUrl(
  value: string,
  options: OpenClawGatewayUrlOptions = {},
): NormalizedOpenClawGatewayUrl {
  const url = stripSensitiveUrlParts(parseGatewayUrl(value));
  switch (url.protocol) {
    case "http:":
      url.protocol = "ws:";
      break;
    case "https:":
      url.protocol = "wss:";
      break;
    case "ws:":
    case "wss:":
      break;
    default:
      throw new OpenClawGatewayUrlError("OpenClaw gateway URL must use http, https, ws, or wss.");
  }

  const isLoopback = isLoopbackHostname(url.hostname);
  if (url.protocol === "ws:" && !isLoopback && options.allowInsecureRemote !== true) {
    throw new OpenClawGatewayUrlError(
      `OpenClaw gateway URL requires wss:// for non-loopback hosts: ${url.toString()}`,
    );
  }

  const websocketUrl = url.toString();
  return {
    websocketUrl,
    redactedUrl: websocketUrl,
    isLoopback,
  };
}
