// FILE: upstream-watch.ts
// Purpose: Tracks local-only DPCode/T3Code PR and release deltas for manual upstream review.
// Layer: Repository automation script

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface UpstreamRepositoryConfig {
  readonly name: string;
  readonly repository: string;
}

export interface GitHubPullRequestSummary {
  readonly number: number;
  readonly title: string;
  readonly state: string;
  readonly updatedAt: string;
  readonly mergedAt: string | null;
  readonly author: string;
  readonly labels: string[];
  readonly url: string;
  readonly baseRef: string;
  readonly headRef: string;
}

export interface GitHubReleaseSummary {
  readonly tagName: string;
  readonly name: string;
  readonly publishedAt: string;
  readonly author: string;
  readonly prerelease: boolean;
  readonly url: string;
}

export interface GitHubUpstreamClient {
  fetchPullRequests(upstream: UpstreamRepositoryConfig): Promise<GitHubPullRequestSummary[]>;
  fetchReleases(upstream: UpstreamRepositoryConfig): Promise<GitHubReleaseSummary[]>;
}

interface UpstreamCursorState {
  readonly prCursor?: string | null;
  readonly releaseCursor?: string | null;
}

interface UpstreamWatchState {
  readonly schemaVersion: 1;
  readonly lastRunAt?: string;
  readonly upstreams: Record<string, UpstreamCursorState>;
}

export interface UpstreamDelta {
  readonly upstream: UpstreamRepositoryConfig;
  readonly pullRequests: GitHubPullRequestSummary[];
  readonly releases: GitHubReleaseSummary[];
}

export interface RunUpstreamWatchOptions {
  readonly clock?: () => string;
  readonly dryRun?: boolean;
  readonly githubClient?: GitHubUpstreamClient;
  readonly since?: string;
  readonly stateDir?: string;
  readonly upstreams?: readonly UpstreamRepositoryConfig[];
}

export interface RunUpstreamWatchResult {
  readonly deltas: UpstreamDelta[];
  readonly report: string;
  readonly wroteState: boolean;
}

const DEFAULT_UPSTREAMS: readonly UpstreamRepositoryConfig[] = [
  { name: "dpcode", repository: "Emanuele-web04/dpcode" },
  { name: "t3code", repository: "pingdotgg/t3code" },
] as const;

const STATE_SCHEMA_VERSION = 1;
const GITHUB_REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_STATE_DIR = resolve(process.cwd(), ".jcode/upstream-watch");

function normalizeIsoTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid timestamp: ${timestamp}`);
  }
  return date.toISOString();
}

function isAfterCursor(timestamp: string, cursor: string | null | undefined): boolean {
  if (!cursor) return true;
  return Date.parse(timestamp) > Date.parse(cursor);
}

function maxIsoTimestamp(timestamps: ReadonlyArray<string>): string | null {
  let maxTime = Number.NEGATIVE_INFINITY;
  for (const timestamp of timestamps) {
    const time = Date.parse(timestamp);
    if (!Number.isNaN(time) && time > maxTime) {
      maxTime = time;
    }
  }
  return maxTime === Number.NEGATIVE_INFINITY ? null : new Date(maxTime).toISOString();
}

export function filterUpdatedPullRequests(
  pullRequests: ReadonlyArray<GitHubPullRequestSummary>,
  cursor: string | null | undefined,
): GitHubPullRequestSummary[] {
  return pullRequests.filter((pullRequest) => isAfterCursor(pullRequest.updatedAt, cursor));
}

export function filterPublishedReleases(
  releases: ReadonlyArray<GitHubReleaseSummary>,
  cursor: string | null | undefined,
): GitHubReleaseSummary[] {
  return releases.filter((release) => isAfterCursor(release.publishedAt, cursor));
}

function defaultState(): UpstreamWatchState {
  return { schemaVersion: STATE_SCHEMA_VERSION, upstreams: {} };
}

function readState(stateDir: string): UpstreamWatchState {
  const statePath = join(stateDir, "state.json");
  if (!existsSync(statePath)) {
    return defaultState();
  }
  const parsed = JSON.parse(readFileSync(statePath, "utf8")) as Partial<UpstreamWatchState>;
  if (parsed.schemaVersion !== STATE_SCHEMA_VERSION || typeof parsed.upstreams !== "object") {
    throw new Error(`Unsupported upstream watch state in ${statePath}`);
  }
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    upstreams: parsed.upstreams ?? {},
    ...(parsed.lastRunAt ? { lastRunAt: parsed.lastRunAt } : {}),
  };
}

function writeState(stateDir: string, state: UpstreamWatchState): void {
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(join(stateDir, "state.json"), `${JSON.stringify(state, null, 2)}\n`);
}

function writeRunLog(stateDir: string, runAt: string, deltas: ReadonlyArray<UpstreamDelta>): void {
  const runsDir = join(stateDir, "runs");
  mkdirSync(runsDir, { recursive: true });
  const safeRunAt = runAt.replace(/[:.]/g, "-");
  writeFileSync(
    join(runsDir, `${safeRunAt}.json`),
    `${JSON.stringify({ schemaVersion: STATE_SCHEMA_VERSION, runAt, deltas }, null, 2)}\n`,
  );
}

function advanceState(
  previousState: UpstreamWatchState,
  deltas: ReadonlyArray<UpstreamDelta>,
  fetched: ReadonlyMap<
    string,
    { pullRequests: GitHubPullRequestSummary[]; releases: GitHubReleaseSummary[] }
  >,
  runAt: string,
): UpstreamWatchState {
  const nextUpstreams: Record<string, UpstreamCursorState> = { ...previousState.upstreams };
  for (const delta of deltas) {
    const current = nextUpstreams[delta.upstream.name] ?? {};
    const fetchedItems = fetched.get(delta.upstream.name);
    const prCursor = maxIsoTimestamp(
      fetchedItems?.pullRequests.map((item) => item.updatedAt) ?? [],
    );
    const releaseCursor = maxIsoTimestamp(
      fetchedItems?.releases.map((item) => item.publishedAt) ?? [],
    );
    nextUpstreams[delta.upstream.name] = {
      prCursor: prCursor ?? current.prCursor ?? null,
      releaseCursor: releaseCursor ?? current.releaseCursor ?? null,
    };
  }
  return { schemaVersion: STATE_SCHEMA_VERSION, lastRunAt: runAt, upstreams: nextUpstreams };
}

function formatLabels(labels: ReadonlyArray<string>): string {
  return labels.length > 0 ? labels.join(", ") : "none";
}

export function formatUpstreamWatchReport(input: {
  readonly deltas: ReadonlyArray<UpstreamDelta>;
  readonly dryRun: boolean;
  readonly runAt: string;
  readonly since?: string;
}): string {
  const lines = [
    "Upstream Watch Delta Report",
    `Generated: ${input.runAt}`,
    `Mode: ${input.dryRun ? "dry-run" : "advance-cursors"}`,
  ];
  if (input.since) {
    lines.push(`Since override: ${normalizeIsoTimestamp(input.since)}`);
  }
  lines.push("");

  for (const delta of input.deltas) {
    lines.push(`${delta.upstream.name} (${delta.upstream.repository})`);
    lines.push(`Pull requests: ${delta.pullRequests.length}`);
    for (const pullRequest of delta.pullRequests) {
      lines.push(
        `- #${pullRequest.number} ${pullRequest.title} [${pullRequest.state}] updated ${normalizeIsoTimestamp(
          pullRequest.updatedAt,
        )} merged ${pullRequest.mergedAt ? normalizeIsoTimestamp(pullRequest.mergedAt) : "no"} by @${
          pullRequest.author
        } labels: ${formatLabels(pullRequest.labels)} base/head: ${pullRequest.baseRef} <- ${
          pullRequest.headRef
        } ${pullRequest.url}`,
      );
    }
    lines.push(`Releases: ${delta.releases.length}`);
    for (const release of delta.releases) {
      lines.push(
        `- ${release.tagName} ${release.name} published ${normalizeIsoTimestamp(release.publishedAt)} by @${
          release.author
        }${release.prerelease ? " prerelease" : ""} ${release.url}`,
      );
    }
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

export async function runUpstreamWatch(
  options: RunUpstreamWatchOptions = {},
): Promise<RunUpstreamWatchResult> {
  const runAt = normalizeIsoTimestamp(options.clock?.() ?? new Date().toISOString());
  const dryRun = options.dryRun === true || options.since !== undefined;
  const stateDir = resolve(options.stateDir ?? DEFAULT_STATE_DIR);
  const upstreams = options.upstreams ?? DEFAULT_UPSTREAMS;
  const githubClient = options.githubClient ?? createGitHubApiClient();
  const state = readState(stateDir);
  const fetched = new Map<
    string,
    { pullRequests: GitHubPullRequestSummary[]; releases: GitHubReleaseSummary[] }
  >();
  const deltas: UpstreamDelta[] = [];

  for (const upstream of upstreams) {
    const [pullRequests, releases] = await Promise.all([
      githubClient.fetchPullRequests(upstream),
      githubClient.fetchReleases(upstream),
    ]);
    fetched.set(upstream.name, { pullRequests, releases });
    const cursor = state.upstreams[upstream.name];
    const prCursor = options.since ? normalizeIsoTimestamp(options.since) : cursor?.prCursor;
    const releaseCursor = options.since
      ? normalizeIsoTimestamp(options.since)
      : cursor?.releaseCursor;
    deltas.push({
      upstream,
      pullRequests: filterUpdatedPullRequests(pullRequests, prCursor),
      releases: filterPublishedReleases(releases, releaseCursor),
    });
  }

  const report = formatUpstreamWatchReport({
    deltas,
    dryRun,
    runAt,
    ...(options.since ? { since: options.since } : {}),
  });
  if (dryRun) {
    return { deltas, report, wroteState: false };
  }

  const nextState = advanceState(state, deltas, fetched, runAt);
  writeState(stateDir, nextState);
  writeRunLog(stateDir, runAt, deltas);
  return { deltas, report, wroteState: true };
}

interface GitHubPullRequestApiResponse {
  readonly number: number;
  readonly title: string;
  readonly state: string;
  readonly updated_at: string;
  readonly merged_at: string | null;
  readonly html_url: string;
  readonly user: { readonly login?: string | null } | null;
  readonly labels: ReadonlyArray<{ readonly name?: string | null }>;
  readonly base: { readonly ref?: string | null };
  readonly head: { readonly ref?: string | null };
}

interface GitHubReleaseApiResponse {
  readonly tag_name: string;
  readonly name: string | null;
  readonly published_at: string | null;
  readonly prerelease: boolean;
  readonly html_url: string;
  readonly author: { readonly login?: string | null } | null;
}

function splitRepository(repository: string): { owner: string; repo: string } {
  const [owner, repo] = repository.split("/");
  if (!owner || !repo) {
    throw new Error(`Invalid GitHub repository: ${repository}`);
  }
  return { owner, repo };
}

async function fetchGitHubJson<T>(url: string, token: string | undefined): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  let response: Response;
  try {
    response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(GITHUB_REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
      throw new Error(`GitHub request timed out for ${url}`);
    }
    throw error;
  }
  if (!response.ok) {
    throw new Error(`GitHub request failed: ${response.status} ${response.statusText} for ${url}`);
  }
  return (await response.json()) as T;
}

export function createGitHubApiClient(
  input: { readonly token?: string } = {},
): GitHubUpstreamClient {
  const token = input.token ?? process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  return {
    async fetchPullRequests(upstream) {
      const { owner, repo } = splitRepository(upstream.repository);
      const pullRequests = await fetchGitHubJson<GitHubPullRequestApiResponse[]>(
        `https://api.github.com/repos/${owner}/${repo}/pulls?state=all&sort=updated&direction=desc&per_page=50`,
        token,
      );
      return pullRequests.map((pullRequest) => ({
        number: pullRequest.number,
        title: pullRequest.title,
        state: pullRequest.state,
        updatedAt: normalizeIsoTimestamp(pullRequest.updated_at),
        mergedAt: pullRequest.merged_at ? normalizeIsoTimestamp(pullRequest.merged_at) : null,
        author: pullRequest.user?.login ?? "unknown",
        labels: pullRequest.labels.flatMap((label) => (label.name ? [label.name] : [])),
        url: pullRequest.html_url,
        baseRef: pullRequest.base.ref ?? "unknown",
        headRef: pullRequest.head.ref ?? "unknown",
      }));
    },
    async fetchReleases(upstream) {
      const { owner, repo } = splitRepository(upstream.repository);
      const releases = await fetchGitHubJson<GitHubReleaseApiResponse[]>(
        `https://api.github.com/repos/${owner}/${repo}/releases?per_page=50`,
        token,
      );
      return releases.flatMap((release) => {
        if (!release.published_at) return [];
        return [
          {
            tagName: release.tag_name,
            name: release.name ?? release.tag_name,
            publishedAt: normalizeIsoTimestamp(release.published_at),
            author: release.author?.login ?? "unknown",
            prerelease: release.prerelease,
            url: release.html_url,
          },
        ];
      });
    },
  };
}

function parseArgs(argv: ReadonlyArray<string>): { dryRun: boolean; since: string | undefined } {
  let dryRun = false;
  let since: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (argument === "--since") {
      since = argv[index + 1];
      if (!since) {
        throw new Error("Missing value for --since.");
      }
      index += 1;
      continue;
    }
    if (argument === "--help") {
      console.log("Usage: node scripts/upstream-watch.ts [--dry-run] [--since <iso-timestamp>]");
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${argument}`);
  }
  return { dryRun, since };
}

const isMain =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const options = parseArgs(process.argv.slice(2));
  runUpstreamWatch({
    dryRun: options.dryRun,
    ...(options.since ? { since: options.since } : {}),
  })
    .then((result) => {
      process.stdout.write(result.report);
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
