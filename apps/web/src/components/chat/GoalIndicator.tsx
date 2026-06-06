import type { OrchestrationGoal } from "@jcode/contracts";

const STATUS_LABELS: Record<OrchestrationGoal["status"], string> = {
  active: "Active",
  paused: "Paused",
  complete: "Complete",
  cleared: "Cleared",
  blocked: "Blocked",
};

const STATUS_CLASS_NAMES: Record<OrchestrationGoal["status"], string> = {
  active:
    "border-[var(--app-status-working-border)] bg-[var(--app-status-working-bg)] text-[var(--app-status-working-fg)]",
  paused:
    "border-[var(--app-status-warning-border)] bg-[var(--app-status-warning-bg)] text-[var(--app-status-warning-fg)]",
  complete:
    "border-[var(--app-status-success-border)] bg-[var(--app-status-success-bg)] text-[var(--app-status-success-fg)]",
  cleared:
    "border-[var(--app-status-muted-border)] bg-[var(--app-status-muted-bg)] text-[var(--app-status-muted-fg)]",
  blocked:
    "border-[var(--app-status-error-border)] bg-[var(--app-status-error-bg)] text-[var(--app-status-error-fg)]",
};

export function GoalIndicator({ goal }: { goal: OrchestrationGoal | null | undefined }) {
  if (!goal || goal.status === "cleared") {
    return null;
  }

  const statusLabel = STATUS_LABELS[goal.status];
  return (
    <div className="mx-auto max-w-3xl px-4 pt-3">
      <div
        className={`inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1 text-[length:var(--app-font-size-ui-xs,11px)] font-medium ${STATUS_CLASS_NAMES[goal.status]}`}
        title={goal.objective}
        aria-label={`Persistent goal ${statusLabel}: ${goal.objective}`}
      >
        <span className="shrink-0 uppercase tracking-[0.16em]">Goal</span>
        <span aria-hidden="true" className="h-3 border-l border-current/25" />
        <span className="shrink-0">{statusLabel}</span>
        <span aria-hidden="true" className="h-3 border-l border-current/25" />
        <span className="truncate">{goal.objective}</span>
      </div>
    </div>
  );
}
