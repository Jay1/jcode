import {
  PROVIDER_DISPLAY_NAMES,
  type CatalogSkillEntry,
  type ProviderKind,
  type ProviderStartOptions,
} from "@jcode/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { getProviderStartOptions, useAppSettings } from "../appSettings";
import { useFocusedChatContext } from "../focusedChatContext";
import { DownloadIcon, ListChecksIcon, PlusIcon, SearchIcon, Trash2 } from "../lib/icons";
import { resolveProviderDiscoveryCwd } from "../lib/providerDiscovery";
import {
  installSkillMutationOptions,
  providerComposerCapabilitiesQueryOptions,
  providerSkillsQueryOptions,
  searchSkillsCatalogQueryOptions,
  setSkillEnabledMutationOptions,
  supportsSkillDiscovery,
  supportsSkillInstall,
  supportsSkillToggle,
  supportsSkillUninstall,
  uninstallSkillMutationOptions,
} from "../lib/providerDiscoveryReactQuery";
import {
  buildSkillLibraryRows,
  countSkillLibraryRowsByProvider,
  filterInstallableCatalogEntries,
  filterSkillLibraryRows,
  type SkillLibraryProviderFilter,
  type SkillLibraryRow,
} from "../lib/skillLibrary";
import { serverConfigQueryOptions } from "../lib/serverReactQuery";
import { cn } from "../lib/utils";
import { useStore } from "../store";
import { createFirstProjectSelector } from "../storeSelectors";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Switch } from "./ui/switch";

const PROVIDERS: readonly ProviderKind[] = [
  "codex",
  "claudeAgent",
  "cursor",
  "gemini",
  "kilo",
  "opencode",
  "pi",
];

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

function SkillRow({
  row,
  canUninstall,
  canToggle,
  onToggle,
  isToggling,
}: {
  row: SkillLibraryRow;
  canUninstall: boolean;
  canToggle: boolean;
  onToggle: (enabled: boolean) => void;
  isToggling: boolean;
}) {
  return (
    <div className="group grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 transition-colors hover:bg-(--sidebar-accent)">
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
      <div className="flex shrink-0 items-center gap-2">
        {canToggle && (
          <Switch
            checked={row.skill.enabled}
            onCheckedChange={onToggle}
            disabled={isToggling}
            aria-label={row.skill.enabled ? "Disable skill" : "Enable skill"}
          />
        )}
        {canUninstall && (
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"
                  aria-label={`Uninstall ${getSkillTitle(row)}`}
                >
                  <Trash2 className="size-3.5 text-muted-foreground" />
                </Button>
              }
            />
            <AlertDialogPopup>
              <AlertDialogHeader>
                <AlertDialogTitle>Uninstall skill</AlertDialogTitle>
                <AlertDialogDescription>
                  Remove <strong>{getSkillTitle(row)}</strong> from{" "}
                  {PROVIDER_DISPLAY_NAMES[row.provider]}? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogClose
                  render={
                    <Button type="button" variant="outline" size="sm">
                      Cancel
                    </Button>
                  }
                />
                <UninstallConfirmButton row={row} />
              </AlertDialogFooter>
            </AlertDialogPopup>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}

function UninstallConfirmButton({ row }: { row: SkillLibraryRow }) {
  const queryClient = useQueryClient();
  const mutation = useMutation(uninstallSkillMutationOptions());

  const handleUninstall = () => {
    mutation.mutate(
      {
        provider: row.provider,
        cwd: row.skill.path,
        skillPath: row.skill.path,
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["provider-discovery", "skills"] });
        },
      },
    );
  };

  return (
    <AlertDialogClose
      render={
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={mutation.isPending}
          onClick={handleUninstall}
        >
          {mutation.isPending ? "Removing..." : "Uninstall"}
        </Button>
      }
    />
  );
}

