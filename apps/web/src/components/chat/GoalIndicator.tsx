import type { OrchestrationGoal } from "@jcode/contracts";
import { cn } from "~/lib/utils";

const STATUS_LABELS: Record<OrchestrationGoal["status"], string> = {
  active: "Active",
  paused: "Paused",
  completed: "Complete",
  cleared: "Cleared",
};

const STATUS_CLASS_NAMES: Record<OrchestrationGoal["status"], string> = {
  active:
    "border-[var(--app-status-working-border)] bg-[var(--app-status-working-bg)] text-[var(--app-status-working-fg)]",
  paused:
    "border-[var(--app-status-warning-border)] bg-[var(--app-status-warning-bg)] text-[var(--app-status-warning-fg)]",
  completed:
    "border-[var(--app-status-success-border)] bg-[var(--app-status-success-bg)] text-[var(--app-status-success-fg)]",
  cleared:
    "border-[var(--app-status-muted-border)] bg-[var(--app-status-muted-bg)] text-[var(--app-status-muted-fg)]",
};

export function GoalIndicator({
  className,
  goal,
}: {
  className?: string;
  goal: OrchestrationGoal | null | undefined;
}) {
  if (!goal || goal.status === "cleared") {
    return null;
  }

  const statusLabel = STATUS_LABELS[goal.status];
  return (
    <div
      className={cn(
        "inline-flex h-6 max-w-[min(24rem,42vw)] shrink min-w-0 items-center gap-1.5 rounded-md border px-1.5 text-[10px] font-medium",
        STATUS_CLASS_NAMES[goal.status],
        className,
      )}
      title={goal.objective}
      aria-label={`Persistent goal ${statusLabel}: ${goal.objective}`}
    >
      <span className="shrink-0 uppercase tracking-[0.14em]">Goal</span>
      <span aria-hidden="true" className="h-3 border-l border-current/25" />
      <span className="shrink-0">{statusLabel}</span>
      <span aria-hidden="true" className="h-3 border-l border-current/25" />
      <span className="truncate">{goal.objective}</span>
    </div>
  );
}
