import { useEffect, useState } from "react";
import type { TimestampFormat } from "../appSettings";
import { formatInterfaceClockTime, getMillisecondsUntilNextMinute } from "../interfaceClock";
import { cn } from "../lib/utils";

export function InterfaceClock({
  timestampFormat,
  visible,
}: {
  timestampFormat: TimestampFormat;
  visible: boolean;
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timeoutId: number | null = null;

    const scheduleNextTick = () => {
      timeoutId = window.setTimeout(() => {
        setNow(new Date());
        scheduleNextTick();
      }, getMillisecondsUntilNextMinute(new Date()));
    };

    scheduleNextTick();

    return () => {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, []);

  if (!visible) return null;

  const label = formatInterfaceClockTime(now, timestampFormat);

  return (
    <div className="pointer-events-none fixed bottom-3 right-3 z-30">
      <time
        aria-label={`Current time ${label}`}
        className={cn(
          "pointer-events-auto inline-flex h-7 min-w-16 items-center justify-center rounded-full",
          "border border-[color:var(--app-runtime-chip-border)] bg-[var(--app-runtime-chip-bg)] px-2.5",
          "font-mono text-[length:var(--app-font-size-ui-xs,10px)] font-medium tabular-nums",
          "text-[var(--app-metadata-fg)] shadow-sm transition-colors",
          "hover:bg-[var(--app-chrome-control-hover-bg)] hover:text-[var(--app-chrome-control-hover-fg)]",
        )}
      >
        {label}
      </time>
    </div>
  );
}
