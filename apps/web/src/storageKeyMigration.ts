// FILE: storageKeyMigration.ts
// Purpose: Migrates legacy browser storage keys to the JCode namespace.
// Layer: Web bootstrap utility
// Exports: migrateJCodeLocalStorageKeys

const STORAGE_KEY_MIGRATIONS = [
  [["dpcode:renderer-state:v8", "t3code:renderer-state:v8"], "jcode:renderer-state:v8"],
  [["dpcode:composer-drafts:v1", "t3code:composer-drafts:v1"], "jcode:composer-drafts:v1"],
  [["dpcode:split-view-state:v1", "t3code:split-view-state:v1"], "jcode:split-view-state:v1"],
  [["dpcode:sidebar-ui:v1", "t3code:sidebar-ui:v1"], "jcode:sidebar-ui:v1"],
  [
    ["dpcode:single-chat-panel-state:v1", "t3code:single-chat-panel-state:v1"],
    "jcode:single-chat-panel-state:v1",
  ],
  [["dpcode:terminal-state:v1", "t3code:terminal-state:v1"], "jcode:terminal-state:v1"],
  [["dpcode:latest-project:v1", "t3code:latest-project:v1"], "jcode:latest-project:v1"],
  [["dpcode:app-settings:v1", "t3code:app-settings:v1"], "jcode:app-settings:v1"],
  [["dpcode:pinned-threads:v1", "t3code:pinned-threads:v1"], "jcode:pinned-threads:v1"],
  [["dpcode:browser-state:v1", "t3code:browser-state:v1"], "jcode:browser-state:v1"],
  [["dpcode:workspace-pages:v2", "t3code:workspace-pages:v2"], "jcode:workspace-pages:v2"],
  [["dpcode:theme", "t3code:theme"], "jcode:theme"],
  [["dpcode:last-editor", "t3code:last-editor"], "jcode:last-editor"],
  [
    ["dpcode:last-invoked-script-by-project", "t3code:last-invoked-script-by-project"],
    "jcode:last-invoked-script-by-project",
  ],
] as const;

export function migrateJCodeLocalStorageKeys(): void {
  // Prefer globalThis.localStorage so this works identically in browsers (where
  // globalThis === window) and in node-based unit tests that stub the global.
  let storage: Storage | null = null;
  try {
    storage = globalThis.localStorage ?? null;
  } catch {
    return;
  }
  if (!storage) {
    return;
  }

  try {
    for (const [legacyKeys, nextKey] of STORAGE_KEY_MIGRATIONS) {
      if (storage.getItem(nextKey) !== null) {
        continue;
      }
      const legacyValue = legacyKeys
        .map((legacyKey) => storage.getItem(legacyKey))
        .find((value): value is string => value !== null);
      if (legacyValue !== undefined) {
        storage.setItem(nextKey, legacyValue);
      }
    }
  } catch {
    // Storage can be unavailable in private/sandboxed contexts; the app should still boot.
  }
}

// Run during bootstrap before stores hydrate from localStorage.
migrateJCodeLocalStorageKeys();
