import {
  type Backend,
  type BackendId,
  type BackendRegistry,
  type ExecutionEnvironmentDescriptor,
  makeBackendEnvironmentId,
  makeBackendId,
  makeWslDistroName,
} from "@jcode/contracts";

import {
  parseWslUncPath,
  resolveBackendPath,
  type ResolveBackendPathInput,
  type ResolvedBackendPath,
} from "./backendPathResolver";

export { resolveBackendPath } from "./backendPathResolver";
export type { ResolveBackendPathInput, ResolvedBackendPath } from "./backendPathResolver";

export type WslCommandResult =
  | { readonly ok: true; readonly stdout: string; readonly stderr: string }
  | { readonly ok: false; readonly stdout: string; readonly stderr: string };

export interface WslCommandRunner {
  (args: readonly string[]): Promise<WslCommandResult>;
}

export type BackendDiscoveryHost = {
  readonly environmentId: string;
  readonly label: string;
  readonly platform: ExecutionEnvironmentDescriptor["platform"];
  readonly serverVersion: string;
};

export type BackendDiscoveryInput = {
  readonly host: BackendDiscoveryHost;
  readonly wsl:
    | { readonly enabled: false }
    | { readonly enabled: true; readonly run: WslCommandRunner };
};

export type ResolveProjectBackendInput = {
  readonly registry: BackendRegistry;
  readonly workspaceRoot: string;
  readonly overrideBackendId?: BackendId | undefined;
};

function makeHostBackend(host: BackendDiscoveryHost): Backend {
  return {
    id: makeBackendId("host"),
    kind: "local",
    connection: { kind: "local" },
    descriptor: {
      environmentId: makeBackendEnvironmentId(host.environmentId),
      label: host.label,
      platform: host.platform,
      serverVersion: host.serverVersion,
      capabilities: { repositoryIdentity: true },
    },
    state: { kind: "healthy" },
  };
}

function backendIdForWslDistro(distro: string): BackendId {
  const normalized = distro
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return makeBackendId(`wsl-${normalized || "distro"}`);
}

function descriptorForWslDistro(input: {
  readonly distro: string;
  readonly serverVersion: string;
  readonly arch: ExecutionEnvironmentDescriptor["platform"]["arch"];
}): ExecutionEnvironmentDescriptor {
  const id = backendIdForWslDistro(input.distro);
  return {
    environmentId: makeBackendEnvironmentId(`${id}-env`),
    label: `WSL ${input.distro}`,
    platform: { os: "linux", arch: input.arch },
    serverVersion: input.serverVersion,
    capabilities: { repositoryIdentity: true },
  };
}

function makeWslBackend(input: {
  readonly distro: string;
  readonly serverVersion: string;
  readonly arch: ExecutionEnvironmentDescriptor["platform"]["arch"];
  readonly state: Backend["state"];
}): Backend {
  return {
    id: backendIdForWslDistro(input.distro),
    kind: "wsl",
    connection: { kind: "wsl-exe", distro: makeWslDistroName(input.distro) },
    descriptor: descriptorForWslDistro({
      distro: input.distro,
      serverVersion: input.serverVersion,
      arch: input.arch,
    }),
    state: input.state,
  };
}

function makeRemovedWslBackend(input: {
  readonly distro: string;
  readonly serverVersion: string;
}): Backend {
  return makeWslBackend({
    distro: input.distro,
    serverVersion: input.serverVersion,
    arch: "other",
    state: { kind: "removed", reason: `WSL distro ${input.distro} is not registered.` },
  });
}

function parseWslListOutput(stdout: string): readonly string[] {
  const seen = new Set<string>();
  const distros: string[] = [];
  for (const rawLine of stdout
    .replace(/\u0000/g, "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)) {
    const distro = rawLine.trim();
    const lower = distro.toLowerCase();
    if (distro.length === 0) continue;
    if (/[\u0000-\u001f\u007f]/.test(distro)) continue;
    if (lower.startsWith("windows subsystem")) continue;
    if (lower.includes("error")) continue;
    if (seen.has(distro)) continue;
    seen.add(distro);
    distros.push(distro);
  }
  return distros;
}

function platformArchFromUname(stdout: string): ExecutionEnvironmentDescriptor["platform"]["arch"] {
  const arch = stdout.trim().toLowerCase();
  if (arch === "x86_64" || arch === "amd64") return "x64";
  if (arch === "aarch64" || arch === "arm64") return "arm64";
  return "other";
}

async function discoverWslBackend(input: {
  readonly distro: string;
  readonly serverVersion: string;
  readonly run: WslCommandRunner;
}): Promise<Backend> {
  const probe = await input.run(["-d", input.distro, "--", "uname", "-m"]);
  if (!probe.ok) {
    return makeWslBackend({
      distro: input.distro,
      serverVersion: input.serverVersion,
      arch: "other",
      state: {
        kind: "degraded",
        reason: probe.stderr.trim() || `WSL distro ${input.distro} did not respond.`,
      },
    });
  }

  return makeWslBackend({
    distro: input.distro,
    serverVersion: input.serverVersion,
    arch: platformArchFromUname(probe.stdout),
    state: { kind: "healthy" },
  });
}

export async function discoverBackends(input: BackendDiscoveryInput): Promise<BackendRegistry> {
  const host = makeHostBackend(input.host);
  if (!input.wsl.enabled) return { host, backends: [host] };

  const list = await input.wsl.run(["--list", "--quiet"]);
  if (!list.ok) return { host, backends: [host] };

  const backends: Backend[] = [host];
  for (const distro of parseWslListOutput(list.stdout)) {
    backends.push(
      await discoverWslBackend({
        distro,
        serverVersion: input.host.serverVersion,
        run: input.wsl.run,
      }),
    );
  }
  return { host, backends };
}

function findBackendById(registry: BackendRegistry, id: BackendId): Backend | null {
  return registry.backends.find((backend) => backend.id === id) ?? null;
}

function findWslBackendByDistro(registry: BackendRegistry, distro: string): Backend | null {
  const normalized = distro.toLowerCase();
  return (
    registry.backends.find(
      (backend) =>
        backend.connection.kind === "wsl-exe" &&
        String(backend.connection.distro).toLowerCase() === normalized,
    ) ?? null
  );
}

export function resolveProjectBackend(input: ResolveProjectBackendInput) {
  if (input.overrideBackendId !== undefined) {
    const overrideBackend = findBackendById(input.registry, input.overrideBackendId);
    const backend = overrideBackend ?? input.registry.host;
    const paths = resolveBackendPath({ backend, path: input.workspaceRoot });
    return { backend, workspaceRoot: input.workspaceRoot, ...paths, source: "override" };
  }

  const wslUnc = parseWslUncPath(input.workspaceRoot);
  if (wslUnc !== null) {
    const backend =
      findWslBackendByDistro(input.registry, wslUnc.distro) ??
      makeRemovedWslBackend({
        distro: wslUnc.distro,
        serverVersion: input.registry.host.descriptor.serverVersion,
      });
    const paths = resolveBackendPath({ backend, path: input.workspaceRoot });
    return { backend, workspaceRoot: input.workspaceRoot, ...paths, source: "path" };
  }

  const paths = resolveBackendPath({ backend: input.registry.host, path: input.workspaceRoot });
  return {
    backend: input.registry.host,
    workspaceRoot: input.workspaceRoot,
    ...paths,
    source: "default",
  };
}
