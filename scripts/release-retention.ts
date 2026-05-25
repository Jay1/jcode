#!/usr/bin/env node
// FILE: release-retention.ts
// Purpose: Plans and applies GitHub Release pruning for JCode's latest-package retention policy.
// Layer: Release automation script
// Depends on: GitHub Releases API data provided by the release workflow.

import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export interface GitHubReleaseSummary {
  readonly id: number;
  readonly tagName: string;
  readonly draft: boolean;
  readonly prerelease: boolean;
  readonly publishedAt: string | null;
}

export interface ReleasePrunePlan {
  readonly keep: readonly GitHubReleaseSummary[];
  readonly delete: readonly GitHubReleaseSummary[];
}

function releaseTimestamp(release: GitHubReleaseSummary): number {
  return release.publishedAt ? Date.parse(release.publishedAt) : 0;
}

function latestRelease(
  releases: readonly GitHubReleaseSummary[],
): GitHubReleaseSummary | undefined {
  return [...releases].sort((a, b) => releaseTimestamp(b) - releaseTimestamp(a))[0];
}

export function planGitHubReleasePrune(input: {
  readonly currentTag: string;
  readonly releases: readonly GitHubReleaseSummary[];
}): ReleasePrunePlan {
  const drafts = input.releases.filter((release) => release.draft);
  const published = input.releases.filter((release) => !release.draft);
  const latestStable = latestRelease(published.filter((release) => !release.prerelease));
  const latestPrerelease = latestRelease(published.filter((release) => release.prerelease));
  const keepIds = new Set(drafts.map((release) => release.id));

  const current = published.find((release) => release.tagName === input.currentTag);
  if (current) keepIds.add(current.id);
  if (latestStable) keepIds.add(latestStable.id);
  if (latestPrerelease) keepIds.add(latestPrerelease.id);

  return {
    keep: input.releases.filter((release) => keepIds.has(release.id)),
    delete: input.releases.filter((release) => !keepIds.has(release.id)),
  };
}

function parseReleaseLine(line: string): GitHubReleaseSummary | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const [id, tagName, draft, prerelease, publishedAt] = trimmed.split("\t");
  if (!id || !tagName || !draft || !prerelease) throw new Error(`Invalid release row: ${line}`);
  return {
    id: Number.parseInt(id, 10),
    tagName,
    draft: draft === "true",
    prerelease: prerelease === "true",
    publishedAt: publishedAt && publishedAt !== "null" ? publishedAt : null,
  };
}

function gh(args: readonly string[], input?: string): string {
  const result = spawnSync("gh", args, { encoding: "utf8", input });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `gh ${args.join(" ")} failed`);
  }
  return result.stdout;
}

function loadGitHubReleases(repository: string): GitHubReleaseSummary[] {
  const output = gh([
    "api",
    "--paginate",
    `repos/${repository}/releases`,
    "--jq",
    ".[] | [.id, .tag_name, .draft, .prerelease, .published_at] | @tsv",
  ]);
  return output
    .split("\n")
    .map(parseReleaseLine)
    .filter((release): release is GitHubReleaseSummary => release !== null);
}

export function runReleaseRetentionCli(): void {
  const repository = process.env.GITHUB_REPOSITORY;
  const currentTag = process.env.CURRENT_TAG;
  if (!repository) throw new Error("GITHUB_REPOSITORY is required");
  if (!currentTag) throw new Error("CURRENT_TAG is required");

  const plan = planGitHubReleasePrune({ currentTag, releases: loadGitHubReleases(repository) });
  for (const release of plan.keep) {
    console.log(`Keeping release ${release.tagName} (${release.id})`);
  }
  for (const release of plan.delete) {
    console.log(`Deleting older release ${release.tagName} (${release.id})`);
    gh(["api", "--method", "DELETE", `repos/${repository}/releases/${release.id}`]);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    runReleaseRetentionCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
