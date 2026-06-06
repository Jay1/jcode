import { Alert, AlertAction, AlertDescription } from "../ui/alert";
import { Button } from "../ui/button";
import { CircleAlertIcon, XIcon } from "~/lib/icons";
import type { RateLimitStatus } from "./RateLimitBanner.logic";

function formatResetsAt(resetsAt: string): string {
  const ms = Date.parse(resetsAt);
  if (Number.isNaN(ms)) return "";
  const secondsLeft = Math.max(0, Math.ceil((ms - Date.now()) / 1000));
  if (secondsLeft < 60) return ` Resets in ${secondsLeft}s.`;
  const minutesLeft = Math.ceil(secondsLeft / 60);
  return ` Resets in ${minutesLeft}m.`;
}

export function RateLimitBanner({
  onDismiss,
  rateLimitStatus,
}: {
  onDismiss?: () => void;
  rateLimitStatus: RateLimitStatus | null;
}) {
  if (!rateLimitStatus) return null;

  const { status, resetsAt, utilization } = rateLimitStatus;
  const isRejected = status === "rejected";

  const message = isRejected
    ? `Rate limit reached.${resetsAt ? formatResetsAt(resetsAt) : ""}`
    : `Approaching rate limit${utilization !== undefined ? ` (${Math.round(utilization * 100)}% used)` : ""}.${resetsAt ? formatResetsAt(resetsAt) : ""}`;

  return (
    <div className="pt-3 mx-auto max-w-3xl px-4">
      <Alert variant={isRejected ? "error" : "warning"}>
        <CircleAlertIcon />
        <AlertDescription>{message}</AlertDescription>
        {onDismiss ? (
          <AlertAction>
            <Button
              aria-label="Dismiss rate limit status"
              size="icon-xs"
              title="Dismiss rate limit status"
              variant="ghost"
              onClick={onDismiss}
            >
              <XIcon className="size-3.5" />
            </Button>
          </AlertAction>
        ) : null}
      </Alert>
    </div>
  );
}
