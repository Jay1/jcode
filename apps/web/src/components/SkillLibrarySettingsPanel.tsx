import { PROVIDER_DISPLAY_NAMES, type ProviderKind } from "@jcode/contracts";
import { useQuery } from "@tanstack/react-query";
import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { getProviderStartOptions, useAppSettings } from "../appSettings";
import { useFocusedChatContext } from "../focusedChatContext";
import { ListChecksIcon, SearchIcon } from "../lib/icons";
import { resolveProviderDiscoveryCwd } from "../lib/providerDiscovery";
import {
  providerComposerCapabilitiesQueryOptions,
  providerSkillsQueryOptions,
  supportsSkillDiscovery,
} from "../lib/providerDiscoveryReactQuery";
import {
  buildSkillLibraryRows,
  countSkillLibraryRowsByProvider,
  filterSkillLibraryRows,
  type SkillLibraryProviderFilter,
  type SkillLibraryRow,
} from "../lib/skillLibrary";
import { serverConfigQueryOptions } from "../lib/serverReactQuery";
import { cn } from "../lib/utils";
import { useStore } from "../store";
import { createFirstProjectSelector } from "../storeSelectors";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

type SkillLibraryDiscoveryProvider = Exclude<ProviderKind, "openclaw">;

type SkillLibraryDiscoveryProviderMap<T> = Record<SkillLibraryDiscoveryProvider, T>;

export function buildSkillLibraryProviderQueryMap<T>(
  queries: SkillLibraryDiscoveryProviderMap<T>,
): SkillLibraryDiscoveryProviderMap<T> {
  return queries;
}

export function buildSkillLibraryProviderStatusMap<T>(
  statuses: SkillLibraryDiscoveryProviderMap<T>,
): SkillLibraryDiscoveryProviderMap<T> {
  return statuses;
}

const PROVIDERS: readonly SkillLibraryDiscoveryProvider[] = [
  "codex",
  "claudeAgent",
  "cursor",
  "gemini",
  "kilo",
  "opencode",
  "pi",
];

function isSkillLibraryDiscoveryProvider(
  provider: SkillLibraryProviderFilter,
): provider is SkillLibraryDiscoveryProvider {
  return provider !== "all" && provider !== "openclaw";
}

const MAX_COLLAPSED_PROVIDER_ROWS = 48;

function getSkillTitle(row: SkillLibraryRow): string {
  return row.skill.interface?.displayName ?? row.skill.name;
}

function getSkillDescription(row: SkillLibraryRow): string {
  return (
    row.skill.interface?.shortDescription ?? row.skill.description ?? "No description available."
  );
}

function SkillGlyph({ provider }: { provider: ProviderKind }) {
  return (
    <span
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-linear-to-br from-foreground/18 to-foreground/5 shadow-xs"
      data-provider={provider}
    >
      <ListChecksIcon className="size-4.5 text-foreground/75" />
    </span>
  );
}

function SourceBadge({ row }: { row: SkillLibraryRow }) {
  return (
    <span className="inline-flex max-w-24 shrink-0 items-center truncate rounded-full border border-border/70 bg-background/70 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      {row.providerLabel}
    </span>
  );
}

function SkillRow({ row }: { row: SkillLibraryRow }) {
  return (
    <div className="group grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-3 px-4 py-3.5 transition-colors hover:bg-(--sidebar-accent)">
      <SkillGlyph provider={row.provider} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-[13px] font-semibold text-foreground">{getSkillTitle(row)}</p>
          <SourceBadge row={row} />
        </div>
        <p className="mt-1 line-clamp-2 wrap-break-word text-[12px] leading-5 text-muted-foreground">
          {getSkillDescription(row)}
        </p>
      </div>
    </div>
  );
}

