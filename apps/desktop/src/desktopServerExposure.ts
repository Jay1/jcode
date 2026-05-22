import * as FS from "node:fs";
import * as OS from "node:os";
import * as Path from "node:path";

import type {
  DesktopAdvertisedEndpoint,
  DesktopServerExposureMode,
  DesktopServerExposureState,
} from "@jcode/contracts";

const LOOPBACK_HOST = "127.0.0.1";
const LAN_BIND_HOST = "0.0.0.0";

interface ExposureDocument {
  readonly version: 1;
  readonly mode: DesktopServerExposureMode;
}

export interface DesktopNetworkInterfaceInfo {
  readonly address: string;
  readonly family: string | number;
  readonly internal: boolean;
}

export type DesktopNetworkInterfaces = Readonly<
  Record<string, readonly DesktopNetworkInterfaceInfo[] | undefined>
>;

function isDesktopServerExposureMode(value: unknown): value is DesktopServerExposureMode {
  return value === "local-only" || value === "network-accessible";
}

function parseDocument(value: string): ExposureDocument {
  try {
    const parsed = JSON.parse(value) as { readonly mode?: unknown };
    if (isDesktopServerExposureMode(parsed.mode)) {
      return { version: 1, mode: parsed.mode };
    }
  } catch {
    // Ignore corrupt exposure settings and fall back to loopback.
  }
  return { version: 1, mode: "local-only" };
}

function normalizeNetworkFamily(value: string | number): string {
  return typeof value === "string" ? value : value === 4 ? "IPv4" : String(value);
}

function isUsableLanIpv4Address(address: string): boolean {
  return !address.startsWith("127.") && !address.startsWith("169.254.");
}

export function resolveDesktopLanAdvertisedHost(
  networkInterfaces: DesktopNetworkInterfaces = OS.networkInterfaces(),
): string | null {
  for (const interfaceAddresses of Object.values(networkInterfaces)) {
    if (!interfaceAddresses) continue;

    for (const address of interfaceAddresses) {
      if (address.internal) continue;
      if (normalizeNetworkFamily(address.family) !== "IPv4") continue;
      if (!isUsableLanIpv4Address(address.address)) continue;
      return address.address;
    }
  }
  return null;
}

export function resolveDesktopServerBindHost(mode: DesktopServerExposureMode): string {
  return mode === "network-accessible" ? LAN_BIND_HOST : LOOPBACK_HOST;
}

export function resolveDesktopServerExposureState(input: {
  readonly mode: DesktopServerExposureMode;
  readonly activeMode: DesktopServerExposureMode;
  readonly port: number;
  readonly networkInterfaces?: DesktopNetworkInterfaces;
}): DesktopServerExposureState {
  const advertisedHost =
    input.mode === "network-accessible"
      ? resolveDesktopLanAdvertisedHost(input.networkInterfaces)
      : null;

  return {
    mode: input.mode,
    activeMode: input.activeMode,
    endpointUrl: advertisedHost ? `http://${advertisedHost}:${input.port}` : null,
    advertisedHost,
    bindHost: resolveDesktopServerBindHost(input.mode),
    port: input.port,
    requiresRestart: input.mode !== input.activeMode,
  };
}

export function resolveDesktopAdvertisedEndpoints(
  state: DesktopServerExposureState,
): ReadonlyArray<DesktopAdvertisedEndpoint> {
  const loopback: DesktopAdvertisedEndpoint = {
    id: `desktop-loopback:${state.port}`,
    label: "This machine",
    httpBaseUrl: `http://${LOOPBACK_HOST}:${state.port}`,
    wsBaseUrl: `ws://${LOOPBACK_HOST}:${state.port}`,
    reachability: "loopback",
    isDefault: state.endpointUrl === null,
    description: "Reachable from this desktop app and browser on the same machine.",
  };

  if (!state.endpointUrl || !state.advertisedHost) return [loopback];

  return [
    loopback,
    {
      id: `desktop-lan:${state.advertisedHost}:${state.port}`,
      label: "Local network",
      httpBaseUrl: state.endpointUrl,
      wsBaseUrl: `ws://${state.advertisedHost}:${state.port}`,
      reachability: "lan",
      isDefault: true,
      description: "Reachable from other devices on the same network after restart.",
    },
  ];
}

export class DesktopServerExposureStore {
  readonly filePath: string;

  constructor(stateDir: string) {
    this.filePath = Path.join(stateDir, "server-exposure.json");
  }

  readMode(): DesktopServerExposureMode {
    try {
      return parseDocument(FS.readFileSync(this.filePath, "utf8")).mode;
    } catch {
      return "local-only";
    }
  }

  writeMode(mode: unknown): DesktopServerExposureMode {
    if (!isDesktopServerExposureMode(mode)) {
      throw new Error("Invalid desktop server exposure mode.");
    }
    FS.mkdirSync(Path.dirname(this.filePath), { recursive: true });
    FS.writeFileSync(this.filePath, JSON.stringify({ version: 1, mode }), { mode: 0o600 });
    return mode;
  }

  getState(input: {
    readonly port: number;
    readonly activeMode: DesktopServerExposureMode;
    readonly networkInterfaces?: DesktopNetworkInterfaces;
  }): DesktopServerExposureState {
    const stateInput: Parameters<typeof resolveDesktopServerExposureState>[0] = {
      mode: this.readMode(),
      activeMode: input.activeMode,
      port: input.port,
    };
    if (input.networkInterfaces !== undefined) {
      return resolveDesktopServerExposureState({
        ...stateInput,
        networkInterfaces: input.networkInterfaces,
      });
    }
    return resolveDesktopServerExposureState(stateInput);
  }

  getAdvertisedEndpoints(input: {
    readonly port: number;
    readonly activeMode: DesktopServerExposureMode;
    readonly networkInterfaces?: DesktopNetworkInterfaces;
  }): ReadonlyArray<DesktopAdvertisedEndpoint> {
    return resolveDesktopAdvertisedEndpoints(this.getState(input));
  }
}
