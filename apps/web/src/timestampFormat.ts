import { type TimestampFormat } from "./appSettings";

export function getTimestampFormatOptions(
  timestampFormat: TimestampFormat,
  includeSeconds: boolean,
): Intl.DateTimeFormatOptions {
  const baseOptions: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
    ...(includeSeconds ? { second: "2-digit" } : {}),
  };

  if (timestampFormat === "locale") {
    return baseOptions;
  }

  return {
    ...baseOptions,
    hour12: timestampFormat === "12-hour",
  };
}

const timestampFormatters = new Map<string, Intl.DateTimeFormat>([
  [
    "locale:minutes",
    new Intl.DateTimeFormat(undefined, getTimestampFormatOptions("locale", false)),
  ],
  [
    "locale:seconds",
    new Intl.DateTimeFormat(undefined, getTimestampFormatOptions("locale", true)),
  ],
  [
    "12-hour:minutes",
    new Intl.DateTimeFormat(undefined, getTimestampFormatOptions("12-hour", false)),
  ],
  [
    "12-hour:seconds",
    new Intl.DateTimeFormat(undefined, getTimestampFormatOptions("12-hour", true)),
  ],
  [
    "24-hour:minutes",
    new Intl.DateTimeFormat(undefined, getTimestampFormatOptions("24-hour", false)),
  ],
  [
    "24-hour:seconds",
    new Intl.DateTimeFormat(undefined, getTimestampFormatOptions("24-hour", true)),
  ],
]);

function getTimestampFormatter(
  timestampFormat: TimestampFormat,
  includeSeconds: boolean,
): Intl.DateTimeFormat {
  const cacheKey = `${timestampFormat}:${includeSeconds ? "seconds" : "minutes"}`;
  return timestampFormatters.get(cacheKey) ?? timestampFormatters.get("locale:minutes")!;
}

export function formatTimestamp(isoDate: string, timestampFormat: TimestampFormat): string {
  return getTimestampFormatter(timestampFormat, true).format(new Date(isoDate));
}

export function formatShortTimestamp(isoDate: string, timestampFormat: TimestampFormat): string {
  return getTimestampFormatter(timestampFormat, false).format(new Date(isoDate));
}
