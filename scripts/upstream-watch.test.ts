import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  filterUpdatedPullRequests,
  filterPublishedReleases,
  createGitHubApiClient,
  runUpstreamWatch,
  type GitHubPullRequestSummary,
  type GitHubReleaseSummary,
} from "./upstream-watch.ts";

const upstream = { name: "example", repository: "owner/repo" };
const originalFetch = globalThis.fetch;

const pullRequests: GitHubPullRequestSummary[] = [
  {
    number: 2,
    title: "Newer PR",
    state: "open",
    updatedAt: "2026-05-24T12:00:00Z",
    mergedAt: null,
    author: "alice",
    labels: ["feature"],
    url: "https://github.com/owner/repo/pull/2",
    baseRef: "main",
    headRef: "feature/newer",
  },
  {
    number: 1,
    title: "Older PR",
    state: "closed",
    updatedAt: "2026-05-20T12:00:00Z",
    mergedAt: "2026-05-21T12:00:00Z",
    author: "bob",
    labels: [],
    url: "https://github.com/owner/repo/pull/1",
    baseRef: "main",
    headRef: "feature/older",
  },
];

const releases: GitHubReleaseSummary[] = [
  {
    tagName: "v2.0.0",
    name: "Version 2",
    publishedAt: "2026-05-24T13:00:00Z",
    author: "alice",
    prerelease: false,
    url: "https://github.com/owner/repo/releases/tag/v2.0.0",
  },
  {
    tagName: "v1.0.0",
    name: "Version 1",
    publishedAt: "2026-05-20T13:00:00Z",
    author: "bob",
    prerelease: false,
    url: "https://github.com/owner/repo/releases/tag/v1.0.0",
  },
];

describe("upstream-watch", () => {
  let tempRoot: string | null = null;

  afterEach(() => {
    if (tempRoot) {
      rmSync(tempRoot, { force: true, recursive: true });
      tempRoot = null;
    }
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: originalFetch,
      writable: true,
    });
  });

  it("filters pull requests by updated cursor", () => {
    expect(filterUpdatedPullRequests(pullRequests, "2026-05-22T00:00:00Z")).toEqual([
      pullRequests[0],
    ]);
  });

  it("filters releases by published cursor", () => {
    expect(filterPublishedReleases(releases, "2026-05-22T00:00:00Z")).toEqual([releases[0]]);
  });

  it("uses an abort signal for GitHub API requests", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return new Response(
        JSON.stringify([
          {
            number: 1,
            title: "Watched PR",
            state: "open",
            updated_at: "2026-05-24T12:00:00Z",
            merged_at: null,
            html_url: "https://github.com/owner/repo/pull/1",
            user: { login: "alice" },
            labels: [],
            base: { ref: "main" },
            head: { ref: "feature/watched" },
          },
        ]),
      );
    });
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: fetchMock,
      writable: true,
    });

    const client = createGitHubApiClient({ token: "token" });

    await expect(client.fetchPullRequests(upstream)).resolves.toHaveLength(1);
  });

  it("throws a clear error when GitHub API requests time out", async () => {
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      value: vi.fn(async () => {
        throw new DOMException("The operation timed out.", "TimeoutError");
      }),
      writable: true,
    });

    const client = createGitHubApiClient({ token: "token" });

    await expect(client.fetchPullRequests(upstream)).rejects.toThrow("GitHub request timed out");
  });

  it("does not write state during dry run", async () => {
    tempRoot = mkdtempSync(join(tmpdir(), "jcode-upstream-watch-test-"));
    const stateDir = join(tempRoot, "state");

    const result = await runUpstreamWatch({
      clock: () => "2026-05-24T14:00:00Z",
      dryRun: true,
      githubClient: {
        fetchPullRequests: async () => pullRequests,
        fetchReleases: async () => releases,
      },
      stateDir,
      upstreams: [upstream],
    });

    expect(result.deltas[0]?.pullRequests).toHaveLength(2);
    expect(result.deltas[0]?.releases).toHaveLength(2);
    expect(existsSync(stateDir)).toBe(false);
  });

  it("advances cursors and suppresses duplicate deltas on the next run", async () => {
    tempRoot = mkdtempSync(join(tmpdir(), "jcode-upstream-watch-test-"));
    const stateDir = join(tempRoot, "state");
    const client = {
      fetchPullRequests: async () => pullRequests,
      fetchReleases: async () => releases,
    };

    const firstRun = await runUpstreamWatch({
      clock: () => "2026-05-24T14:00:00Z",
      githubClient: client,
      stateDir,
      upstreams: [upstream],
    });
    const secondRun = await runUpstreamWatch({
      clock: () => "2026-05-24T15:00:00Z",
      githubClient: client,
      stateDir,
      upstreams: [upstream],
    });

    expect(firstRun.deltas[0]?.pullRequests).toHaveLength(2);
    expect(firstRun.deltas[0]?.releases).toHaveLength(2);
    expect(secondRun.deltas[0]?.pullRequests).toHaveLength(0);
    expect(secondRun.deltas[0]?.releases).toHaveLength(0);

    const state = JSON.parse(readFileSync(join(stateDir, "state.json"), "utf8"));
    expect(state.upstreams.example.prCursor).toBe("2026-05-24T12:00:00.000Z");
    expect(state.upstreams.example.releaseCursor).toBe("2026-05-24T13:00:00.000Z");
  });
});
