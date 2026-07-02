import { describe, expect, it } from "vitest";

import { makeBackendId } from "@jcode/contracts";
import { discoverBackends, resolveBackendPath, resolveProjectBackend } from "./backendRegistry";

const host = {
  environmentId: "host-env",
  label: "Windows host",
  platform: { os: "windows", arch: "x64" },
  serverVersion: "0.0.50",
} as const;

describe("backend registry discovery", () => {
  it("discovers host and mocked WSL distro backend states from Windows fixtures", async () => {
    const calls: readonly string[][] = [];
    const mutableCalls: string[][] = [];
    const registry = await discoverBackends({
      host,
      wsl: {
        enabled: true,
        run: async (args) => {
          mutableCalls.push([...args]);
          if (args[0] === "--list") {
            return { ok: true, stdout: "\uFEFFUbuntu\u0000\r\n\r\nDebian\r\n", stderr: "" };
          }
          if (args[1] === "Ubuntu") {
            return { ok: true, stdout: "x86_64\n", stderr: "" };
          }
          return { ok: false, stdout: "", stderr: "The specified distribution was not found." };
        },
      },
    });
    calls.concat(mutableCalls);

    expect(registry.host.connection.kind).toBe("local");
    expect(registry.backends.map((backend) => backend.id)).toEqual([
      "host",
      "wsl-ubuntu",
      "wsl-debian",
    ]);
    expect(registry.backends[1]?.state.kind).toBe("healthy");
    expect(registry.backends[2]?.state.kind).toBe("degraded");
    expect(mutableCalls).toEqual([
      ["--list", "--quiet"],
      ["-d", "Ubuntu", "--", "uname", "-m"],
      ["-d", "Debian", "--", "uname", "-m"],
    ]);
  });

  it("keeps discovery host-only when WSL probing is disabled", async () => {
    const registry = await discoverBackends({
      host,
      wsl: { enabled: false },
    });

    expect(registry.backends).toHaveLength(1);
    expect(registry.backends[0]?.id).toBe("host");
  });
});

describe("backend path resolution", () => {
  it("resolves project backends without routing live operations", async () => {
    const registry = await discoverBackends({
      host,
      wsl: {
        enabled: true,
        run: async (args) => {
          if (args[0] === "--list") return { ok: true, stdout: "Ubuntu\n", stderr: "" };
          return { ok: true, stdout: "x86_64\n", stderr: "" };
        },
      },
    });

    const hostResolution = resolveProjectBackend({
      registry,
      workspaceRoot: "C:\\Users\\Jay\\project",
    });
    const wslResolution = resolveProjectBackend({
      registry,
      workspaceRoot: "\\\\wsl$\\Ubuntu\\home\\jay\\project",
    });
    const overrideResolution = resolveProjectBackend({
      registry,
      workspaceRoot: "C:\\Users\\Jay\\project",
      overrideBackendId: makeBackendId("wsl-ubuntu"),
    });
    const removedResolution = resolveProjectBackend({
      registry,
      workspaceRoot: "\\\\wsl$\\Ghost\\home\\jay\\project",
    });

    expect(hostResolution.backend.id).toBe("host");
    expect(hostResolution.backendPath).toBe("C:\\Users\\Jay\\project");
    expect(wslResolution.backend.id).toBe("wsl-ubuntu");
    expect(wslResolution.backendPath).toBe("/home/jay/project");
    expect(overrideResolution.backend.id).toBe("wsl-ubuntu");
    expect(overrideResolution.backendPath).toBe("/mnt/c/Users/Jay/project");
    expect(removedResolution.backend.state.kind).toBe("removed");
    expect(removedResolution.backendPath).toBe("/home/jay/project");
  });

  it("translates host and WSL path edge cases as pure data", async () => {
    const registry = await discoverBackends({
      host,
      wsl: {
        enabled: true,
        run: async (args) => {
          if (args[0] === "--list") return { ok: true, stdout: "Ubuntu\n", stderr: "" };
          return { ok: true, stdout: "aarch64\n", stderr: "" };
        },
      },
    });
    const ubuntu = registry.backends.find((backend) => backend.id === "wsl-ubuntu");

    expect(ubuntu).toBeDefined();
    if (ubuntu === undefined) return;

    expect(resolveBackendPath({ backend: ubuntu, path: "D:\\Work Dir\\repo" })).toEqual({
      hostPath: "D:\\Work Dir\\repo",
      backendPath: "/mnt/d/Work Dir/repo",
    });
    expect(
      resolveBackendPath({ backend: ubuntu, path: "\\\\wsl$\\Ubuntu\\home\\jay\\repo" }),
    ).toEqual({
      hostPath: "\\\\wsl$\\Ubuntu\\home\\jay\\repo",
      backendPath: "/home/jay/repo",
    });
    expect(resolveBackendPath({ backend: registry.host, path: "/mnt/c/Users/Jay/repo" })).toEqual({
      hostPath: "C:\\Users\\Jay\\repo",
      backendPath: "/mnt/c/Users/Jay/repo",
    });
  });
});
