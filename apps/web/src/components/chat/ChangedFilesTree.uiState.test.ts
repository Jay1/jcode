import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getExpandedDirectoryPathsForTurn,
  persistChangedFilesUiState,
  readChangedFilesUiState,
  setExpandedDirectoryPathsForTurn,
} from "./ChangedFilesTree.uiState";

function installWindowWithStorage() {
  vi.stubGlobal("window", {
    localStorage: {
      getItem: () => null,
      setItem: () => {},
    },
  });
}

describe("readChangedFilesUiState", () => {
  beforeEach(() => {
    installWindowWithStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns default state when localStorage is empty", () => {
    expect(readChangedFilesUiState()).toEqual({
      expandedDirectoryPathsByTurnId: {},
    });
  });

  it("returns persisted state when localStorage has data", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () =>
          JSON.stringify({
            expandedDirectoryPathsByTurnId: {
              "turn-1": ["src/components"],
            },
          }),
        setItem: () => {},
      },
    });

    expect(readChangedFilesUiState()).toEqual({
      expandedDirectoryPathsByTurnId: {
        "turn-1": ["src/components"],
      },
    });
  });

  it("filters out invalid entries", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () =>
          JSON.stringify({
            expandedDirectoryPathsByTurnId: {
              "turn-1": ["src/components"],
              "": ["invalid"],
              bad: [123, null],
            },
          }),
        setItem: () => {},
      },
    });

    expect(readChangedFilesUiState()).toEqual({
      expandedDirectoryPathsByTurnId: {
        "turn-1": ["src/components"],
      },
    });
  });

  it("returns default state when localStorage data is malformed", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => "not-json",
        setItem: () => {},
      },
    });

    expect(readChangedFilesUiState()).toEqual({
      expandedDirectoryPathsByTurnId: {},
    });
  });
});

describe("persistChangedFilesUiState", () => {
  beforeEach(() => {
    installWindowWithStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("writes valid state to localStorage", () => {
    const setItem = vi.fn();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => null,
        setItem,
      },
    });

    persistChangedFilesUiState({
      expandedDirectoryPathsByTurnId: {
        "turn-1": ["src/components", "src/lib"],
      },
    });

    expect(setItem).toHaveBeenCalledOnce();
    const call = setItem.mock.calls[0]!;
    const [key, value] = call;
    expect(key).toBe("jcode:changed-files-ui:v1");
    expect(JSON.parse(value as string)).toEqual({
      expandedDirectoryPathsByTurnId: {
        "turn-1": ["src/components", "src/lib"],
      },
    });
  });

  it("filters out empty entries when persisting", () => {
    const setItem = vi.fn();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => null,
        setItem,
      },
    });

    persistChangedFilesUiState({
      expandedDirectoryPathsByTurnId: {
        "turn-1": [],
        "turn-2": ["src/components"],
      },
    });

    const [, value] = setItem.mock.calls[0]!;
    expect(JSON.parse(value as string)).toEqual({
      expandedDirectoryPathsByTurnId: {
        "turn-2": ["src/components"],
      },
    });
  });
});

describe("getExpandedDirectoryPathsForTurn", () => {
  it("returns paths for a known turn", () => {
    const state = {
      expandedDirectoryPathsByTurnId: {
        "turn-1": ["src/components"],
      },
    };
    expect(getExpandedDirectoryPathsForTurn(state, "turn-1")).toEqual(["src/components"]);
  });

  it("returns empty array for an unknown turn", () => {
    const state = {
      expandedDirectoryPathsByTurnId: {},
    };
    expect(getExpandedDirectoryPathsForTurn(state, "turn-1")).toEqual([]);
  });
});

describe("setExpandedDirectoryPathsForTurn", () => {
  it("adds paths for a turn", () => {
    const state = {
      expandedDirectoryPathsByTurnId: {},
    };
    const result = setExpandedDirectoryPathsForTurn(state, "turn-1", ["src/components"]);
    expect(result).toEqual({
      expandedDirectoryPathsByTurnId: {
        "turn-1": ["src/components"],
      },
    });
  });

  it("removes the turn entry when paths are empty", () => {
    const state = {
      expandedDirectoryPathsByTurnId: {
        "turn-1": ["src/components"],
        "turn-2": ["src/lib"],
      },
    };
    const result = setExpandedDirectoryPathsForTurn(state, "turn-1", []);
    expect(result).toEqual({
      expandedDirectoryPathsByTurnId: {
        "turn-2": ["src/lib"],
      },
    });
  });

  it("filters out empty path strings", () => {
    const state = {
      expandedDirectoryPathsByTurnId: {},
    };
    const result = setExpandedDirectoryPathsForTurn(state, "turn-1", ["src/components", ""]);
    expect(result).toEqual({
      expandedDirectoryPathsByTurnId: {
        "turn-1": ["src/components"],
      },
    });
  });
});
