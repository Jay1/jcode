/// <reference types="vite/client" />

import type { DesktopBridge, NativeApi, ProjectId, ThreadId } from "@jcode/contracts";

declare module "vitest/browser" {
  interface BrowserCommands {
    dragSidebarProject: (sourceId: ProjectId, targetId: ProjectId) => Promise<void>;
    dragPinnedThread: (sourceId: ThreadId, targetId: ThreadId) => Promise<void>;
    dragPinnedThreadOutOfBounds: (sourceId: ThreadId) => Promise<boolean>;
    keyboardMovePinnedThread: (
      sourceId: ThreadId,
      direction: "ArrowUp" | "ArrowDown",
    ) => Promise<void>;
    selectProjectSortOption: (name: string) => Promise<void>;
    clickProjectThreadPin: (threadId: ThreadId) => Promise<void>;
    clickPinnedThreadUnpin: (threadId: ThreadId) => Promise<void>;
  }
}

interface ImportMetaEnv {
  readonly APP_VERSION: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  interface Window {
    nativeApi?: NativeApi;
    desktopBridge?: DesktopBridge;
  }
}
