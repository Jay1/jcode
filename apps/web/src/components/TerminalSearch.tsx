import type { SearchAddon } from "@xterm/addon-search";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDownIcon, ChevronUpIcon, XIcon } from "~/lib/icons";
import { cn } from "~/lib/utils";
import {
  createTerminalSearchOptions,
  runTerminalSearch,
  type TerminalSearchDirection,
} from "./TerminalSearch.logic";

interface TerminalSearchProps {
  searchAddon: SearchAddon | null;
  isOpen: boolean;
  onClose: () => void;
}

export function TerminalSearch({ searchAddon, isOpen, onClose }: TerminalSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [hasResults, setHasResults] = useState<boolean | null>(null);
  const [caseSensitive, setCaseSensitive] = useState(false);

  const searchOptions = useMemo(() => createTerminalSearchOptions(caseSensitive), [caseSensitive]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isOpen]);

  const handleSearch = useCallback(
    (direction: TerminalSearchDirection) => {
      setHasResults(runTerminalSearch(searchAddon, query, searchOptions, direction));
    },
    [searchAddon, query, searchOptions],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    setHasResults(runTerminalSearch(searchAddon, newQuery, searchOptions, "next"));
  };

  const handleCaseSensitiveToggle = () => {
    const nextCaseSensitive = !caseSensitive;
    setCaseSensitive(nextCaseSensitive);
    setHasResults(
      runTerminalSearch(
        searchAddon,
        query,
        createTerminalSearchOptions(nextCaseSensitive),
        "next",
      ),
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      handleClose();
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleSearch(e.shiftKey ? "previous" : "next");
    }
  };

  const handleClose = () => {
    setQuery("");
    setHasResults(null);
    searchAddon?.clearDecorations();
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
        className="h-6 w-28 min-w-0 shrink bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
      />
      {hasResults === false && query && (
        <span className="whitespace-nowrap px-1 text-xs text-muted-foreground">No results</span>
      )}
      <div className="flex shrink-0 items-center">
        <button
          type="button"
          onClick={handleCaseSensitiveToggle}
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
