import type { SearchAddon, ISearchOptions } from "@xterm/addon-search";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDownIcon, ChevronUpIcon, XIcon } from "~/lib/icons";
import { resolveRootColorVariable } from "./terminal/terminalColorResolution";
import { cn } from "~/lib/utils";

interface TerminalSearchProps {
  searchAddon: SearchAddon | null;
  isOpen: boolean;
  onClose: () => void;
}

const SEARCH_DECORATION_VARIABLES = {
  matchBackground: ["--app-terminal-search-match-bg", "#45475a"],
  matchBorder: ["--app-terminal-search-match-border", "#89b4fa"],
  matchOverviewRuler: ["--app-terminal-search-match-overview", "#fab387"],
  activeMatchBackground: ["--app-terminal-search-active-match-bg", "#45475a"],
  activeMatchBorder: ["--app-terminal-search-active-match-border", "#f9e2af"],
  activeMatchColorOverviewRuler: ["--app-terminal-search-active-match-overview", "#f9e2af"],
} as const satisfies Record<
  keyof NonNullable<ISearchOptions["decorations"]>,
  readonly [string, string]
>;

function resolveSearchDecorationColor(name: keyof typeof SEARCH_DECORATION_VARIABLES): string {
  const [variableName, fallback] = SEARCH_DECORATION_VARIABLES[name];
  return resolveRootColorVariable(variableName, fallback, {
    format: "hex",
    property: "backgroundColor",
  });
}

function resolveSearchDecorations(): NonNullable<ISearchOptions["decorations"]> {
  return {
    matchBackground: resolveSearchDecorationColor("matchBackground"),
    matchBorder: resolveSearchDecorationColor("matchBorder"),
    matchOverviewRuler: resolveSearchDecorationColor("matchOverviewRuler"),
    activeMatchBackground: resolveSearchDecorationColor("activeMatchBackground"),
    activeMatchBorder: resolveSearchDecorationColor("activeMatchBorder"),
    activeMatchColorOverviewRuler: resolveSearchDecorationColor("activeMatchColorOverviewRuler"),
  };
}

export function TerminalSearch({ searchAddon, isOpen, onClose }: TerminalSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [hasResults, setHasResults] = useState<boolean | null>(null);
  const [caseSensitive, setCaseSensitive] = useState(false);

  const createSearchOptions = useCallback(
    (): ISearchOptions => ({
      caseSensitive,
      regex: false,
      decorations: resolveSearchDecorations(),
    }),
    [caseSensitive],
  );

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen && searchAddon) {
      searchAddon.clearDecorations();
    }
  }, [isOpen, searchAddon]);

  const handleSearch = useCallback(
    (direction: "next" | "previous") => {
      if (!searchAddon || !query) return;
      const found =
        direction === "next"
          ? searchAddon.findNext(query, createSearchOptions())
          : searchAddon.findPrevious(query, createSearchOptions());
      setHasResults(found);
    },
    [searchAddon, query, createSearchOptions],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    if (searchAddon && newQuery) {
      const found = searchAddon.findNext(newQuery, createSearchOptions());
      setHasResults(found);
    } else {
      setHasResults(null);
      searchAddon?.clearDecorations();
    }
  };

  // Re-run search when case sensitivity or search addon changes
  // (but not on query change — handleInputChange handles that).
  const prevCaseSensitiveRef = useRef(caseSensitive);
  const prevSearchAddonRef = useRef<SearchAddon | null>(searchAddon);
  useEffect(() => {
    const caseSensitivityChanged = prevCaseSensitiveRef.current !== caseSensitive;
    const searchAddonChanged = prevSearchAddonRef.current !== searchAddon;
    if (!caseSensitivityChanged && !searchAddonChanged) return;

    prevCaseSensitiveRef.current = caseSensitive;
    prevSearchAddonRef.current = searchAddon;
    if (searchAddon && query) {
      const found = searchAddon.findNext(query, createSearchOptions());
      setHasResults(found);
    }
  }, [searchAddon, query, createSearchOptions, caseSensitive]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleSearch(e.shiftKey ? "previous" : "next");
    }
  };

  const handleClose = () => {
    setQuery("");
    setHasResults(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="absolute right-1 top-1 z-10 flex max-w-[calc(100%-0.5rem)] items-center rounded bg-popover/95 pl-2 pr-0.5 shadow-lg ring-1 ring-border/40 backdrop-blur">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        aria-label="Find in terminal"
        placeholder="Find"
        className="h-6 w-28 min-w-0 flex-shrink bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
      />
      {hasResults === false && query && (
        <span className="whitespace-nowrap px-1 text-xs text-muted-foreground">No results</span>
      )}
      <div className="flex shrink-0 items-center">
        <button
          type="button"
          onClick={() => setCaseSensitive((v) => !v)}
          className={cn(
            "rounded p-1 transition-colors",
            caseSensitive
              ? "bg-primary/20 text-foreground"
              : "text-muted-foreground hover:bg-muted-foreground/20 hover:text-foreground",
          )}
          aria-label="Match case"
        >
          <span className="text-[10px] font-bold leading-none">Aa</span>
        </button>
        <button
          type="button"
          onClick={() => handleSearch("previous")}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted-foreground/20 hover:text-foreground"
          aria-label="Previous match (Shift+Enter)"
        >
          <ChevronUpIcon className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => handleSearch("next")}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted-foreground/20 hover:text-foreground"
          aria-label="Next match (Enter)"
        >
          <ChevronDownIcon className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={handleClose}
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted-foreground/20 hover:text-foreground"
          aria-label="Close search (Esc)"
        >
          <XIcon className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
