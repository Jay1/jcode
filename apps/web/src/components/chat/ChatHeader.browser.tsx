import "../../index.css";

import { ThreadId, type ResolvedKeybindingsConfig } from "@jcode/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { page } from "vitest/browser";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { SidebarProvider } from "../ui/sidebar";
import { ChatHeader } from "./ChatHeader";

const THREAD_ID = ThreadId.makeUnsafe("thread-chat-header-browser");
const KEYBINDINGS: ResolvedKeybindingsConfig = [];

async function renderChatHeader(props?: {
  threadRecapOpen?: boolean;
  onToggleThreadRecap?: () => void;
}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  const host = document.createElement("div");
  document.body.append(host);
  const onToggleThreadRecap = props?.onToggleThreadRecap ?? vi.fn();
  const screen = await render(
    <QueryClientProvider client={queryClient}>
      <SidebarProvider>
        <ChatHeader
          activeThreadId={THREAD_ID}
          activeThreadTitle="Browser header test"
          activeThreadEntryPoint="chat"
          activeProvider="codex"
          activeProjectName={undefined}
          threadBreadcrumbs={[]}
          isGitRepo={false}
          openInCwd={null}
          activeProjectScripts={undefined}
          preferredScriptId={null}
          keybindings={KEYBINDINGS}
          availableEditors={[]}
          terminalAvailable={false}
          terminalOpen={false}
          terminalToggleShortcutLabel={null}
          browserToggleShortcutLabel={null}
          diffToggleShortcutLabel={null}
          handoffBadgeLabel={null}
          handoffActionLabel="Hand off"
          handoffDisabled={false}
          handoffActionTargetProviders={[]}
          handoffBadgeSourceProvider={null}
          handoffBadgeTargetProvider={null}
          threadRecapOpen={props?.threadRecapOpen ?? false}
          browserOpen={false}
          gitCwd={null}
          showGitActions={false}
          diffOpen={false}
          onRunProjectScript={vi.fn()}
          onAddProjectScript={async () => {}}
          onUpdateProjectScript={async () => {}}
          onDeleteProjectScript={async () => {}}
          onToggleTerminal={vi.fn()}
          onToggleDiff={vi.fn()}
          onToggleBrowser={vi.fn()}
          onToggleThreadRecap={onToggleThreadRecap}
          onCreateHandoff={vi.fn()}
          onNavigateToThread={vi.fn()}
          onRenameThread={vi.fn()}
        />
      </SidebarProvider>
    </QueryClientProvider>,
    { container: host },
  );

  const cleanup = async () => {
    await screen.unmount();
    queryClient.clear();
    host.remove();
  };

  return {
    cleanup,
    onToggleThreadRecap,
  };
}

describe("ChatHeader Recap control", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders the closed Recap control as a Toggle and calls the toggle handler", async () => {
    const onToggleThreadRecap = vi.fn();
    const mounted = await renderChatHeader({ onToggleThreadRecap });

    try {
      const recapControl = page.getByRole("button", { name: "Show recap" });
      const recapClassName = recapControl.element().className;

      expect(recapClassName).toContain("select-none");
      expect(recapClassName).not.toContain("text-[length:var(--app-font-size-ui-sm,11px)]");
      await expect.element(recapControl).toHaveAttribute("aria-pressed", "false");
      expect(recapControl.element().querySelectorAll("svg path").length).toBeGreaterThanOrEqual(3);

      await recapControl.click();

      expect(onToggleThreadRecap).toHaveBeenCalledTimes(1);
    } finally {
      await mounted.cleanup();
    }
  });

  it("updates the Recap control accessible label when open", async () => {
    const mounted = await renderChatHeader({ threadRecapOpen: true });

    try {
      const recapControl = page.getByRole("button", { name: "Hide recap" });
      const recapClassName = recapControl.element().className;

      expect(recapClassName).toContain("select-none");
      expect(recapClassName).not.toContain("text-[length:var(--app-font-size-ui-sm,11px)]");
      await expect.element(recapControl).toHaveAttribute("aria-pressed", "true");
      expect(recapControl.element().querySelectorAll("svg path").length).toBeGreaterThanOrEqual(3);
    } finally {
      await mounted.cleanup();
    }
  });
});
