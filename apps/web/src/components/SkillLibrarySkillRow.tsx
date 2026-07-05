import {
  PROVIDER_DISPLAY_NAMES,
  type ProviderKind,
  type ProviderUninstallSkillInput,
} from "@jcode/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ListChecksIcon, Trash2 } from "../lib/icons";
import { uninstallSkillMutationOptions } from "../lib/providerDiscoveryReactQuery";
import type { SkillLibraryRow } from "../lib/skillLibrary";
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
import { Switch } from "./ui/switch";

function getSkillTitle(row: SkillLibraryRow): string {
  return row.skill.interface?.displayName ?? row.skill.name;
}

function getSkillDescription(row: SkillLibraryRow): string {
  return (
    row.skill.interface?.shortDescription ?? row.skill.description ?? "No description available."
  );
}

export function getSkillSourceOriginLabel(row: SkillLibraryRow): string | null {
  switch (row.skill.source?.origin) {
    case "filesystem":
      return "Project";
    case "builtin":
      return "Built-in";
    case "virtual":
      return "Virtual";
    case undefined:
      return null;
  }
}

export function formatSkillActionNotice(input: {
  readonly canUninstall: boolean;
  readonly uninstallReason?: string;
  readonly canToggle: boolean;
  readonly toggleReason?: string;
}): string | null {
  const reasons = [
    input.canUninstall || !input.uninstallReason
      ? undefined
      : `Cannot uninstall: ${input.uninstallReason}`,
    input.canToggle || !input.toggleReason ? undefined : `Cannot disable: ${input.toggleReason}`,
  ].filter((reason): reason is string => reason !== undefined && reason.trim().length > 0);

  return reasons.length > 0 ? reasons.join(" ") : null;
}

export function buildSkillLibraryUninstallInput(input: {
  readonly row: SkillLibraryRow;
  readonly discoveryCwd: string;
}): ProviderUninstallSkillInput {
  return {
    provider: input.row.provider,
    cwd: input.discoveryCwd,
    skillPath: input.row.skill.path,
  };
}

function SkillGlyph({ provider }: { provider: ProviderKind }) {
  return (
    <span
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-linear-to-br from-foreground/18 to-foreground/5 shadow-xs"
      data-provider={provider}
    >
      <ListChecksIcon className="size-4.5 text-foreground/75" />
    </span>
  );
}

function ProviderBadge({ row }: { row: SkillLibraryRow }) {
  return (
    <span className="inline-flex max-w-24 shrink-0 items-center truncate rounded-full border border-border/70 bg-background/70 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      {row.providerLabel}
    </span>
  );
}

function SourceOriginBadge({ row }: { row: SkillLibraryRow }) {
  const label = getSkillSourceOriginLabel(row);
  if (label === null) return null;

  return (
    <span className="inline-flex max-w-24 shrink-0 items-center truncate rounded-full border border-border/60 bg-background/45 px-2 py-0.5 text-[11px] font-medium text-muted-foreground/80">
      {label}
    </span>
  );
}

function UninstallConfirmButton({
  row,
  discoveryCwd,
}: {
  row: SkillLibraryRow;
  discoveryCwd: string;
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation(uninstallSkillMutationOptions());

  const handleUninstall = () => {
    mutation.mutate(buildSkillLibraryUninstallInput({ row, discoveryCwd }), {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["provider-discovery", "skills"] });
      },
    });
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

export function SkillRow({
  row,
  discoveryCwd,
  canUninstall,
  uninstallReason,
  canToggle,
  toggleReason,
  onToggle,
  isToggling,
}: {
  row: SkillLibraryRow;
  discoveryCwd: string;
  canUninstall: boolean;
  uninstallReason?: string;
  canToggle: boolean;
  toggleReason?: string;
  onToggle: (enabled: boolean) => void;
  isToggling: boolean;
}) {
  const actionNotice = formatSkillActionNotice({
    canUninstall,
    ...(uninstallReason ? { uninstallReason } : {}),
    canToggle,
    ...(toggleReason ? { toggleReason } : {}),
  });

  return (
    <div className="group grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 transition-colors hover:bg-(--sidebar-accent)">
      <SkillGlyph provider={row.provider} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
          <p className="truncate text-[13px] font-semibold text-foreground">{getSkillTitle(row)}</p>
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <ProviderBadge row={row} />
            <SourceOriginBadge row={row} />
          </div>
        </div>
        <p className="mt-1 line-clamp-2 wrap-break-word text-[12px] leading-5 text-muted-foreground">
          {getSkillDescription(row)}
        </p>
        {actionNotice ? (
          <p className="mt-1 line-clamp-2 wrap-break-word text-[11px] font-medium leading-4 text-muted-foreground/80">
            {actionNotice}
          </p>
        ) : null}
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
                  className="size-7 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 sm:focus-visible:opacity-100"
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
                <UninstallConfirmButton row={row} discoveryCwd={discoveryCwd} />
              </AlertDialogFooter>
            </AlertDialogPopup>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}
