import type { SearchAddon } from "@xterm/addon-search";
import { describe, expect, it, vi } from "vitest";

import { createTerminalSearchOptions, runTerminalSearch } from "./TerminalSearch.logic";

function makeSearchAddon() {
  return {
    clearDecorations: vi.fn(),
    findNext: vi.fn(() => true),
    findPrevious: vi.fn(() => false),
  } as unknown as SearchAddon & {
    clearDecorations: ReturnType<typeof vi.fn>;
    findNext: ReturnType<typeof vi.fn>;
    findPrevious: ReturnType<typeof vi.fn>;
  };
}

describe("runTerminalSearch", () => {
  it("runs the requested direction with the current options", () => {
    const searchAddon = makeSearchAddon();
    const options = createTerminalSearchOptions(true);

    expect(runTerminalSearch(searchAddon, "needle", options, "previous")).toBe(false);

    expect(searchAddon.findPrevious).toHaveBeenCalledWith("needle", options);
    expect(searchAddon.findNext).not.toHaveBeenCalled();
  });

  it("clears decorations and reports no result for an empty query", () => {
    const searchAddon = makeSearchAddon();

    expect(runTerminalSearch(searchAddon, "", createTerminalSearchOptions(false), "next")).toBeNull();

    expect(searchAddon.clearDecorations).toHaveBeenCalledTimes(1);
    expect(searchAddon.findNext).not.toHaveBeenCalled();
  });
});
