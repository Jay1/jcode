export const isWildcardHost = (host: string | undefined): boolean =>
  host === "0.0.0.0" || host === "::" || host === "[::]";

const stripIpv6Brackets = (value: string): string =>
  value.startsWith("[") && value.endsWith("]") ? value.slice(1, -1) : value;

const normalizeHostName = (value: string): string => stripIpv6Brackets(value.trim()).toLowerCase();

export const isLoopbackHost = (host: string | undefined): boolean => {
  if (!host) return true;
  const normalized = normalizeHostName(host);
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
};

export const isExplicitLoopbackHost = (host: string | undefined): boolean =>
  typeof host === "string" && host.trim().length > 0 && isLoopbackHost(host);

export const isLoopbackRemoteAddress = (remoteAddress: string | null | undefined): boolean => {
  if (!remoteAddress) return false;
  const normalized = normalizeHostName(
    remoteAddress.startsWith("::ffff:") ? remoteAddress.slice("::ffff:".length) : remoteAddress,
  );
  return normalized === "127.0.0.1" || normalized === "::1";
};

type ParsedOrigin = {
  readonly hostname: string;
  readonly port: string;
};

const parseHttpOrigin = (origin: string | undefined): ParsedOrigin | null => {
  if (!origin) return null;
  try {
    const url = new URL(origin);
    if (url.protocol !== "http:") return null;
    return {
      hostname: normalizeHostName(url.hostname),
      port: url.port || "80",
    };
  } catch {
    return null;
  }
};

const parseHostHeader = (host: string | undefined): ParsedOrigin | null => {
  if (!host) return null;
  try {
    const url = new URL(`http://${host}`);
    return {
      hostname: normalizeHostName(url.hostname),
      port: url.port || "80",
    };
  } catch {
    return null;
  }
};

export const isSameOriginLoopbackRequest = (input: {
  readonly host: string | undefined;
  readonly origin: string | undefined;
}): boolean => {
  const host = parseHostHeader(input.host);
  if (!host || !isExplicitLoopbackHost(host.hostname)) {
    return false;
  }

  if (!input.origin) return true;

  const origin = parseHttpOrigin(input.origin);
  if (!origin || !isExplicitLoopbackHost(origin.hostname)) return false;
  return host.hostname === origin.hostname && host.port === origin.port;
};

export const formatHostForUrl = (host: string): string =>
  host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;

export const resolveListeningPort = (address: unknown, fallbackPort: number): number => {
  if (
    typeof address === "object" &&
    address !== null &&
    "port" in address &&
    typeof address.port === "number"
  ) {
    return address.port;
  }
  return fallbackPort;
};
