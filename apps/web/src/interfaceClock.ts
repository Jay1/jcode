import type { TimestampFormat } from "./appSettings";
import { formatShortTimestamp } from "./timestampFormat";

export const INTERFACE_CLOCK_TICK_INTERVAL_MS = 60 * 1000;

export function getMillisecondsUntilNextMinute(now: Date): number {
  const elapsedInMinuteMs = now.getSeconds() * 1000 + now.getMilliseconds();
  return elapsedInMinuteMs === 0
    ? INTERFACE_CLOCK_TICK_INTERVAL_MS
    : INTERFACE_CLOCK_TICK_INTERVAL_MS - elapsedInMinuteMs;
}

export function formatInterfaceClockTime(now: Date, timestampFormat: TimestampFormat): string {
  return formatShortTimestamp(now.toISOString(), timestampFormat);
}
