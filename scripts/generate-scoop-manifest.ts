#!/usr/bin/env node
// FILE: generate-scoop-manifest.ts
// Purpose: Generates a concrete Scoop manifest for a published JCode Windows release asset.
// Layer: Release/package-manager helper

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_REPOSITORY = "Jay1/jcode";

export interface CreateScoopManifestInput {
  readonly hash: string;
  readonly repository?: string;
  readonly version: string;
}

function assertVersion(version: string): void {
  if (!/^[0-9]+\.[0-9]+\.[0-9]+(?:[.-][0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`Invalid version: ${version}`);
  }
}

function assertSha256(hash: string): void {
  if (!/^[a-fA-F0-9]{64}$/.test(hash)) {
    throw new Error("Expected a 64-character SHA256 hash.");
  }
}

function assertRepository(repository: string): void {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error(`Invalid GitHub repository slug: ${repository}`);
  }
}

function buildWindowsInstallerUrl(repository: string, version: string): string {
  return `https://github.com/${repository}/releases/download/v${version}/JCode-${version}-x64.exe`;
}

export function createScoopManifest(input: CreateScoopManifestInput): string {
  const repository = input.repository ?? DEFAULT_REPOSITORY;
  assertRepository(repository);
  assertVersion(input.version);
  assertSha256(input.hash);

  const manifest = {
    version: input.version,
    description: "Local cockpit for coding agents tuned for low-level and cybersecurity workflows.",
    homepage: `https://github.com/${repository}`,
    license: "MIT",
    architecture: {
      "64bit": {
        url: buildWindowsInstallerUrl(repository, input.version),
        hash: input.hash.toLowerCase(),
      },
    },
    installer: {
      script: [`Start-Process \"$dir\\$fname\" -ArgumentList @('/S', \"/D=$dir\") -Wait`],
    },
    uninstaller: {
      script: [
        'if (Test-Path "$dir\\Uninstall JCode.exe") {',
        "  Start-Process \"$dir\\Uninstall JCode.exe\" -ArgumentList '/S' -Wait",
        "}",
      ],
    },
    checkver: {
      github: `https://github.com/${repository}`,
    },
    autoupdate: {
      architecture: {
        "64bit": {
          url: `https://github.com/${repository}/releases/download/v$version/JCode-$version-x64.exe`,
        },
      },
    },
  };

  return `${JSON.stringify(manifest, null, 2)}\n`;
}

interface CliOptions {
  readonly hash: string;
  readonly output: string;
  readonly repository: string;
  readonly version: string;
}

function readCliOptions(args: ReadonlyArray<string>): CliOptions {
  const options = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key?.startsWith("--") || !value) {
      throw new Error(
        "Usage: node scripts/generate-scoop-manifest.ts --version X.Y.Z --hash SHA256 [--output packaging/scoop/jcode.json] [--repository owner/repo]",
      );
    }
    options.set(key, value);
  }

  const version = options.get("--version");
  const hash = options.get("--hash");
  if (!version || !hash) {
    throw new Error("Missing required --version or --hash option.");
  }

  return {
    version,
    hash,
    repository: options.get("--repository") ?? DEFAULT_REPOSITORY,
    output: options.get("--output") ?? "packaging/scoop/jcode.json",
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const options = readCliOptions(process.argv.slice(2));
    mkdirSync(dirname(options.output), { recursive: true });
    writeFileSync(
      options.output,
      createScoopManifest({
        hash: options.hash,
        repository: options.repository,
        version: options.version,
      }),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
