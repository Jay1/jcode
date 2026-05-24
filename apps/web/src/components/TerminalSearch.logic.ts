import type { ISearchOptions, SearchAddon } from "@xterm/addon-search";

export type TerminalSearchDirection = "next" | "previous";

const SEARCH_DECORATIONS = {
  matchBackground: "#515c6a",
  matchBorder: "#74879f",
  matchOverviewRuler: "#d186167e",
  activeMatchBackground: "#515c6a",
  activeMatchBorder: "#ffd33d",
  activeMatchColorOverviewRuler: "#ffd33d",
} satisfies NonNullable<ISearchOptions["decorations"]>;

export function createTerminalSearchOptions(caseSensitive: boolean): ISearchOptions {
  return {
    caseSensitive,
    regex: false,
    decorations: SEARCH_DECORATIONS,
  };
}

export function runTerminalSearch(
  searchAddon: SearchAddon | null,
  query: string,
  searchOptions: ISearchOptions,
  direction: TerminalSearchDirection,
): boolean | null {
  if (!searchAddon || !query) {
    searchAddon?.clearDecorations();
    return null;
  }

  return direction === "next"
    ? searchAddon.findNext(query, searchOptions)
    : searchAddon.findPrevious(query, searchOptions);
}
