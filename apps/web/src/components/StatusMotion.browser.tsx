import "../index.css";

import { cdp } from "vitest/browser";
import { afterEach, describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";

import TerminalActivityIndicator from "./terminal/TerminalActivityIndicator";
import { MessagesTimeline } from "./chat/MessagesTimeline";

type MotionPreference = "no-preference" | "reduce";

async function emulateReducedMotion(preference: MotionPreference): Promise<void> {
  const session = cdp();
  const send = Reflect.get(session, "send");
  if (typeof send !== "function") {
    throw new Error("Vitest browser CDP session does not expose send().");
  }
  await Reflect.apply(send, session, [
    "Emulation.setEmulatedMedia",
    {
      features: [{ name: "prefers-reduced-motion", value: preference }],
    },
  ]);
}

function StatusMotionFixture({ active }: { readonly active: boolean }) {
  return (
    <div className="h-80 w-full bg-background p-6 text-foreground" data-testid="status-fixture">
      <div className="flex items-center gap-4">
        <div data-testid="terminal-status">
          {active ? <TerminalActivityIndicator /> : <span>Terminal idle</span>}
        </div>
        <div data-testid="sidebar-status">
          {active ? (
            <span
              aria-hidden="true"
              className="status-pulse block size-1.5 rounded-full bg-[var(--app-status-input-dot)]"
            />
          ) : (
            <span>Project idle</span>
          )}
        </div>
      </div>
      <div className="mt-6 h-48" data-testid="timeline-status">
        <MessagesTimeline
          hasMessages={false}
          isWorking={active}
          activeTurnInProgress={active}
          activeTurnStartedAt={active ? "2026-07-17T00:00:00.000Z" : null}
          timelineEntries={[]}
          completionDividerBeforeEntryId={null}
          completionSummary={null}
          turnDiffSummaryByAssistantMessageId={new Map()}
          nowIso="2026-07-17T00:00:03.000Z"
          expandedWorkGroups={{}}
          onToggleWorkGroup={() => {}}
          onOpenTurnDiff={() => {}}
          revertTurnCountByUserMessageId={new Map()}
          onRevertUserMessage={() => {}}
          isRevertingCheckpoint={false}
          onImageExpand={() => {}}
          markdownCwd={undefined}
          resolvedTheme="dark"
          timestampFormat="locale"
          workspaceRoot={undefined}
        />
      </div>
    </div>
  );
}

function statusPulses(container: Element): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(".status-pulse"));
}

describe("persistent status motion", () => {
  afterEach(async () => {
    await emulateReducedMotion("no-preference");
    document.body.innerHTML = "";
  });

  it("animates all three persistent families and preserves timeline delays", async () => {
    await emulateReducedMotion("no-preference");
    const screen = await render(<StatusMotionFixture active />);
    try {
      const pulses = statusPulses(screen.container);
      expect(pulses).toHaveLength(8);
      for (const pulse of pulses) {
        const style = getComputedStyle(pulse);
        expect(style.animationName).toBe("status-pulse");
        expect(style.animationDuration).toBe("2s");
        expect(Number.parseFloat(style.opacity)).toBeGreaterThanOrEqual(0.5);
        expect(Number.parseFloat(style.opacity)).toBeLessThanOrEqual(1);
        expect(style.transform).toBe("none");
      }

      const timelineDelays = Array.from(
        screen.container.querySelectorAll<HTMLElement>(
          "[data-testid='timeline-status'] .status-pulse",
        ),
        (pulse) => getComputedStyle(pulse).animationDelay,
      );
      expect(timelineDelays).toEqual(["0s", "0.2s", "0.4s"]);
    } finally {
      await screen.unmount();
    }
  });

  it("keeps reduced-motion statuses visible and stable without animation", async () => {
    await emulateReducedMotion("reduce");
    const screen = await render(<StatusMotionFixture active />);
    try {
      const pulses = statusPulses(screen.container);
      expect(pulses).toHaveLength(8);
      for (const pulse of pulses) {
        const style = getComputedStyle(pulse);
        expect(style.animationName).toBe("none");
        expect(style.opacity).toBe("1");
        expect(style.transform).toBe("none");
        expect(style.visibility).toBe("visible");
      }
    } finally {
      await screen.unmount();
    }
  });

  it("removes persistent pulses when terminal, project, and timeline become idle", async () => {
    await emulateReducedMotion("no-preference");
    const screen = await render(<StatusMotionFixture active />);
    try {
      expect(statusPulses(screen.container)).toHaveLength(8);
      await screen.rerender(<StatusMotionFixture active={false} />);
      expect(statusPulses(screen.container)).toHaveLength(0);
      expect(screen.container.textContent).toContain("Terminal idle");
      expect(screen.container.textContent).toContain("Project idle");
      expect(screen.container.textContent).toContain("Send a message to start the conversation.");
    } finally {
      await screen.unmount();
    }
  });
});
