import "../index.css";

import {
  DEFAULT_SERVER_SETTINGS,
  type FirstRunWizardData,
  type NativeApi,
  type OrchestrationShellSnapshot,
  type ServerConfig,
} from "@jcode/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { page } from "vitest/browser";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { getRouter } from "../router";
import { FirstRunWizard } from "./FirstRunWizard";

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

const selectProviderWizardData: FirstRunWizardData = {
  state: { completed: false, skipped: false },
  currentStep: "select-provider",
  scanResults: {
    scannedAt: "2026-06-12T12:00:00.000Z",
    providers: [
      {
        provider: "opencode",
        status: "not-installed",
        hasCredentials: false,
        hasBinary: false,
        credentials: [],
      },
    ],
  },
};

const selectableWizardData: FirstRunWizardData = {
  state: { completed: false, skipped: false },
  currentStep: "select-provider",
  scanResults: {
    scannedAt: "2026-06-12T12:01:00.000Z",
    providers: [
      {
        provider: "opencode",
        status: "ready",
        hasCredentials: true,
        hasBinary: true,
        binaryPath: "/tmp/jcode/opencode",
        version: "1.0.0",
        credentials: [{ source: "env-var", key: "OPENCODE_API_KEY", found: true }],
      },
    ],
  },
};

const completedState = {
  completed: true,
  skipped: false,
  completedAt: "2026-06-12T12:02:00.000Z",
};

const skippedState = {
  completed: false,
  skipped: true,
};

const completedWizardData: FirstRunWizardData = {
  state: completedState,
  currentStep: "complete",
  scanResults: selectableWizardData.scanResults,
};

const testServerConfig: ServerConfig = {
  cwd: "/repo/project",
  worktreesDir: "/repo/project/.jcode/worktrees",
  keybindingsConfigPath: "/repo/project/.jcode/keybindings.json",
  keybindings: [],
  issues: [],
  providers: [],
  availableEditors: [],
};

const emptyShellSnapshot: OrchestrationShellSnapshot = {
  snapshotSequence: 1,
  projects: [],
  threads: [],
  updatedAt: "2026-06-12T12:03:00.000Z",
};

const serverApi = {
  getAuthSession: vi.fn(async () => ({ authenticated: true })),
  getConfig: vi.fn(async () => testServerConfig),
  getEnvironment: vi.fn(async () => ({
    environmentId: "first-run-root-browser-test",
    label: "First run root browser test",
    platform: { os: "linux", arch: "x64" },
    serverVersion: "0.0.0-test",
    capabilities: { repositoryIdentity: false },
  })),
  getSettings: vi.fn(async () => DEFAULT_SERVER_SETTINGS),
  listWorktrees: vi.fn(async () => ({ worktrees: [] })),
  getProviderUsageSnapshot: vi.fn(async () => null),
  updateProvider: vi.fn(async () => ({ providers: testServerConfig.providers })),
  getFirstRunWizardData: vi.fn(async () => selectProviderWizardData),
  completeFirstRunWizard: vi.fn(async () => completedState),
  skipFirstRun: vi.fn(async () => skippedState),
};

const orchestrationApi = {
  onShellEvent: vi.fn(() => () => undefined),
  onThreadEvent: vi.fn(() => () => undefined),
  subscribeShell: vi.fn(async () => undefined),
  unsubscribeShell: vi.fn(async () => undefined),
  subscribeThread: vi.fn(async () => undefined),
  unsubscribeThread: vi.fn(async () => undefined),
  replayEvents: vi.fn(async () => []),
  getShellSnapshot: vi.fn(async () => emptyShellSnapshot),
  repairState: vi.fn(async () => emptyShellSnapshot),
};

const terminalApi = {
  onEvent: vi.fn(() => () => undefined),
};

function installNativeApi(data: FirstRunWizardData) {
  serverApi.getAuthSession.mockResolvedValue({ authenticated: true });
  serverApi.getFirstRunWizardData.mockResolvedValue(data);
  window.nativeApi = {
    server: serverApi,
    orchestration: orchestrationApi,
    terminal: terminalApi,
  } as unknown as NativeApi;
}

async function renderRoutedApp(path = "/") {
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.inset = "0";
  host.style.width = "100vw";
  host.style.height = "100vh";
  host.style.display = "grid";
  host.style.overflow = "hidden";
  document.body.append(host);

  const router = getRouter(createMemoryHistory({ initialEntries: [path] }));
  const screen = await render(<RouterProvider router={router} />, { container: host });

  return {
    unmount: async () => {
      await screen.unmount();
      host.remove();
    },
  };
}

