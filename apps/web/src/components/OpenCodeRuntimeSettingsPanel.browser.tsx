import "../index.css";

import type {
  NativeApi,
  OpenCodeRuntimeHealth,
  ProviderRuntimeBootstrapSnapshot,
} from "@jcode/contracts";
import { page } from "vitest/browser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { OpenCodeRuntimeSettingsPanel } from "./OpenCodeRuntimeSettingsPanel";

const NOW = "2026-06-11T12:00:00.000Z";

const health: OpenCodeRuntimeHealth = {
  provider: "opencode",
  profileId: "wsl-opencode-service",
  profileLabel: "WSL OpenCode service",
  mode: "external",
  configMode: "inherit",
  status: "healthy",
  serverUrl: "http://127.0.0.1:4096",
  external: true,
  capabilities: {},
  mismatches: [],
  checkedAt: NOW,
};

let bootstrapStatus: ProviderRuntimeBootstrapSnapshot;

const nativeApi = {
  provider: {
    getRuntimeHealth: vi.fn(async () => health),
    getRuntimeBootstrapStatus: vi.fn(async () => bootstrapStatus),
    bootstrapRuntime: vi.fn(async () => ({
      ...bootstrapStatus,
      state: "ready" as const,
      message: "OpenCode runtime is ready.",
    })),
    repairRuntime: vi.fn(async () => ({
      ...bootstrapStatus,
      state: "ready" as const,
      message: "OpenCode runtime is ready.",
    })),
  },
} as unknown as NativeApi;

describe("OpenCodeRuntimeSettingsPanel", () => {
  beforeEach(() => {
    bootstrapStatus = {
      provider: "opencode",
      lane: "wsl-service",
      state: "notInstalled",
      checkedAt: NOW,
      message: "OpenCode runtime is not installed.",
    };
    for (const method of Object.values(nativeApi.provider)) {
      if (typeof method === "function" && "mockClear" in method) {
        (method as { mockClear: () => void }).mockClear();
      }
    }
    window.nativeApi = nativeApi;
  });

  afterEach(() => {
    Reflect.deleteProperty(window, "nativeApi");
    document.body.innerHTML = "";
  });

  it("shows install when runtime bootstrap status is not installed", async () => {
    const screen = await render(<OpenCodeRuntimeSettingsPanel />);

    await vi.waitFor(() => {
      expect(nativeApi.provider.getRuntimeBootstrapStatus).toHaveBeenCalledWith({
        provider: "opencode",
      });
      expect(document.body.textContent).toContain("OpenCode runtime is not installed.");
    });

    await page.getByRole("button", { name: "Install OpenCode runtime" }).click();

    await vi.waitFor(() => {
      expect(nativeApi.provider.bootstrapRuntime).toHaveBeenCalledWith({ provider: "opencode" });
      expect(nativeApi.provider.getRuntimeHealth).toHaveBeenCalledWith({
        provider: "opencode",
        forceRefresh: true,
      });
      expect(document.body.textContent).toContain("OpenCode runtime is ready.");
    });

    await screen.unmount();
  });

  it("shows repair when runtime bootstrap status is error", async () => {
    bootstrapStatus = {
      provider: "opencode",
      lane: "wsl-service",
      state: "error",
      serviceName: "jcode-opencode.service",
      message: "Service stopped.",
      checkedAt: NOW,
    };

    const screen = await render(<OpenCodeRuntimeSettingsPanel />);

    await vi.waitFor(() => {
      expect(document.body.textContent).toContain("Service stopped.");
    });

    await page.getByRole("button", { name: "Repair runtime" }).click();

    await vi.waitFor(() => {
      expect(nativeApi.provider.repairRuntime).toHaveBeenCalledWith({ provider: "opencode" });
      expect(nativeApi.provider.getRuntimeHealth).toHaveBeenCalledWith({
        provider: "opencode",
        forceRefresh: true,
      });
      expect(document.body.textContent).toContain("OpenCode runtime is ready.");
    });

    await screen.unmount();
  });

  it("shows unsupported status without install or repair actions", async () => {
    bootstrapStatus = {
      provider: "opencode",
      lane: "wsl-service",
      state: "unsupported",
      message: "WSL bootstrap is only available on Windows hosts.",
      checkedAt: NOW,
    };

    const screen = await render(<OpenCodeRuntimeSettingsPanel />);

    await vi.waitFor(() => {
      expect(document.body.textContent).toContain(
        "WSL bootstrap is only available on Windows hosts.",
      );
      expect(document.body.textContent).not.toContain("Install OpenCode runtime");
      expect(document.body.textContent).not.toContain("Repair runtime");
      expect(nativeApi.provider.bootstrapRuntime).not.toHaveBeenCalled();
      expect(nativeApi.provider.repairRuntime).not.toHaveBeenCalled();
    });

    await screen.unmount();
  });
});