function formatInstallCount(count: number | undefined): string {
  if (count === undefined) return "";
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

type InstallFeedback = {
  key: string;
  status: "installing" | "installed" | "failed";
  message: string;
};

function catalogInstallKey(provider: ProviderKind, entry: CatalogSkillEntry): string {
  return `${provider}:${entry.packageRef}:${entry.skillName}`;
}

function formatInstallError(error: unknown): string {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message
    : "The provider did not return an install result.";
}

function InstallSkillDialog({
  discoveryCwd,
  installedRows,
  providerOptions,
  providersWithInstall,
}: {
  discoveryCwd: string | null;
  installedRows: readonly SkillLibraryRow[];
  providerOptions: ProviderStartOptions | undefined;
  providersWithInstall: readonly ProviderKind[];
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<ProviderKind>(
    providersWithInstall[0] ?? "opencode",
  );
  const [installFeedback, setInstallFeedback] = useState<InstallFeedback | null>(null);
  const [locallyInstalledKeys, setLocallyInstalledKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const deferredQuery = useDeferredValue(catalogQuery);

  const catalogSearch = useQuery(
    searchSkillsCatalogQueryOptions({
      provider: selectedProvider,
      cwd: discoveryCwd ?? "",
      query: deferredQuery,
      ...(providerOptions ? { providerOptions } : {}),
    }),
  );

  useEffect(() => {
    setInstallFeedback(null);
  }, [deferredQuery, open, selectedProvider]);

  const installMutation = useMutation(installSkillMutationOptions());

  const catalogResults = catalogSearch.data?.results ?? [];
  const installableResults = useMemo(
    () =>
      filterInstallableCatalogEntries({
        entries: catalogResults,
        installedRows,
        provider: selectedProvider,
      }).filter((entry) => !locallyInstalledKeys.has(catalogInstallKey(selectedProvider, entry))),
    [catalogResults, installedRows, locallyInstalledKeys, selectedProvider],
  );

  const handleInstall = (entry: CatalogSkillEntry) => {
    const installKey = catalogInstallKey(selectedProvider, entry);
    if (!discoveryCwd) {
      setInstallFeedback({
        key: installKey,
        status: "failed",
        message: "Open a project before installing skills.",
      });
      return;
    }
    const provider = selectedProvider;
    setInstallFeedback({
      key: installKey,
      status: "installing",
      message: `Installing ${entry.displayName ?? entry.skillName} into ${PROVIDER_DISPLAY_NAMES[provider]}...`,
    });
    installMutation.mutate(
      {
        provider,
        cwd: discoveryCwd,
        packageRef: entry.packageRef,
        skillName: entry.skillName,
        ...(providerOptions ? { providerOptions } : {}),
      },
      {
        onSuccess: async (result) => {
          setLocallyInstalledKeys((previous) => new Set(previous).add(installKey));
          setInstallFeedback({
            key: installKey,
            status: "installed",
            message: `Installed ${result.skill.interface?.displayName ?? result.skill.name}. Checking installed skills...`,
          });
          await queryClient.invalidateQueries({ queryKey: ["provider-discovery", "skills"] });
          await queryClient.refetchQueries({
            queryKey: ["provider-discovery", "skills", provider],
            type: "active",
          });
          setInstallFeedback({
            key: installKey,
            status: "installed",
            message: `Done. ${result.skill.interface?.displayName ?? result.skill.name} is installed in ${PROVIDER_DISPLAY_NAMES[provider]}.`,
          });
        },
        onError: (error) => {
          setInstallFeedback({
            key: installKey,
            status: "failed",
            message: `Install failed: ${formatInstallError(error)}`,
          });
        },
      },
    );
  };

  const isInstalling = installMutation.isPending;
  const hiddenInstalledCount = Math.max(0, catalogResults.length - installableResults.length);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button type="button" variant="outline" size="sm" className="gap-1.5">
            <PlusIcon className="size-3.5" />
            Install
          </Button>
        }
      />
      <DialogPopup className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Install skill</DialogTitle>
        </DialogHeader>
        <DialogPanel className="space-y-4">
          <div className="space-y-2">
            <p className="text-[12px] font-medium text-muted-foreground">Target provider</p>
            <div className="flex flex-wrap gap-2">
              {providersWithInstall.map((provider) => (
                <Button
                  key={provider}
                  type="button"
                  size="sm"
                  variant={selectedProvider === provider ? "default" : "outline"}
                  onClick={() => setSelectedProvider(provider)}
                >
                  {PROVIDER_DISPLAY_NAMES[provider]}
                </Button>
              ))}
            </div>
          </div>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={catalogQuery}
              onChange={(e) => setCatalogQuery(e.target.value)}
              placeholder="Search skills.sh catalog..."
              className="pl-9"
            />
          </div>
          {installFeedback ? (
            <p
              role={installFeedback.status === "failed" ? "alert" : "status"}
              aria-live="polite"
              className={cn(
                "rounded-xl border px-3 py-2 text-[12px]",
                installFeedback.status === "failed"
                  ? "border-destructive/30 bg-destructive/10 text-destructive"
                  : "border-border bg-background/70 text-muted-foreground",
              )}
            >
              {installFeedback.message}
            </p>
          ) : null}
          {hiddenInstalledCount > 0 && deferredQuery.trim().length > 0 ? (
            <p className="text-[11px] text-muted-foreground">
              {hiddenInstalledCount} already installed result{hiddenInstalledCount === 1 ? "" : "s"}{" "}
              hidden for {PROVIDER_DISPLAY_NAMES[selectedProvider]}.
            </p>
          ) : null}
          {catalogSearch.isError && deferredQuery.trim().length > 0 ? (
            <p role="alert" className="py-4 text-center text-[12px] text-destructive">
              Catalog search failed: {catalogSearch.error.message}
            </p>
          ) : catalogSearch.isLoading && deferredQuery.trim().length > 0 ? (
            <p className="py-4 text-center text-[12px] text-muted-foreground">
              Searching catalog...
            </p>
          ) : installableResults.length === 0 && catalogResults.length > 0 ? (
            <p className="py-4 text-center text-[12px] text-muted-foreground">
              All matching skills are already installed for{" "}
              {PROVIDER_DISPLAY_NAMES[selectedProvider]}.
            </p>
          ) : installableResults.length === 0 && deferredQuery.trim().length > 0 ? (
            <p className="py-4 text-center text-[12px] text-muted-foreground">
              No skills found matching &quot;{deferredQuery}&quot;.
            </p>
          ) : (
            <div className="max-h-64 divide-y divide-border overflow-y-auto rounded-xl border border-border">
              {installableResults.map((entry) => {
                const entryKey = catalogInstallKey(selectedProvider, entry);
                const entryFeedback = installFeedback?.key === entryKey ? installFeedback : null;
                const isEntryInstalling = entryFeedback?.status === "installing";
                const isEntryFailed = entryFeedback?.status === "failed";

                return (
                  <div
                    key={entryKey}
                    className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-(--sidebar-accent)"
                  >
                    <DownloadIcon className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-semibold text-foreground">
                        {entry.displayName ?? entry.skillName}
                      </p>
                      {entry.description ? (
                        <p className="line-clamp-1 text-[11px] text-muted-foreground">
                          {entry.description}
                        </p>
                      ) : null}
                      <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                        {entry.packageRef}
                        {entry.installCount !== undefined ? (
                          <span className="ml-2">
                            {formatInstallCount(entry.installCount)} installs
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={isEntryFailed ? "destructive" : "outline"}
                      disabled={isInstalling}
                      onClick={() => handleInstall(entry)}
                      className="shrink-0"
                    >
                      {isEntryInstalling ? "Installing..." : isEntryFailed ? "Retry" : "Install"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </DialogPanel>
      </DialogPopup>
    </Dialog>
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

  const providerCapabilities = useMemo(
    () => ({
      codex: codexCapabilitiesQuery.data,
      claudeAgent: claudeCapabilitiesQuery.data,
      cursor: cursorCapabilitiesQuery.data,
      gemini: geminiCapabilitiesQuery.data,
      kilo: kiloCapabilitiesQuery.data,
      opencode: openCodeCapabilitiesQuery.data,
      pi: piCapabilitiesQuery.data,
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

  const providerCanListSkills = useMemo<Record<ProviderKind, boolean>>(
    () => ({
      codex: supportsSkillDiscovery(codexCapabilitiesQuery.data),
      claudeAgent: supportsSkillDiscovery(claudeCapabilitiesQuery.data),
      cursor: supportsSkillDiscovery(cursorCapabilitiesQuery.data),
      gemini: supportsSkillDiscovery(geminiCapabilitiesQuery.data),
      kilo: supportsSkillDiscovery(kiloCapabilitiesQuery.data),
      opencode: supportsSkillDiscovery(openCodeCapabilitiesQuery.data),
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

  const providerCanManage = useMemo(
    () => ({
      install: PROVIDERS.filter((p) => supportsSkillInstall(providerCapabilities[p])),
      uninstall: PROVIDERS.filter((p) => supportsSkillUninstall(providerCapabilities[p])),
      toggle: PROVIDERS.filter((p) => supportsSkillToggle(providerCapabilities[p])),
    }),
    [providerCapabilities],
  );

  const hasAnyManagement =
    providerCanManage.install.length > 0 ||
    providerCanManage.uninstall.length > 0 ||
    providerCanManage.toggle.length > 0;

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
    () => ({
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
      (providerFilter === "all" ? PROVIDERS : [providerFilter]).map((provider) => ({
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
    () => ({
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
                  Search, install, uninstall, and toggle skills across providers.
                </p>
              </div>
              {hasAnyManagement && providerCanManage.install.length > 0 ? (
                <InstallSkillDialog
                  discoveryCwd={discoveryCwd}
                  installedRows={rows}
                  providerOptions={providerOptions}
                  providersWithInstall={providerCanManage.install}
                />
              ) : (
                <span className="inline-flex w-fit shrink-0 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-[11px] font-medium text-muted-foreground">
                  Read-only
                </span>
              )}
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
                Search: &quot;{query.trim()}&quot; x
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
            const canUninstall = providerCanManage.uninstall.includes(provider);
            const canToggle = providerCanManage.toggle.includes(provider);

            return (
              <ProviderSkillGroup
                key={provider}
                provider={provider}
                rows={visibleRows}
                hiddenCount={hiddenCount}
                isExpanded={isExpanded}
                canUninstall={canUninstall}
                canToggle={canToggle}
                totalCount={providerRows.length}
                onExpand={() =>
                  setExpandedProviders((previous) => ({ ...previous, [provider]: true }))
                }
              />
            );
          })
        )}
      </section>
    </div>
  );
}

function ProviderSkillGroup({
  provider,
  rows,
  hiddenCount,
  isExpanded,
  canUninstall,
  canToggle,
  totalCount,
  onExpand,
}: {
  provider: ProviderKind;
  rows: readonly SkillLibraryRow[];
  hiddenCount: number;
  isExpanded: boolean;
  canUninstall: boolean;
  canToggle: boolean;
  totalCount: number;
  onExpand: () => void;
}) {
  const queryClient = useQueryClient();
  const toggleMutation = useMutation(setSkillEnabledMutationOptions());

  const handleToggle = (row: SkillLibraryRow, enabled: boolean) => {
    toggleMutation.mutate(
      {
        provider: row.provider,
        cwd: row.skill.path,
        skillPath: row.skill.path,
        enabled,
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["provider-discovery", "skills"] });
        },
      },
    );
  };

  return (
    <div className="min-w-0 space-y-2 overflow-hidden rounded-2xl border border-border bg-card/60 p-3 shadow-sm">
      <div className="flex min-w-0 items-center justify-between gap-3 px-1">
        <h3 className="text-sm font-semibold text-foreground">
          {PROVIDER_DISPLAY_NAMES[provider]}
        </h3>
        <span className="text-[12px] text-muted-foreground">{totalCount} skills</span>
      </div>
      <div className="min-w-0 divide-y divide-border overflow-hidden rounded-xl border border-border bg-background/35">
        {rows.map((row) => (
          <SkillRow
            key={row.key}
            row={row}
            canUninstall={canUninstall}
            canToggle={canToggle}
            onToggle={(enabled) => handleToggle(row, enabled)}
            isToggling={toggleMutation.isPending}
          />
        ))}
      </div>
      {hiddenCount > 0 && !isExpanded ? (
        <Button type="button" variant="outline" size="sm" onClick={onExpand}>
          Show {hiddenCount} more {PROVIDER_DISPLAY_NAMES[provider]} skills
        </Button>
      ) : null}
    </div>
  );
}
