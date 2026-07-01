import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { Backend, BackendRegistry, ProjectBackendResolution } from "./backend";

const hostBackend = {
  id: "host",
  kind: "local",
  connection: { kind: "local" },
  descriptor: {
    environmentId: "host-env",
    label: "Windows host",
    platform: { os: "windows", arch: "x64" },
    serverVersion: "0.0.50",
    capabilities: { repositoryIdentity: true },
  },
  state: { kind: "healthy" },
};

describe("Backend contracts", () => {
  it("decodes host and WSL backend registry contracts", () => {
    const registry = Schema.decodeUnknownSync(BackendRegistry)({
      host: hostBackend,
      backends: [
        hostBackend,
        {
          id: "wsl-ubuntu",
          kind: "wsl",
          connection: { kind: "wsl-exe", distro: "Ubuntu" },
          descriptor: {
            environmentId: "wsl-ubuntu-env",
            label: "WSL Ubuntu",
            platform: { os: "linux", arch: "x64" },
            serverVersion: "0.0.50",
            capabilities: { repositoryIdentity: true },
          },
          state: { kind: "healthy" },
        },
      ],
    });

    expect(registry.host.id).toBe("host");
    expect(registry.backends[1]?.connection).toEqual({ kind: "wsl-exe", distro: "Ubuntu" });
  });

  it("decodes removed project backend resolution for missing WSL distros", () => {
    const removedBackend = Schema.decodeUnknownSync(Backend)({
      id: "wsl-ghost",
      kind: "wsl",
      connection: { kind: "wsl-exe", distro: "Ghost" },
      descriptor: {
        environmentId: "wsl-ghost-env",
        label: "WSL Ghost",
        platform: { os: "linux", arch: "other" },
        serverVersion: "0.0.50",
        capabilities: { repositoryIdentity: false },
      },
      state: { kind: "removed", reason: "WSL distro Ghost is not registered." },
    });

    const resolution = Schema.decodeUnknownSync(ProjectBackendResolution)({
      backend: removedBackend,
      workspaceRoot: "\\\\wsl$\\Ghost\\home\\jay\\project",
      backendPath: "/home/jay/project",
      hostPath: "\\\\wsl$\\Ghost\\home\\jay\\project",
      source: "path",
    });

    expect(resolution.backend.state.kind).toBe("removed");
    expect(resolution.backendPath).toBe("/home/jay/project");
  });

  it("rejects backend contracts with mismatched kind and connection", () => {
    expect(() =>
      Schema.decodeUnknownSync(Backend)({
        ...hostBackend,
        kind: "local",
        connection: { kind: "wsl-exe", distro: "Ubuntu" },
      }),
    ).toThrow();
  });
});
