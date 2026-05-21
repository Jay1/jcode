const PAIRING_TOKEN_PARAM = "token";

type UrlInput = string | URL;

function toUrl(input: UrlInput): URL {
  return input instanceof URL
    ? input
    : new URL(input, globalThis.location?.origin ?? "https://localhost");
}

function readHashParams(url: URL): URLSearchParams {
  return new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);
}

export function getPairingTokenFromUrl(input: UrlInput): string | null {
  const url = toUrl(input);
  const hashToken = readHashParams(url).get(PAIRING_TOKEN_PARAM)?.trim() ?? "";
  if (hashToken.length > 0) {
    return hashToken;
  }

  const searchToken = url.searchParams.get(PAIRING_TOKEN_PARAM)?.trim() ?? "";
  return searchToken.length > 0 ? searchToken : null;
}

export function stripPairingTokenFromUrl(input: UrlInput): URL {
  const next = new URL(toUrl(input).toString());
  const hashParams = readHashParams(next);
  if (hashParams.has(PAIRING_TOKEN_PARAM)) {
    hashParams.delete(PAIRING_TOKEN_PARAM);
    next.hash = hashParams.toString();
  }
  next.searchParams.delete(PAIRING_TOKEN_PARAM);
  return next;
}

export function setPairingTokenOnUrl(input: UrlInput, credential: string): URL {
  const next = new URL(toUrl(input).toString());
  next.searchParams.delete(PAIRING_TOKEN_PARAM);
  next.hash = new URLSearchParams([[PAIRING_TOKEN_PARAM, credential]]).toString();
  return next;
}
