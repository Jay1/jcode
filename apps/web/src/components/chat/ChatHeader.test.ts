// FILE: ChatHeader.test.ts
// Purpose: Covers chat header presentation helpers and lightweight header markup.
// Layer: Component unit tests
// Depends on: ChatHeader pure helpers, static React rendering, and Vitest assertions.

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ThreadId } from "@jcode/contracts";

import { SidebarProvider } from "../ui/sidebar";
import { ChatHeader } from "./ChatHeader";
import { resolveChatHeaderThreadIconKind } from "./ChatHeader.logic";

function createChatHeaderProps(
  overrides: Partial<ComponentProps<typeof ChatHeader>> = {},
): ComponentProps<typeof ChatHeader> {
  return {
    activeThreadId: "thread-chat-header-test" as ThreadId,
    activeThreadTitle: "Fix auth flow",
    activeThreadEntryPoint: "chat",
    activeProvider: "codex",
    activeProjectName: undefined,
    threadBreadcrumbs: [],
    hideHandoffControls: false,
    isGitRepo: false,
    openInCwd: null,
    activeProjectScripts: undefined,
    preferredScriptId: null,
    keybindings: [],
    availableEditors: [],
    terminalAvailable: false,
    terminalOpen: false,
    terminalToggleShortcutLabel: null,
    browserToggleShortcutLabel: null,
    diffToggleShortcutLabel: null,
    handoffBadgeLabel: null,
    handoffActionLabel: "Hand off",
    handoffDisabled: false,
    handoffActionTargetProviders: [],
    handoffBadgeSourceProvider: null,
    handoffBadgeTargetProvider: null,
    threadRecapOpen: false,
    goal: null,
    browserOpen: false,
    gitCwd: null,
    showGitActions: false,
    diffOpen: false,
    diffDisabledReason: null,
    surfaceMode: "single",
    isSidechat: false,
    chatLayoutAction: null,
    changeThreadAction: null,
    onRunProjectScript: vi.fn(),
    onAddProjectScript: vi.fn(async () => undefined),
    onUpdateProjectScript: vi.fn(async () => undefined),
    onDeleteProjectScript: vi.fn(async () => undefined),
    onToggleTerminal: vi.fn(),
    onToggleDiff: vi.fn(),
    onToggleBrowser: vi.fn(),
    onToggleThreadRecap: vi.fn(),
    onCreateHandoff: vi.fn(),
    onNavigateToThread: vi.fn(),
    onRenameThread: vi.fn(),
    ...overrides,
  };
}

function renderChatHeaderMarkup(overrides: Partial<ComponentProps<typeof ChatHeader>> = {}) {
  const queryClient = new QueryClient();

  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(
        SidebarProvider,
        null,
        createElement(ChatHeader, createChatHeaderProps(overrides)),
      ),
    ),
  );
}

describe("resolveChatHeaderThreadIconKind", () => {
  it("uses the terminal icon for terminal-first threads", () => {
    expect(resolveChatHeaderThreadIconKind("terminal", "New terminal")).toBe("terminal");
  });

  it("keeps provider branding for chat-first threads", () => {
    expect(resolveChatHeaderThreadIconKind("chat", "Fix auth flow")).toBe("provider");
  });

  it("hides provider branding for untouched new chat threads", () => {
    expect(resolveChatHeaderThreadIconKind("chat", "New thread")).toBe("none");
  });
});

describe("ChatHeader recap control", () => {
  it("renders the closed recap control as an unpressed toggle", () => {
    const markup = renderChatHeaderMarkup({ threadRecapOpen: false });

    expect(markup).toMatch(/aria-label="Show recap"[^>]*select-none/u);
    expect(markup).toContain('aria-label="Show recap"');
    expect(markup).toContain('aria-pressed="false"');
    expect(markup).not.toContain("tabler-icon-refresh");
    expect(markup).toContain("Recap");
  });

  it("renders the open recap control as a pressed toggle", () => {
    const markup = renderChatHeaderMarkup({ threadRecapOpen: true });

    expect(markup).toMatch(/aria-label="Hide recap"[^>]*select-none/u);
    expect(markup).toContain('aria-label="Hide recap"');
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('data-pressed=""');
    expect(markup).not.toContain("tabler-icon-refresh");
  });
});
