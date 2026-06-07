#!/usr/bin/env node
// FILE: update-package-manifests.ts
// Purpose: Downloads the Windows installer from a published GitHub release, computes SHA-256, and generates Scoop + Winget manifests.
// Layer: Release/package-manager orchestrator

import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import { createScoopManifest } from "./generate-scoop-manifest.ts";
import {
  createWingetInstallerManifest,
  createWingetLocaleManifest,
  createWingetVersionManifest,
  repositoryToWingetId,
} from "./generate-winget-manifest.ts";

const DEFAULT_REPOSITORY = "Jay1/jcode";

export interface UpdatePackageManifestsOptions {
  readonly outputDir?: string;
  readonly releaseDate: string;
  readonly repository?: string;
  readonly version: string;
}

export interface UpdatePackageManifestsResult {
  readonly hash: string;
  readonly scoopManifestPath: string;
  readonly wingetVersionPath: string;
  readonly wingetInstallerPath: string;
  readonly wingetLocalePath: string;
}

export function buildWindowsInstallerUrl(repository: string, version: string): string {
  return `https://github.com/${repository}/releases/download/v${version}/JCode-${version}-x64.exe`;
}

export async function computeSha256FromResponse(response: Response): Promise<string> {
  const hash = createHash("sha256");
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Response body is not readable.");
  }

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    hash.update(value);
  }

  return hash.digest("hex");
}

export async function updatePackageManifests(
  options: UpdatePackageManifestsOptions,
  fetchFn: typeof globalThis.fetch = globalThis.fetch,
): Promise<UpdatePackageManifestsResult> {
  const repository = options.repository ?? DEFAULT_REPOSITORY;
  const outputDir = options.outputDir ?? "packaging";

  const installerUrl = buildWindowsInstallerUrl(repository, options.version);
  const response = await fetchFn(installerUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to download Windows installer from ${installerUrl}: ${response.status} ${response.statusText}`,
    );
  }

  const hash = await computeSha256FromResponse(response);

  const manifestInput = {
    hash,
    releaseDate: options.releaseDate,
    repository,
    version: options.version,
  };

  const scoopDir = join(outputDir, "scoop");
  const wingetId = repositoryToWingetId(repository);
  const wingetDir = join(outputDir, "winget", wingetId);

  const scoopManifestPath = join(scoopDir, "jcode.json");
  mkdirSync(dirname(scoopManifestPath), { recursive: true });
  writeFileSync(scoopManifestPath, createScoopManifest(manifestInput));

  const wingetVersionPath = join(wingetDir, `${wingetId}.yaml`);
  const wingetInstallerPath = join(wingetDir, `${wingetId}.installer.yaml`);
  const wingetLocalePath = join(wingetDir, `${wingetId}.locale.en-US.yaml`);

  mkdirSync(dirname(wingetVersionPath), { recursive: true });
  writeFileSync(wingetVersionPath, createWingetVersionManifest(manifestInput));
  writeFileSync(wingetInstallerPath, createWingetInstallerManifest(manifestInput));
  writeFileSync(wingetLocalePath, createWingetLocaleManifest(manifestInput));

  return {
    hash,
    scoopManifestPath,
    wingetInstallerPath,
    wingetLocalePath,
    wingetVersionPath,
  };
}

interface CliOptions {
  readonly outputDir: string;
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
        "Usage: node scripts/update-package-manifests.ts --version X.Y.Z --release-date YYYY-MM-DD [--output-dir packaging] [--repository owner/repo]",
      );
    }
    options.set(key, value);
  }

  const version = options.get("--version");
  const releaseDate = options.get("--release-date");
  if (!version || !releaseDate) {
    throw new Error("Missing required --version or --release-date option.");
  }

  return {
    version,
    releaseDate,
    outputDir: options.get("--output-dir") ?? "packaging",
    repository: options.get("--repository") ?? DEFAULT_REPOSITORY,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const cliOptions = readCliOptions(process.argv.slice(2));
    const result = await updatePackageManifests(cliOptions);

    console.log(`SHA256: ${result.hash}`);
    console.log(`Scoop manifest: ${result.scoopManifestPath}`);
    console.log(`Winget version: ${result.wingetVersionPath}`);
    console.log(`Winget installer: ${result.wingetInstallerPath}`);
    console.log(`Winget locale: ${result.wingetLocalePath}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
