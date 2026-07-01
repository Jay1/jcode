import type { Backend } from "@jcode/contracts";

export type ResolveBackendPathInput = {
  readonly backend: Backend;
  readonly path: string;
};

export type ResolvedBackendPath = {
  readonly hostPath: string;
  readonly backendPath: string;
};

export type WslUncPath = {
  readonly distro: string;
  readonly linuxPath: string;
};

type WindowsDrivePath = {
  readonly drive: string;
  readonly tail: string;
};

export function parseWslUncPath(path: string): WslUncPath | null {
  const normalized = path.replace(/\//g, "\\");
  const prefix = "\\\\wsl$\\";
  if (!normalized.toLowerCase().startsWith(prefix)) return null;
  const remainder = normalized.slice(prefix.length);
  const firstSeparator = remainder.indexOf("\\");
  if (firstSeparator <= 0) return null;
  const distro = remainder.slice(0, firstSeparator);
  const tail = remainder.slice(firstSeparator + 1).replace(/\\/g, "/");
  return { distro, linuxPath: `/${tail}`.replace(/\/+/g, "/") };
}

function parseWindowsDrivePath(path: string): WindowsDrivePath | null {
  const match = /^([A-Za-z]):[\\/]*(.*)$/.exec(path);
  if (match === null) return null;
  const drive = match[1];
  const tail = match[2];
  if (drive === undefined || tail === undefined) return null;
  return { drive: drive.toLowerCase(), tail: tail.replace(/\\/g, "/") };
}

function hostPathFromMntPath(path: string): string | null {
  const match = /^\/mnt\/([A-Za-z])(?:\/(.*))?$/.exec(path);
  if (match === null) return null;
  const drive = match[1];
  const tail = match[2] ?? "";
  if (drive === undefined) return null;
  const suffix = tail.length > 0 ? `\\${tail.replace(/\//g, "\\")}` : "\\";
  return `${drive.toUpperCase()}:${suffix}`;
}

function backendPathForWsl(path: string): string {
  const unc = parseWslUncPath(path);
  if (unc !== null) return unc.linuxPath;
  const drive = parseWindowsDrivePath(path);
  if (drive !== null) return `/mnt/${drive.drive}/${drive.tail}`.replace(/\/+/g, "/");
  return path;
}

function hostPathForBackend(path: string): string {
  const hostPath = hostPathFromMntPath(path);
  return hostPath ?? path;
}

export function resolveBackendPath(input: ResolveBackendPathInput): ResolvedBackendPath {
  if (input.backend.kind === "wsl") {
    return { hostPath: input.path, backendPath: backendPathForWsl(input.path) };
  }
  return { hostPath: hostPathForBackend(input.path), backendPath: input.path };
}