export function SkillLibrarySettingsPanel() {
  const { settings } = useAppSettings();
  const providerOptions = useMemo(() => getProviderStartOptions(settings), [settings]);
  const firstProject = useStore(useMemo(() => createFirstProjectSelector(), []));
  const { activeProject: focusedProject, activeThread } = useFocusedChatContext();
  const activeProject = focusedProject ?? firstProject ?? null;

  const [query, setQuery] = useState("");
  const [providerFilter, setProviderFilter] = useState<SkillLibraryProviderFilter>("all");
  const [expandedProviders, setExpandedProviders] = useState<
    Partial<Record<ProviderKind, boolean>>
  >({});
  const deferredQuery = useDeferredValue(query);

  const serverConfigQuery = useQuery(serverConfigQueryOptions());
  const discoveryCwd = resolveProviderDiscoveryCwd({
    activeThreadWorktreePath: activeThread?.worktreePath ?? null,
    activeProjectCwd: activeProject?.cwd ?? null,
    serverCwd: serverConfigQuery.data?.cwd ?? null,
  });

  const codexCapabilitiesQuery = useQuery(providerComposerCapabilitiesQueryOptions("codex"));
  const claudeCapabilitiesQuery = useQuery(providerComposerCapabilitiesQueryOptions("claudeAgent"));
  const cursorCapabilitiesQuery = useQuery(providerComposerCapabilitiesQueryOptions("cursor"));
  const geminiCapabilitiesQuery = useQuery(providerComposerCapabilitiesQueryOptions("gemini"));
  const kiloCapabilitiesQuery = useQuery(providerComposerCapabilitiesQueryOptions("kilo"));
  const openCodeCapabilitiesQuery = useQuery(providerComposerCapabilitiesQueryOptions("opencode"));
  const piCapabilitiesQuery = useQuery(providerComposerCapabilitiesQueryOptions("pi"));

  const providerCanListSkills = useMemo<Record<ProviderKind, boolean>>(
    () => ({
      codex: supportsSkillDiscovery(codexCapabilitiesQuery.data),
      claudeAgent: supportsSkillDiscovery(claudeCapabilitiesQuery.data),
      cursor: supportsSkillDiscovery(cursorCapabilitiesQuery.data),
      gemini: supportsSkillDiscovery(geminiCapabilitiesQuery.data),
      kilo: supportsSkillDiscovery(kiloCapabilitiesQuery.data),
      opencode: supportsSkillDiscovery(openCodeCapabilitiesQuery.data),
      openclaw: false,
      pi: supportsSkillDiscovery(piCapabilitiesQuery.data),
    }),
    [
      claudeCapabilitiesQuery.data,
      codexCapabilitiesQuery.data,
      cursorCapabilitiesQuery.data,
      geminiCapabilitiesQuery.data,
      kiloCapabilitiesQuery.data,
      openCodeCapabilitiesQuery.data,
      piCapabilitiesQuery.data,
    ],
  );

  const codexSkillsQuery = useQuery(
    providerSkillsQueryOptions({
      provider: "codex",
      cwd: discoveryCwd,
      query: "",
      ...(providerOptions ? { providerOptions } : {}),
      enabled: providerCanListSkills.codex,
    }),
  );
  const claudeSkillsQuery = useQuery(
    providerSkillsQueryOptions({
      provider: "claudeAgent",
      cwd: discoveryCwd,
      query: "",
      enabled: providerCanListSkills.claudeAgent,
    }),
  );
  const cursorSkillsQuery = useQuery(
    providerSkillsQueryOptions({
      provider: "cursor",
      cwd: discoveryCwd,
      query: "",
      enabled: providerCanListSkills.cursor,
    }),
  );
  const geminiSkillsQuery = useQuery(
    providerSkillsQueryOptions({
      provider: "gemini",
      cwd: discoveryCwd,
      query: "",
      enabled: providerCanListSkills.gemini,
    }),
  );
  const kiloSkillsQuery = useQuery(
    providerSkillsQueryOptions({
      provider: "kilo",
      cwd: discoveryCwd,
      query: "",
      enabled: providerCanListSkills.kilo,
    }),
  );
  const openCodeSkillsQuery = useQuery(
    providerSkillsQueryOptions({
      provider: "opencode",
      cwd: discoveryCwd,
      query: "",
      enabled: providerCanListSkills.opencode,
    }),
  );
  const piSkillsQuery = useQuery(
    providerSkillsQueryOptions({
      provider: "pi",
      cwd: discoveryCwd,
      agentDir: settings.piAgentDir || null,
      query: "",
      enabled: providerCanListSkills.pi,
    }),
  );

  const skillQueries = useMemo(
    () =>
      buildSkillLibraryProviderQueryMap({
        codex: codexSkillsQuery,
        claudeAgent: claudeSkillsQuery,
        cursor: cursorSkillsQuery,
        gemini: geminiSkillsQuery,
        kilo: kiloSkillsQuery,
        opencode: openCodeSkillsQuery,
        pi: piSkillsQuery,
      }),
    [
      claudeSkillsQuery,
      codexSkillsQuery,
      cursorSkillsQuery,
      geminiSkillsQuery,
      kiloSkillsQuery,
      openCodeSkillsQuery,
      piSkillsQuery,
    ],
  );

  const rows = useMemo(
    () =>
      buildSkillLibraryRows(
        PROVIDERS.filter((provider) => providerCanListSkills[provider]).map((provider) => ({
          provider,
          providerLabel: PROVIDER_DISPLAY_NAMES[provider],
          skills: skillQueries[provider].data?.skills ?? [],
        })),
      ),
    [providerCanListSkills, skillQueries],
  );

  const providerCounts = useMemo(() => countSkillLibraryRowsByProvider(rows), [rows]);
  const activeProviders = useMemo(
    () => PROVIDERS.filter((provider) => providerCanListSkills[provider]),
    [providerCanListSkills],
  );
  const filteredRows = useMemo(
    () => filterSkillLibraryRows(rows, { query: deferredQuery, provider: providerFilter }),
    [deferredQuery, providerFilter, rows],
  );
  const groupedFilteredRows = useMemo(
    () =>
      (providerFilter === "all"
        ? PROVIDERS
        : isSkillLibraryDiscoveryProvider(providerFilter)
          ? [providerFilter]
          : []
      ).map((provider) => ({
        provider,
        rows: filteredRows.filter((row) => row.provider === provider),
      })),
    [filteredRows, providerFilter],
  );
  const isCapabilityLoading =
    codexCapabilitiesQuery.isLoading ||
    claudeCapabilitiesQuery.isLoading ||
    cursorCapabilitiesQuery.isLoading ||
    geminiCapabilitiesQuery.isLoading ||
    kiloCapabilitiesQuery.isLoading ||
    openCodeCapabilitiesQuery.isLoading ||
    piCapabilitiesQuery.isLoading;
  const hasCapabilityError =
    codexCapabilitiesQuery.isError ||
    claudeCapabilitiesQuery.isError ||
    cursorCapabilitiesQuery.isError ||
    geminiCapabilitiesQuery.isError ||
    kiloCapabilitiesQuery.isError ||
    openCodeCapabilitiesQuery.isError ||
    piCapabilitiesQuery.isError;
  const isSkillLoading = activeProviders.some((provider) => skillQueries[provider].isLoading);

  const providerStatus = useMemo(
    () =>
      buildSkillLibraryProviderStatusMap({
        codex: { capability: codexCapabilitiesQuery, skills: codexSkillsQuery },
        claudeAgent: { capability: claudeCapabilitiesQuery, skills: claudeSkillsQuery },
        cursor: { capability: cursorCapabilitiesQuery, skills: cursorSkillsQuery },
        gemini: { capability: geminiCapabilitiesQuery, skills: geminiSkillsQuery },
        kilo: { capability: kiloCapabilitiesQuery, skills: kiloSkillsQuery },
        opencode: { capability: openCodeCapabilitiesQuery, skills: openCodeSkillsQuery },
        pi: { capability: piCapabilitiesQuery, skills: piSkillsQuery },
      }),
    [
      claudeCapabilitiesQuery,
      claudeSkillsQuery,
      codexCapabilitiesQuery,
      codexSkillsQuery,
      cursorCapabilitiesQuery,
      cursorSkillsQuery,
      geminiCapabilitiesQuery,
      geminiSkillsQuery,
      kiloCapabilitiesQuery,
      kiloSkillsQuery,
      openCodeCapabilitiesQuery,
      openCodeSkillsQuery,
      piCapabilitiesQuery,
      piSkillsQuery,
    ],
  );

  useEffect(() => {
    if (providerFilter !== "all" && !providerCanListSkills[providerFilter]) {
      setProviderFilter("all");
    }
  }, [providerCanListSkills, providerFilter]);

  return (
    <div className="min-w-0 space-y-5">
      <section className="min-w-0 space-y-2">
        <h2 className="px-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Installed capabilities
        </h2>
        <div className="min-w-0 rounded-2xl border border-border bg-card/60 p-4 shadow-sm sm:p-5">
          <div className="space-y-5">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                  Search installed skills by name, source, or description. Management actions are
                  reserved until providers expose safe controls.
                </p>
              </div>
              <span className="inline-flex w-fit shrink-0 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-[11px] font-medium text-muted-foreground">
                Read-only
              </span>
            </div>
            <div className="grid min-w-0 grid-cols-3 gap-2">
              <div className="min-w-0 rounded-xl border border-border/60 bg-background/60 px-3 py-3">
                <p className="truncate text-lg font-semibold text-foreground">{rows.length}</p>
                <p className="truncate text-[11px] text-muted-foreground">Skills</p>
              </div>
              <div className="min-w-0 rounded-xl border border-border/60 bg-background/60 px-3 py-3">
                <p className="truncate text-lg font-semibold text-foreground">
                  {activeProviders.length}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">Sources</p>
              </div>
              <div className="min-w-0 rounded-xl border border-border/60 bg-background/60 px-3 py-3">
                <p className="truncate text-lg font-semibold text-foreground">
                  {filteredRows.length}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">Visible</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="min-w-0 rounded-2xl border border-border bg-card/60 p-4 shadow-sm sm:p-5">
        <div className="space-y-3">
          <div className="relative min-w-0">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search installed skills"
              placeholder="Search installed skills"
              className="pl-9"
            />
          </div>
          <div
            className="flex min-w-0 flex-wrap gap-2"
            role="group"
            aria-label="Filter skills by source"
          >
            <Button
              type="button"
              size="sm"
              variant={providerFilter === "all" ? "default" : "outline"}
              aria-pressed={providerFilter === "all"}
              onClick={() => setProviderFilter("all")}
            >
              All sources
              <span className="ml-1 text-[11px] opacity-70">{rows.length}</span>
            </Button>
            {activeProviders.map((provider) => (
              <Button
                key={provider}
                type="button"
                size="sm"
                variant={providerFilter === provider ? "default" : "outline"}
                aria-pressed={providerFilter === provider}
                onClick={() => setProviderFilter(provider)}
              >
                {PROVIDER_DISPLAY_NAMES[provider]}
                <span className="ml-1 text-[11px] opacity-70">{providerCounts[provider] ?? 0}</span>
              </Button>
            ))}
          </div>
        </div>
        <p className="mt-3 text-[12px] text-muted-foreground">
          Showing {filteredRows.length} of {rows.length} skills across {activeProviders.length}{" "}
          sources.
        </p>
        {query.trim().length > 0 || providerFilter !== "all" ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {query.trim().length > 0 ? (
              <Button type="button" size="sm" variant="outline" onClick={() => setQuery("")}>
                Search: "{query.trim()}" x
              </Button>
            ) : null}
            {providerFilter !== "all" ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setProviderFilter("all")}
              >
                Source: {PROVIDER_DISPLAY_NAMES[providerFilter]} x
              </Button>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="min-w-0 space-y-4">
        {discoveryCwd === null ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-background/50 p-6 text-sm text-muted-foreground">
            Open a project or thread to discover installed provider skills.
          </div>
        ) : rows.length === 0 && isCapabilityLoading ? (
          <div className="rounded-2xl border border-border/70 bg-background/60 p-6 text-sm text-muted-foreground">
            Checking provider skill discovery support...
          </div>
        ) : rows.length === 0 && hasCapabilityError ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-background/50 p-6 text-sm text-muted-foreground">
            Could not check skill discovery support for every provider. Review provider runtime
            status and try again.
          </div>
        ) : rows.length === 0 && isSkillLoading ? (
          <div className="rounded-2xl border border-border/70 bg-background/60 p-6 text-sm text-muted-foreground">
            Loading installed skills from supported providers...
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-background/50 p-6 text-sm text-muted-foreground">
            No installed skills match the current filters.
          </div>
        ) : (
          groupedFilteredRows.map(({ provider, rows: providerRows }) => {
            const status = providerStatus[provider];
            if (status.capability.isLoading) {
              return (
                <div key={provider} className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-sm font-semibold text-foreground">
                      {PROVIDER_DISPLAY_NAMES[provider]}
                    </h3>
                    <span className="text-[12px] text-muted-foreground">Checking support</span>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background/60 p-4 text-sm text-muted-foreground">
                    Checking whether this provider exposes skill discovery.
                  </div>
                </div>
              );
            }
            if (status.capability.isError) {
              return (
                <div key={provider} className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-sm font-semibold text-foreground">
                      {PROVIDER_DISPLAY_NAMES[provider]}
                    </h3>
                    <span className="text-[12px] text-muted-foreground">Unavailable</span>
                  </div>
                  <div className="rounded-2xl border border-dashed border-border/70 bg-background/50 p-4 text-sm text-muted-foreground">
                    Could not check this provider's skill discovery support.
                  </div>
                </div>
              );
            }
            if (!providerCanListSkills[provider]) {
              return (
                <div key={provider} className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-sm font-semibold text-foreground">
                      {PROVIDER_DISPLAY_NAMES[provider]}
                    </h3>
                    <span className="text-[12px] text-muted-foreground">Not supported</span>
                  </div>
                  <div className="rounded-2xl border border-dashed border-border/70 bg-background/50 p-4 text-sm text-muted-foreground">
                    This provider does not expose skill discovery.
                  </div>
                </div>
              );
            }
            if (status.skills.isError) {
              return (
                <div key={provider} className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-sm font-semibold text-foreground">
                      {PROVIDER_DISPLAY_NAMES[provider]}
                    </h3>
                    <span className="text-[12px] text-muted-foreground">Error</span>
                  </div>
                  <div className="rounded-2xl border border-dashed border-border/70 bg-background/50 p-4 text-sm text-muted-foreground">
                    Could not load installed skills from this provider.
                  </div>
                </div>
              );
            }
            if (status.skills.isLoading) {
              return (
                <div key={provider} className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-sm font-semibold text-foreground">
                      {PROVIDER_DISPLAY_NAMES[provider]}
                    </h3>
                    <span className="text-[12px] text-muted-foreground">Loading skills</span>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background/60 p-4 text-sm text-muted-foreground">
                    Loading installed skills from this provider.
                  </div>
                </div>
              );
            }
            if (providerRows.length === 0) {
              return (
                <div key={provider} className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-sm font-semibold text-foreground">
                      {PROVIDER_DISPLAY_NAMES[provider]}
                    </h3>
                    <span className="text-[12px] text-muted-foreground">0 skills</span>
                  </div>
                  <div className="rounded-2xl border border-dashed border-border/70 bg-background/50 p-4 text-sm text-muted-foreground">
                    {providerFilter === "all"
                      ? "This provider supports skill discovery but returned no installed skills for this workspace."
                      : "No installed skills from this provider match the current search."}
                  </div>
                </div>
              );
            }
            const isExpanded = expandedProviders[provider] === true;
            const visibleRows = isExpanded
              ? providerRows
              : providerRows.slice(0, MAX_COLLAPSED_PROVIDER_ROWS);
            const hiddenCount = providerRows.length - visibleRows.length;

            return (
              <div
                key={provider}
                className="min-w-0 space-y-2 overflow-hidden rounded-2xl border border-border bg-card/60 p-3 shadow-sm"
              >
                <div className="flex min-w-0 items-center justify-between gap-3 px-1">
                  <h3 className="text-sm font-semibold text-foreground">
                    {PROVIDER_DISPLAY_NAMES[provider]}
                  </h3>
                  <span className="text-[12px] text-muted-foreground">
                    {providerRows.length} skills
                  </span>
                </div>
                <div className="min-w-0 divide-y divide-border overflow-hidden rounded-xl border border-border bg-background/35">
                  {visibleRows.map((row) => (
                    <SkillRow key={row.key} row={row} />
                  ))}
                </div>
                {hiddenCount > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setExpandedProviders((previous) => ({ ...previous, [provider]: true }))
                    }
                  >
                    Show {hiddenCount} more {PROVIDER_DISPLAY_NAMES[provider]} skills
                  </Button>
                ) : null}
              </div>
            );
          })
        )}
      </section>

      <section
        className={cn(
          "rounded-2xl border border-dashed border-border/70 bg-background/45 p-4",
          "text-[12px] leading-5 text-muted-foreground",
        )}
      >
        Future management seam: install, uninstall, details, and remote catalog search will appear
        here when provider capabilities support those actions.
      </section>
    </div>
  );
}