async function renderWizard() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <FirstRunWizard />
    </QueryClientProvider>,
  );
}

describe("FirstRunWizard root integration", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "nativeApi");
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("renders the wizard instead of the normal outlet when authenticated first-run is incomplete", async () => {
    installNativeApi(selectProviderWizardData);
    const screen = await renderRoutedApp();

    try {
      await expect.element(page.getByText("Welcome to JCode")).toBeVisible();
      await expect.element(page.getByText("Choose a provider")).toBeVisible();
      await vi.waitFor(() => {
        expect(serverApi.getFirstRunWizardData).toHaveBeenCalledTimes(1);
      });
    } finally {
      await screen.unmount();
    }
  });

  it("renders normal route outlet content when first-run is completed", async () => {
    installNativeApi(completedWizardData);
    const screen = await renderRoutedApp();

    try {
      await expect.element(page.getByAltText("JCode")).toBeVisible();
      await expect.element(page.getByText("Welcome to JCode")).not.toBeInTheDocument();
    } finally {
      await screen.unmount();
    }
  });
});

describe("FirstRunWizard", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "nativeApi");
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("allows selecting clean-install OpenCode and completing with that provider", async () => {
    installNativeApi(selectProviderWizardData);
    const screen = await renderWizard();

    await expect.element(page.getByText("Choose a provider")).toBeVisible();
    const openCodeButton = page.getByRole("button", { name: /OpenCode/i });
    await expect.element(openCodeButton).toBeEnabled();

    await openCodeButton.click();
    await page.getByRole("button", { name: "Continue" }).click();

    await vi.waitFor(() => {
      expect(serverApi.completeFirstRunWizard).toHaveBeenCalledWith({ provider: "opencode" });
    });

    await screen.unmount();
  });

  it("exposes the selected provider card state to assistive technology", async () => {
    installNativeApi(selectProviderWizardData);
    const screen = await renderWizard();

    await expect.element(page.getByText("Choose a provider")).toBeVisible();
    const openCodeButton = page.getByRole("button", { name: /OpenCode/i });

    await expect.element(openCodeButton).toHaveAttribute("aria-pressed", "false");
    await openCodeButton.click();
    await expect.element(openCodeButton).toHaveAttribute("aria-pressed", "true");

    await screen.unmount();
  });

  it("disables Continue and shows pending progress while completion is pending", async () => {
    const completion = createDeferred<typeof completedState>();
    serverApi.completeFirstRunWizard.mockImplementation(() => completion.promise);
    installNativeApi(selectableWizardData);
    const screen = await renderWizard();

    await expect.element(page.getByText("Choose a provider")).toBeVisible();
    await page.getByRole("button", { name: /OpenCode/i }).click();

    const continueButton = page.getByRole("button", { name: "Continue" });
    await continueButton.click();

    await expect.element(page.getByRole("button", { name: "Completing..." })).toBeDisabled();
    await expect.element(page.getByRole("button", { name: "Skip for now" })).toBeDisabled();
    expect(serverApi.completeFirstRunWizard).toHaveBeenCalledTimes(1);

    completion.resolve(completedState);
    await vi.waitFor(() => {
      expect(serverApi.getFirstRunWizardData).toHaveBeenCalled();
    });

    await screen.unmount();
  });

  it("disables Continue while skip is pending", async () => {
    installNativeApi(selectableWizardData);
    serverApi.skipFirstRun.mockImplementationOnce(() => new Promise<typeof skippedState>(() => {}));
    const screen = await renderWizard();

    await expect.element(page.getByText("Choose a provider")).toBeVisible();
    await page.getByRole("button", { name: /OpenCode/i }).click();
    await page.getByRole("button", { name: "Skip for now" }).click();

    await vi.waitFor(() => {
      expect(serverApi.skipFirstRun).toHaveBeenCalledTimes(1);
    });

    await expect.element(page.getByRole("button", { name: "Continue" })).toBeDisabled();

    await screen.unmount();
  });

  it("skips first-run without completing the wizard", async () => {
    installNativeApi(selectableWizardData);
    const screen = await renderWizard();

    await expect.element(page.getByText("Choose a provider")).toBeVisible();
    await page.getByRole("button", { name: "Skip for now" }).click();

    await vi.waitFor(() => {
      expect(
        serverApi.skipFirstRun.mock.calls.length +
          serverApi.completeFirstRunWizard.mock.calls.length,
      ).toBeGreaterThan(0);
    });
    expect(serverApi.completeFirstRunWizard).not.toHaveBeenCalledWith({});
    expect(serverApi.skipFirstRun).toHaveBeenCalledTimes(1);

    await screen.unmount();
  });
});
