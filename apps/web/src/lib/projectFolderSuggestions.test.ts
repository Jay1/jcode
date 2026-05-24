import { describe, expect, it } from "vitest";

import {
  filterProjectFolderSuggestions,
  mapProjectFolderDirectoryEntries,
  normalizeProjectFolderPath,
} from "./projectFolderSuggestions";

describe("projectFolderSuggestions", () => {
  it("normalizes an empty project folder path to null", () => {
    expect(normalizeProjectFolderPath("   ")).toBeNull();
  });

  it("trims a configured project folder path", () => {
    expect(normalizeProjectFolderPath("  /home/jay/code  ")).toBe("/home/jay/code");
  });

  it("maps relative directory entries to absolute child folder paths", () => {
    expect(
      mapProjectFolderDirectoryEntries({
        projectFolderPath: "/home/jay/code/",
        entries: [
          { path: "jcode", name: "jcode", kind: "directory", hasChildren: false },
          { path: "notes.txt", name: "notes.txt", kind: "file" },
        ],
      }),
    ).toEqual([
      { path: "/home/jay/code/jcode", name: "jcode", kind: "directory", hasChildren: false },
    ]);
  });

  it("filters out child folders already represented by projects", () => {
    const suggestions = filterProjectFolderSuggestions({
      entries: [
        { path: "/home/jay/code/jcode", name: "jcode", kind: "directory", hasChildren: true },
        {
          path: "/home/jay/code/seekakey",
          name: "seekakey",
          kind: "directory",
          hasChildren: false,
        },
        { path: "/home/jay/code/notes.txt", name: "notes.txt", kind: "file" },
      ],
      projects: [
        {
          cwd: "/home/jay/code/jcode/",
        },
      ],
    });

    expect(suggestions).toEqual([
      {
        path: "/home/jay/code/seekakey",
        name: "seekakey",
      },
    ]);
  });
});
