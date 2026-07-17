import "../index.css";

import { page } from "vitest/browser";
import { afterEach, describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import {
  MacTrafficLightInsetLayout,
  resolveMacTrafficLightInset,
  type MacTrafficLightInsetKind,
  type MacTrafficLightInsetProperty,
} from "../macTrafficLightInset";

type FixtureTheme = "light" | "dark";
type FixtureState = "startup" | "windowed" | "fullscreen" | "race-fullscreen";

type TrafficLightConsumer = {
  readonly id: string;
  readonly insetProperty: MacTrafficLightInsetProperty;
  readonly kind: MacTrafficLightInsetKind;
  readonly label: string;
  readonly placement: "left-sidebar" | "right-chat";
};

const consumers = [
  {
    id: "sidebar-titlebar",
    insetProperty: "padding-left",
    kind: "titlebar",
    label: "Sidebar · open",
    placement: "left-sidebar",
  },
  {
    id: "collapsed-sidebar-trigger",
    insetProperty: "margin-left",
    kind: "collapsed-sidebar-trigger",
    label: "Sidebar · closed",
    placement: "left-sidebar",
  },
  {
    id: "empty-chat-titlebar",
    insetProperty: "padding-left",
    kind: "titlebar",
    label: "Chat · no thread",
    placement: "right-chat",
  },
  {
    id: "active-chat-titlebar",
    insetProperty: "padding-left",
    kind: "titlebar",
    label: "Chat · active thread",
    placement: "right-chat",
  },
] as const satisfies readonly TrafficLightConsumer[];

function TrafficLights() {
  return (
    <div
      aria-hidden="true"
      className="absolute top-[19px] left-[14px] flex gap-2"
      data-testid="traffic-lights"
    >
      <span className="size-3 rounded-full bg-[#ff5f57] shadow-[inset_0_0_0_0.5px_#c94038]" />
      <span className="size-3 rounded-full bg-[#febc2e] shadow-[inset_0_0_0_0.5px_#d89d24]" />
      <span className="size-3 rounded-full bg-[#28c840] shadow-[inset_0_0_0_0.5px_#1da832]" />
    </div>
  );
}

function ProductionInsetConsumer({
  consumer,
  isFullscreen,
}: {
  readonly consumer: TrafficLightConsumer;
  readonly isFullscreen: boolean;
}) {
  const inset = resolveMacTrafficLightInset({
    kind: consumer.kind,
    isElectron: true,
    isMac: true,
    isFullscreen,
  });
  const isCollapsedTrigger = consumer.kind === "collapsed-sidebar-trigger";

  return (
    <article
      className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--app-surface-canvas)] shadow-sm"
      data-layout-consumer={consumer.id}
      data-placement={consumer.placement}
    >
      <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
        <div>
          <h2 className="text-xs font-semibold text-[var(--foreground)]">{consumer.label}</h2>
          <p className="text-[10px] text-[var(--muted-foreground)]">{consumer.placement}</p>
        </div>
        <span className="rounded-full bg-[var(--muted)] px-2 py-1 font-mono text-[10px] text-[var(--muted-foreground)]">
          {inset}px
        </span>
      </div>
      <div
        className="layout-origin relative h-[52px] bg-[var(--app-surface-topbar)]"
        data-testid={`${consumer.id}-origin`}
      >
        {!isFullscreen && <TrafficLights />}
        {isCollapsedTrigger ? (
          <MacTrafficLightInsetLayout
            className="layout-content mt-2 inline-flex size-9 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--app-chrome-control-bg)] text-[var(--foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-state-focus)]"
            data-testid={`${consumer.id}-content`}
            inset={inset}
            insetProperty={consumer.insetProperty}
            render={<button aria-label="Open sidebar" type="button" />}
          >
            <span aria-hidden="true" className="h-3 w-3 border-y border-current" />
          </MacTrafficLightInsetLayout>
        ) : (
          <MacTrafficLightInsetLayout
            className="layout-header flex h-[52px] items-center"
            data-testid={`${consumer.id}-inset`}
            inset={inset}
            insetProperty={consumer.insetProperty}
          >
            <button
              aria-label={`Inspect ${consumer.label}`}
              className="layout-content inline-flex h-8 items-center rounded-md border border-[var(--border)] bg-[var(--app-chrome-control-bg)] px-3 text-xs font-medium text-[var(--foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-state-focus)]"
              data-testid={`${consumer.id}-content`}
              type="button"
            >
              {consumer.id === "empty-chat-titlebar" ? "No active thread" : "JCode"}
            </button>
          </MacTrafficLightInsetLayout>
        )}
      </div>
    </article>
  );
}

