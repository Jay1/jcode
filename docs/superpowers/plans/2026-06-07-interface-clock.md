# Interface Clock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a small persistent bottom-right interface clock across all `/_chat` shell views.

**Architecture:** Store visibility as a local-only app setting defaulting on. Render the clock from `apps/web/src/routes/_chat.tsx` so it appears for thread views, new-thread prompt, settings, and plugins under `/_chat`. Reuse existing `timestampFormat` through `formatShortTimestamp`, and only shift runtime controls left without changing their visibility rules.

**Tech Stack:** Bun, Vite, React, TypeScript, Vitest, TanStack Router.

---

## Files

- Modify: `apps/web/src/appSettings.ts`
- Modify: `apps/web/src/appSettings.test.ts`
- Create: `apps/web/src/interfaceClock.ts`
- Create: `apps/web/src/interfaceClock.test.ts`
- Create: `apps/web/src/components/InterfaceClock.tsx`
- Modify: `apps/web/src/routes/_chat.tsx`
- Modify: `apps/web/src/routes/_chat.settings.tsx`
- Modify: `apps/web/src/components/BranchToolbar.tsx`

## Task 1: Add Local-Only Clock Visibility Setting

- [ ] In `apps/web/src/appSettings.ts`, add this exported default near other exported setting defaults:

```ts
export const DEFAULT_SHOW_INTERFACE_CLOCK = true;
```

- [ ] In `apps/web/src/appSettings.ts`, add this field to `AppSettingsSchema` near `timestampFormat`:

```ts
showInterfaceClock: Schema.Boolean.pipe(withDefaults(() => DEFAULT_SHOW_INTERFACE_CLOCK)),
```

- [ ] In `apps/web/src/appSettings.ts`, do not add `showInterfaceClock` to `serverSettingsToAppSettings`, `appSettingsPatchToServerSettingsPatch`, or server migration keys. This keeps the setting local-only.

- [ ] In `apps/web/src/appSettings.test.ts`, import `DEFAULT_SHOW_INTERFACE_CLOCK` from `./appSettings`.

- [ ] In `apps/web/src/appSettings.test.ts`, add these tests:

```ts
describe("interface clock settings", () => {
  it("defaults interface clock visibility to visible", () => {
    expect(DEFAULT_SHOW_INTERFACE_CLOCK).toBe(true);
  });

  it("fills interface clock visibility for persisted settings that predate the key", () => {
    const decode = Schema.decodeSync(Schema.fromJsonString(AppSettingsSchema));

    expect(decode("{}").showInterfaceClock).toBe(true);
  });

  it("keeps interface clock visibility local-only when building server patches", () => {
    expect(appSettingsPatchToServerSettingsPatch({ showInterfaceClock: false })).toEqual({});
    expect(
      appSettingsPatchToServerSettingsPatch({
        showInterfaceClock: false,
        addProjectBaseDirectory: "/home/jay/code",
      }),
    ).toEqual({ addProjectBaseDirectory: "/home/jay/code" });
  });
});
```

- [ ] Run the focused app settings test:

```bash
bun run --cwd apps/web test src/appSettings.test.ts
```

Expected: exits 0.

## Task 2: Add Pure Clock Timing Helper

- [ ] Create `apps/web/src/interfaceClock.ts` with this implementation:

```ts
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
```

- [ ] Create `apps/web/src/interfaceClock.test.ts` with these tests:

```ts
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
```

- [ ] Run the focused clock helper test:

```bash
bun run --cwd apps/web test src/interfaceClock.test.ts
```

Expected: exits 0.

## Task 3: Render Persistent Clock Chrome In Shared Chat Shell

- [ ] Create `apps/web/src/components/InterfaceClock.tsx` with this implementation:

```tsx
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
    let timeoutId: ReturnType<typeof window.setTimeout> | null = null;

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
```

- [ ] Modify `apps/web/src/routes/_chat.tsx` to import `InterfaceClock`:

```ts
import { InterfaceClock } from "../components/InterfaceClock";
```

- [ ] In `apps/web/src/routes/_chat.tsx`, render the clock inside `SidebarProvider` after the `Outlet` and sidebars so it belongs to every `/_chat` child route:

```tsx
<InterfaceClock visible={settings.showInterfaceClock} timestampFormat={settings.timestampFormat} />
```

