import { cn } from "~/lib/utils";
import type {
  VcsAvailabilityKind,
  VcsCommandCenterStatusModel,
  VcsStatusField,
  VcsStatusTone,
} from "./VcsCommandCenterStatusPanel.logic";

export { buildVcsCommandCenterStatusModel } from "./VcsCommandCenterStatusPanel.logic";

function statusToneClassName(tone: VcsStatusTone): string {
  switch (tone) {
    case "success":
      return "text-success";
    case "warning":
      return "text-warning";
    case "error":
      return "text-destructive";
    case "muted":
      return "text-muted-foreground";
    case "default":
      return "text-[var(--color-text-foreground)]";
  }
}

function availabilityClassName(kind: VcsAvailabilityKind): string {
  switch (kind) {
    case "available":
      return "border-[color:var(--app-status-success-border)] bg-[var(--app-status-success-bg)] text-[var(--app-status-success-fg)]";
    case "refreshing":
      return "border-[color:var(--app-status-working-border)] bg-[var(--app-status-working-bg)] text-[var(--app-status-working-fg)]";
    case "unavailable":
      return "border-[color:var(--app-status-warning-border)] bg-[var(--app-status-warning-bg)] text-[var(--app-status-warning-fg)]";
  }
}

function StatusFieldRow({ field }: { readonly field: VcsStatusField }) {
  return (
    <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2 rounded-md border border-[color:var(--app-work-row-border)] bg-[var(--app-work-row-bg)] px-2 py-1.5">
      <span className="text-[11px] text-muted-foreground">{field.label}</span>
      <span className="min-w-0 text-right">
        <span
          className={cn("block truncate font-medium text-[11px]", statusToneClassName(field.tone))}
        >
          {field.value}
        </span>
        {field.detail ? (
          <span className="block truncate font-mono text-[10px] text-muted-foreground">
            {field.detail}
          </span>
        ) : null}
      </span>
    </div>
  );
}

export function VcsCommandCenterStatusPanel({
  model,
}: {
  readonly model: VcsCommandCenterStatusModel;
}) {
  const fields = [
    model.branch,
    model.worktree,
    model.sync,
    model.pullRequest,
    model.provider,
  ] as const;

  return (
    <section
      aria-label="Version control command center"
      className="mx-1 mb-1 rounded-lg border border-[color:var(--app-work-row-border)] bg-[var(--app-surface-card)] p-2 text-[11px]"
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-medium text-[var(--color-text-foreground)]">
            Version control command center
          </h2>
          <p className="text-muted-foreground">Read-only status</p>
        </div>
        <span
          aria-disabled={model.availability.kind === "available" ? undefined : true}
          className={cn(
            "shrink-0 rounded-full border px-2 py-0.5 text-[10px]",
            availabilityClassName(model.availability.kind),
          )}
          title={model.availability.reason}
        >
          {model.availability.label}
        </span>
      </div>
      <p className="mb-2 rounded-md border border-[color:var(--app-work-row-border)] bg-[var(--app-surface-card-header)] px-2 py-1 text-muted-foreground">
        {model.availability.reason}
      </p>
      <div className="space-y-1">
        {fields.map((field) => (
          <StatusFieldRow field={field} key={field.label} />
        ))}
      </div>
    </section>
  );
}