function MacTrafficLightFixture({
  isFullscreen,
  state,
  theme,
}: {
  readonly isFullscreen: boolean;
  readonly state: FixtureState;
  readonly theme: FixtureTheme;
}) {
  return (
    <main
      className={`${theme === "dark" ? "dark" : ""} min-h-screen bg-[var(--background)] p-3 font-sans text-[var(--foreground)] sm:p-8`}
      data-fullscreen={String(isFullscreen)}
      data-state={state}
      data-theme={theme}
    >
      <div className="mx-auto max-w-5xl">
        <header className="mb-4 sm:mb-6">
          <p className="mb-1 text-xs font-medium tracking-[0.16em] text-[var(--muted-foreground)] uppercase">
            Simulated macOS Electron · {state}
          </p>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            Native traffic-light clearance
          </h1>
        </header>
        <section
          aria-label="Traffic-light inset consumers"
          className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-5"
        >
          {consumers.map((consumer) => (
            <ProductionInsetConsumer
              consumer={consumer}
              isFullscreen={isFullscreen}
              key={consumer.id}
            />
          ))}
        </section>
      </div>
    </main>
  );
}

afterEach(() => {
  document.documentElement.classList.remove("dark");
  document.body.innerHTML = "";
});

describe("simulated macOS fullscreen traffic-light layout", () => {
  it.each([
    { state: "startup", isFullscreen: false, theme: "light", width: 1280 },
    { state: "windowed", isFullscreen: false, theme: "light", width: 1280 },
    { state: "fullscreen", isFullscreen: true, theme: "light", width: 1280 },
    { state: "race-fullscreen", isFullscreen: true, theme: "light", width: 1280 },
    { state: "startup", isFullscreen: false, theme: "dark", width: 1280 },
    { state: "windowed", isFullscreen: false, theme: "dark", width: 1280 },
    { state: "fullscreen", isFullscreen: true, theme: "dark", width: 1280 },
    { state: "race-fullscreen", isFullscreen: true, theme: "dark", width: 1280 },
    { state: "windowed", isFullscreen: false, theme: "light", width: 375 },
    { state: "fullscreen", isFullscreen: true, theme: "light", width: 375 },
    { state: "windowed", isFullscreen: false, theme: "dark", width: 375 },
    { state: "fullscreen", isFullscreen: true, theme: "dark", width: 375 },
  ] as const)(
    "applies production geometry for $state in $theme at $width px",
    async ({ state, isFullscreen, theme, width }) => {
      // Given the exact production layout primitive at a desktop lifecycle state and width
      await page.viewport(width, 800);
      document.documentElement.classList.toggle("dark", theme === "dark");
      const screen = await render(
        <MacTrafficLightFixture isFullscreen={isFullscreen} state={state} theme={theme} />,
      );

      try {
        // When all four production variants render
        for (const consumer of consumers) {
          const origin = screen.getByTestId(`${consumer.id}-origin`).element();
          const content = screen.getByTestId(`${consumer.id}-content`).element();
          const insetElement =
            consumer.kind === "titlebar"
              ? screen.getByTestId(`${consumer.id}-inset`).element()
              : content;
          const expectedInset = isFullscreen ? 0 : consumer.kind === "titlebar" ? 90 : 76;
          const computedStyle = getComputedStyle(insetElement);

          // Then the real primitive owns the expected style and geometry
          expect(
            Math.round(
              Number.parseFloat(
                consumer.insetProperty === "padding-left"
                  ? computedStyle.paddingLeft
                  : computedStyle.marginLeft,
              ),
            ),
            consumer.id,
          ).toBe(expectedInset);
          expect(
            Math.round(content.getBoundingClientRect().left - origin.getBoundingClientRect().left),
            consumer.id,
          ).toBe(expectedInset);
          expect(content.getBoundingClientRect().right, consumer.id).toBeLessThanOrEqual(
            origin.getBoundingClientRect().right,
          );
        }
        expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
      } finally {
        await screen.unmount();
      }
    },
  );

  it.each(["light", "dark"] as const)(
    "keeps every control reachable in the $theme theme",
    async (theme) => {
      await page.viewport(768, 800);
      document.documentElement.classList.toggle("dark", theme === "dark");
      const screen = await render(
        <MacTrafficLightFixture isFullscreen={false} state="windowed" theme={theme} />,
      );

      try {
        for (const consumer of consumers) {
          const content = screen.getByTestId(`${consumer.id}-content`).element();
          content.focus();
          expect(document.activeElement).toBe(content);
        }
      } finally {
        await screen.unmount();
      }
    },
  );

  it("preserves caller styles when the current sidebar placement disables an inset", async () => {
    const screen = await render(
      <MacTrafficLightInsetLayout
        data-testid="disabled-placement"
        enabled={false}
        inset={90}
        insetProperty="padding-left"
        style={{ paddingRight: 20 }}
      />,
    );

    try {
      const element = screen.getByTestId("disabled-placement").element();
      expect(getComputedStyle(element).paddingLeft).toBe("0px");
      expect(getComputedStyle(element).paddingRight).toBe("20px");
    } finally {
      await screen.unmount();
    }
  });

  it("keeps regular browser and non-Mac desktop controls at zero", () => {
    for (const kind of ["titlebar", "collapsed-sidebar-trigger"] as const) {
      expect(
        resolveMacTrafficLightInset({ kind, isElectron: false, isMac: true, isFullscreen: false }),
      ).toBe(0);
      expect(
        resolveMacTrafficLightInset({ kind, isElectron: true, isMac: false, isFullscreen: false }),
      ).toBe(0);
    }
  });
});
