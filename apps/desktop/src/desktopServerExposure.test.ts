import * as FS from "node:fs";
import * as OS from "node:os";
import * as Path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  DesktopServerExposureStore,
  resolveDesktopAdvertisedEndpoints,
  resolveDesktopLanAdvertisedHost,
  resolveDesktopServerBindHost,
  resolveDesktopServerExposureState,
} from "./desktopServerExposure";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    FS.rmSync(dir, { recursive: true, force: true });
  }
});

function makeStore() {
  const dir = FS.mkdtempSync(Path.join(OS.tmpdir(), "dpcode-desktop-exposure-"));
  tempDirs.push(dir);
  return new DesktopServerExposureStore(dir);
}

describe("desktopServerExposure", () => {
  it("persists the requested exposure mode", () => {
    const store = makeStore();

    expect(store.readMode()).toBe("local-only");
    expect(store.writeMode("network-accessible")).toBe("network-accessible");

    expect(new DesktopServerExposureStore(Path.dirname(store.filePath)).readMode()).toBe(
      "network-accessible",
    );
  });

  it("resolves bind host and advertised LAN endpoint state", () => {
    const networkInterfaces = {
      en0: [{ address: "192.168.1.44", family: "IPv4", internal: false }],
      lo: [{ address: "127.0.0.1", family: "IPv4", internal: true }],
    };

    expect(resolveDesktopLanAdvertisedHost(networkInterfaces)).toBe("192.168.1.44");
    expect(resolveDesktopServerBindHost("local-only")).toBe("127.0.0.1");
    expect(resolveDesktopServerBindHost("network-accessible")).toBe("0.0.0.0");

    const state = resolveDesktopServerExposureState({
      mode: "network-accessible",
      activeMode: "local-only",
      port: 58090,
      networkInterfaces,
    });

    expect(state.endpointUrl).toBe("http://192.168.1.44:58090");
    expect(state.requiresRestart).toBe(true);
  });

  it("advertises loopback and LAN endpoints", () => {
    const endpoints = resolveDesktopAdvertisedEndpoints({
      mode: "network-accessible",
      activeMode: "network-accessible",
      endpointUrl: "http://192.168.1.44:58090",
      advertisedHost: "192.168.1.44",
      bindHost: "0.0.0.0",
      port: 58090,
      requiresRestart: false,
    });

    expect(endpoints.map((endpoint) => endpoint.reachability)).toEqual(["loopback", "lan"]);
    expect(endpoints.find((endpoint) => endpoint.isDefault)?.httpBaseUrl).toBe(
      "http://192.168.1.44:58090",
    );
  });
});
