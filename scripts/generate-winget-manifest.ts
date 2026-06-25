#!/usr/bin/env node
// FILE: generate-winget-manifest.ts
// Purpose: Generates concrete Winget manifest YAML files for a published JCode Windows release asset.
// Layer: Release/package-manager helper

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_REPOSITORY = "Jay1/jcode";

export interface CreateWingetManifestInput {
  readonly hash: string;
  readonly releaseDate: string;
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

export function createWingetVersionManifest(input: CreateWingetManifestInput): string {
  const repository = input.repository ?? DEFAULT_REPOSITORY;
  assertRepository(repository);
  assertVersion(input.version);

  return (
    [
      `PackageIdentifier: ${repositoryToWingetId(repository)}`,
      `PackageVersion: "${input.version}"`,
      "DefaultLocale: en-US",
      "ManifestType: version",
      "ManifestVersion: 1.10.0",
    ].join("\n") + "\n"
  );
}

export function createWingetInstallerManifest(input: CreateWingetManifestInput): string {
  const repository = input.repository ?? DEFAULT_REPOSITORY;
  assertRepository(repository);
  assertVersion(input.version);
  assertSha256(input.hash);

  return (
    [
      `PackageIdentifier: ${repositoryToWingetId(repository)}`,
      `PackageVersion: "${input.version}"`,
      "InstallerLocale: en-US",
      "InstallerType: nullsoft",
      "InstallModes:",
      "  - interactive",
      "  - silent",
      "InstallerSwitches:",
      "  Silent: /S",
      "  SilentWithProgress: /S",
      "UpgradeBehavior: install",
      `ReleaseDate: "${input.releaseDate}"`,
      "Installers:",
      "  - Architecture: x64",
      `    InstallerUrl: "${buildWindowsInstallerUrl(repository, input.version)}"`,
      `    InstallerSha256: ${input.hash.toUpperCase()}`,
      "ManifestType: installer",
      "ManifestVersion: 1.10.0",
    ].join("\n") + "\n"
  );
}

export function createWingetLocaleManifest(input: CreateWingetManifestInput): string {
  const repository = input.repository ?? DEFAULT_REPOSITORY;
  assertRepository(repository);
  assertVersion(input.version);

  const [owner] = repository.split("/");

  return (
    [
      `PackageIdentifier: ${repositoryToWingetId(repository)}`,
      `PackageVersion: "${input.version}"`,
      "PackageLocale: en-US",
      `Publisher: ${owner}`,
      `PublisherUrl: https://github.com/${owner}`,
      "PackageName: JCode",
      `PackageUrl: https://github.com/${repository}`,
      "License: MIT",
      `LicenseUrl: https://github.com/${repository}/blob/main/LICENSE`,
      "ShortDescription: Local cockpit for coding agents.",
      "Description: JCode is a local cockpit for coding agents, built around OpenCode with a web UI, desktop packaging, and a local server for managing coding-agent sessions.",
      "Moniker: jcode",
      "Tags:",
      "  - agent",
      "  - coding-agent",
      "  - developer-tools",
      "  - opencode",
      "ManifestType: defaultLocale",
      "ManifestVersion: 1.10.0",
    ].join("\n") + "\n"
  );
}

const WINGET_ID = "Jay1.JCode";

export function repositoryToWingetId(repository: string): string {
  if (repository === DEFAULT_REPOSITORY) return WINGET_ID;
  const [owner, repo] = repository.split("/");
  if (!owner || !repo || repository.split("/").length !== 2) {
    throw new Error(`Invalid GitHub repository slug: ${repository}`);
  }
  const pascalRepo = repo.slice(0, 1).toUpperCase() + repo.slice(1);
  return `${owner}.${pascalRepo}`;
}

interface CliOptions {
  readonly hash: string;
  readonly output: string;
  readonly releaseDate: string;
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
        "Usage: node scripts/generate-winget-manifest.ts --version X.Y.Z --hash SHA256 --release-date YYYY-MM-DD [--output packaging/winget/Jay1.JCode] [--repository owner/repo]",
      );
    }
    options.set(key, value);
  }

  const version = options.get("--version");
  const hash = options.get("--hash");
  const releaseDate = options.get("--release-date");
  if (!version || !hash || !releaseDate) {
    throw new Error("Missing required --version, --hash, or --release-date option.");
  }

  return {
    version,
    hash,
    releaseDate,
    repository: options.get("--repository") ?? DEFAULT_REPOSITORY,
    output:
      options.get("--output") ??
      `packaging/winget/${repositoryToWingetId(options.get("--repository") ?? DEFAULT_REPOSITORY)}`,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const options = readCliOptions(process.argv.slice(2));
    const input: CreateWingetManifestInput = {
      hash: options.hash,
      releaseDate: options.releaseDate,
      repository: options.repository,
      version: options.version,
    };
    const wingetId = repositoryToWingetId(options.repository);

    const versionPath = join(options.output, `${wingetId}.yaml`);
    const installerPath = join(options.output, `${wingetId}.installer.yaml`);
    const localePath = join(options.output, `${wingetId}.locale.en-US.yaml`);

    mkdirSync(dirname(versionPath), { recursive: true });

    writeFileSync(versionPath, createWingetVersionManifest(input));
    writeFileSync(installerPath, createWingetInstallerManifest(input));
    writeFileSync(localePath, createWingetLocaleManifest(input));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