## Task 4: Add Settings Toggle Near Time Format

- [ ] Modify `apps/web/src/routes/_chat.settings.tsx` so the changed settings label list includes interface clock visibility:

```ts
...(settings.showInterfaceClock !== defaults.showInterfaceClock ? ["Interface clock"] : []),
```

- [ ] In `apps/web/src/routes/_chat.settings.tsx`, add this `SettingsRow` before the existing `Time format` row in the `Time and reading` section:

```tsx
<SettingsRow
  title="Show interface clock"
  description="Show the ambient clock in the bottom-right chat chrome."
  resetAction={
    settings.showInterfaceClock !== defaults.showInterfaceClock ? (
      <SettingResetButton
        label="interface clock"
        onClick={() => updateSettings({ showInterfaceClock: defaults.showInterfaceClock })}
      />
    ) : null
  }
  control={
    <Switch
      checked={settings.showInterfaceClock}
      onCheckedChange={(checked) => updateSettings({ showInterfaceClock: Boolean(checked) })}
      aria-label="Show interface clock"
    />
  }
/>
```

- [ ] Confirm no new clock-specific 12-hour or 24-hour setting is added.

## Task 5: Move Runtime Controls Left Visually

- [ ] Modify the final `RuntimeUsageControls` call in `apps/web/src/components/BranchToolbar.tsx` to reserve right-side space for the persistent clock:

```tsx
<RuntimeUsageControls
  runtimeMode={runtimeMode}
  onRuntimeModeChange={onRuntimeModeChange}
  contextWindow={contextWindow}
  cumulativeCostUsd={cumulativeCostUsd}
  activeContextWindowLabel={activeContextWindowLabel}
  pendingContextWindowLabel={pendingContextWindowLabel}
  className="mr-20 sm:mr-24"
/>
```

- [ ] Do not change the conditional rendering inside `RuntimeUsageControls`. Runtime access and context usage must remain hidden when unavailable.

## Verification

- [ ] Run LSP diagnostics on all modified and created files:

```text
apps/web/src/appSettings.ts
apps/web/src/appSettings.test.ts
apps/web/src/interfaceClock.ts
apps/web/src/interfaceClock.test.ts
apps/web/src/components/InterfaceClock.tsx
apps/web/src/routes/_chat.tsx
apps/web/src/routes/_chat.settings.tsx
apps/web/src/components/BranchToolbar.tsx
```

- [ ] Run formatting check:

```bash
bunx oxfmt@0.52.0 --check apps/web/src/appSettings.ts apps/web/src/appSettings.test.ts apps/web/src/interfaceClock.ts apps/web/src/interfaceClock.test.ts apps/web/src/components/InterfaceClock.tsx apps/web/src/routes/_chat.tsx apps/web/src/routes/_chat.settings.tsx apps/web/src/components/BranchToolbar.tsx
```

Expected: exits 0.

- [ ] Run focused tests:

```bash
bun run --cwd apps/web test src/appSettings.test.ts
bun run --cwd apps/web test src/interfaceClock.test.ts
```

Expected: both commands exit 0.

- [ ] Run focused typecheck through bounded execution:

```bash
safe-run --profile build -- bun run --cwd apps/web typecheck
```

Expected: exits 0.

- [ ] Browser/manual checks:
  - Existing thread: access/context remain visible when available, shifted left, and the clock is visible bottom-right.
  - Initial new-thread prompt: access/context remain hidden, and the clock is still visible.
  - Settings under `/_chat`: clock is visible; `Show interface clock` hides and shows it.
  - Plugins under `/_chat`: clock is visible.
  - Time format `12-hour` and `24-hour` changes affect the clock.
  - No seconds, date, timezone, or separate clock time-format setting exists.

## Self-Review

- Spec coverage: The plan covers the global clock, local-only visibility setting, reuse of existing Time format, preserved runtime-control visibility, runtime-control spacing, focused tests, typecheck, formatting, and browser verification.
- Placeholder scan: No `TBD`, `TODO`, incomplete sections, or placeholder implementation steps remain.
- Type consistency: `showInterfaceClock`, `DEFAULT_SHOW_INTERFACE_CLOCK`, `TimestampFormat`, `formatInterfaceClockTime`, and `getMillisecondsUntilNextMinute` are named consistently across tasks.
