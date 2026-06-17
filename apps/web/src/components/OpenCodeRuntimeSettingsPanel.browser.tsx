import "../index.css";

import type {
  ManagedSidecarDiagnostics,
  ManagedSidecarHealthCheck,
  ManagedSidecarRepairResult,
  NativeApi,
  OpenCodeRuntimeHealth,
} from "@jcode/contracts";
import { page } from "vitest/browser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { OpenCodeRuntimeSettingsPanel } from "./OpenCodeRuntimeSettingsPanel";

const RUNTIME_HEALTH: OpenCodeRuntimeHealth = {
  provider: "opencode",
  profileId: "managed",
  profileLabel: "Managed sidecar",
  mode: "managed",
  configMode: "inherit",
  status: "healthy",
  serverUrl: "http://127.0.0.1:4096",
  external: false,
  capabilities: {
    commands: { count: 1, names: ["run"] },
    skills: { count: 0, names: [] },
    plugins: { count: 0, names: [] },
    agents: { count: 0, names: [] },
    models: { count: 1, slugs: ["openai/gpt-5.5"] },
  },
  mismatches: [],
  checkedAt: "2026-06-07T12:00:00.000Z",
};

const SIDECAR_HEALTH: ManagedSidecarHealthCheck = {
  status: "healthy",
  sidecarState: "ready",
  binaryPath: "/tmp/jcode/opencode",
  binaryExists: true,
  binaryValid: true,
  serverUrl: "http://127.0.0.1:4096",
  serverReachable: true,
  checkedAt: "2026-06-07T12:01:00.000Z",
};

const SIDECAR_REPAIR: ManagedSidecarRepairResult = {
  success: true,
  health: SIDECAR_HEALTH,
};

const SIDECAR_DIAGNOSTICS: ManagedSidecarDiagnostics = {
  generatedAt: "2026-06-07T12:02:00.000Z",
  health: SIDECAR_HEALTH,
  platform: {
    os: "linux",
    arch: "x64",
    nodeVersion: "v26.2.0",
  },
  binaryVersion: "unknown",
  logs: [],
  sidecarSnapshot: {
    state: "ready",
    binaryPath: "/tmp/jcode/opencode",
    serverUrl: "http://127.0.0.1:4096",
  },
};

const providerApi = {
  getRuntimeHealth: vi.fn(async () => RUNTIME_HEALTH),
  getManagedSidecarHealth: vi.fn(async () => SIDECAR_HEALTH),
  repairManagedSidecar: vi.fn(async () => SIDECAR_REPAIR),
  exportManagedSidecarDiagnostics: vi.fn(async () => SIDECAR_DIAGNOSTICS),
};

const nativeApi = {
  provider: providerApi,
} as unknown as NativeApi;

const originalCreateObjectUrl = URL.createObjectURL;
const originalRevokeObjectUrl = URL.revokeObjectURL;

describe("OpenCodeRuntimeSettingsPanel", () => {
  beforeEach(() => {
    providerApi.getRuntimeHealth.mockClear();
    providerApi.getManagedSidecarHealth.mockClear();
    providerApi.repairManagedSidecar.mockClear();
    providerApi.exportManagedSidecarDiagnostics.mockClear();
    providerApi.getRuntimeHealth.mockResolvedValue(RUNTIME_HEALTH);
    providerApi.getManagedSidecarHealth.mockResolvedValue(SIDECAR_HEALTH);
    providerApi.repairManagedSidecar.mockResolvedValue(SIDECAR_REPAIR);
    providerApi.exportManagedSidecarDiagnostics.mockResolvedValue(SIDECAR_DIAGNOSTICS);
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:jcode-sidecar-diagnostics"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    window.nativeApi = nativeApi;
  });

  afterEach(() => {
    Reflect.deleteProperty(window, "nativeApi");
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: originalCreateObjectUrl,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: originalRevokeObjectUrl,
    });
    document.body.innerHTML = "";
  });

  it("checks managed sidecar health and shows the result", async () => {
    const screen = await render(<OpenCodeRuntimeSettingsPanel />);

    await vi.waitFor(() => {
      expect(providerApi.getRuntimeHealth).toHaveBeenCalledTimes(1);
      expect(document.body.textContent).toContain("Profile ID: managed");
    });

    await page.getByRole("button", { name: "Check sidecar health" }).click();

    await vi.waitFor(() => {
      expect(providerApi.getManagedSidecarHealth).toHaveBeenCalledTimes(1);
      expect(document.body.textContent).toContain("Sidecar: healthy");
      expect(document.body.textContent).toContain("Profile ID: managed");
      expect(document.body.textContent).toContain("State: ready");
      expect(document.body.textContent).toContain("Server reachable");
    });

    await screen.unmount();
  });

  it("repairs the managed sidecar without forcing a redownload", async () => {
    const screen = await render(<OpenCodeRuntimeSettingsPanel />);

    await page.getByRole("button", { name: "Repair sidecar" }).click();

    await vi.waitFor(() => {
      expect(providerApi.repairManagedSidecar).toHaveBeenCalledWith({
        forceRedownload: false,
      });
      expect(document.body.textContent).toContain("Repair succeeded");
      expect(document.body.textContent).toContain("Sidecar: healthy");
    });

    await screen.unmount();
  });

  it("exports managed sidecar diagnostics as a JSON download", async () => {
    const screen = await render(<OpenCodeRuntimeSettingsPanel />);

    await page.getByRole("button", { name: "Export diagnostics" }).click();

    await vi.waitFor(() => {
      expect(providerApi.exportManagedSidecarDiagnostics).toHaveBeenCalledTimes(1);
      expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:jcode-sidecar-diagnostics");
      expect(document.body.textContent).toContain("Diagnostics exported");
    });

    await screen.unmount();
  });

  it("shows an inline failure when managed sidecar health fails", async () => {
    providerApi.getManagedSidecarHealth.mockRejectedValueOnce(new Error("sidecar unavailable"));
    const screen = await render(<OpenCodeRuntimeSettingsPanel />);

    await page.getByRole("button", { name: "Check sidecar health" }).click();

    await expect
      .element(page.getByRole("alert"))
      .toHaveTextContent("Sidecar health check failed: sidecar unavailable");
    await expect.element(page.getByRole("button", { name: "Check sidecar health" })).toBeEnabled();

    await screen.unmount();
  });
});
