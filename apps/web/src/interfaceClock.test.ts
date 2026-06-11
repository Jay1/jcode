import { describe, expect, it } from "vitest";
import { getMillisecondsUntilNextMinute, INTERFACE_CLOCK_TICK_INTERVAL_MS } from "./interfaceClock";

describe("getMillisecondsUntilNextMinute", () => {
  it("returns the remaining milliseconds until the next minute", () => {
    expect(getMillisecondsUntilNextMinute(new Date("2026-06-07T12:34:56.789Z"))).toBe(3211);
  });

  it("waits one full minute when called exactly on a minute boundary", () => {
    expect(getMillisecondsUntilNextMinute(new Date("2026-06-07T12:34:00.000Z"))).toBe(
      INTERFACE_CLOCK_TICK_INTERVAL_MS,
    );
  });
});
