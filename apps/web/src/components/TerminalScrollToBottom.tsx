import type { Terminal } from "@xterm/xterm";
import { useEffect, useState } from "react";
import { cn } from "~/lib/utils";

interface TerminalScrollToBottomProps {
  terminal: Terminal | null;
}

export function TerminalScrollToBottom({ terminal }: TerminalScrollToBottomProps) {
  const [isVisible, setIsVisible] = useState(false);
  const isButtonVisible = terminal !== null && isVisible;

  useEffect(() => {
    if (!terminal) {
      return;
    }
    let visibilityRaf: number | null = null;
    const checkPosition = () => {
      const buf = terminal.buffer.active;
      const nextVisible = buf.viewportY < buf.baseY;
      setIsVisible((current) => (current === nextVisible ? current : nextVisible));
    };
    const scheduleVisibilityCheck = () => {
      if (visibilityRaf !== null) {
        return;
      }
      visibilityRaf = window.requestAnimationFrame(() => {
        visibilityRaf = null;
        checkPosition();
      });
    };
    scheduleVisibilityCheck();
    const d1 = terminal.onWriteParsed(scheduleVisibilityCheck);
    const d2 = terminal.onScroll(scheduleVisibilityCheck);
    return () => {
      if (visibilityRaf !== null) {
        window.cancelAnimationFrame(visibilityRaf);
        visibilityRaf = null;
      }
      d1.dispose();
      d2.dispose();
    };
  }, [terminal]);

  const scrollToBottom = () => terminal?.scrollToBottom();

  return (
    <div
      className={cn(
        "absolute bottom-4 left-1/2 z-10 -translate-x-1/2 transition-all duration-200",
        isButtonVisible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-2 opacity-0",
      )}
    >
      <button
        type="button"
        onClick={scrollToBottom}
        className="flex size-7 items-center justify-center rounded-full border border-[color:var(--app-scroll-button-border)] bg-[var(--app-scroll-button-bg)] text-[var(--app-scroll-button-fg)] shadow-sm transition-colors hover:bg-[var(--app-scroll-button-hover-bg)] hover:text-[var(--app-scroll-button-hover-fg)]"
        aria-label="Scroll to bottom"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="size-3.5"
        >
          <path
            fillRule="evenodd"
            d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </div>
  );
}
