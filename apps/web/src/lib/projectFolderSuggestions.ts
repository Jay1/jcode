import { normalizeWorkspaceRootForComparison } from "@jcode/shared/threadWorkspace";

import type { Project } from "../types";

export interface ProjectFolderSuggestionEntry {
  path: string;
  name: string;
  kind: "directory" | "file";
  hasChildren?: boolean | undefined;
}

export interface ProjectFolderSuggestion {
  path: string;
  name: string;
}

export function normalizeProjectFolderPath(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function resolveProjectFolderChildPath(projectFolderPath: string, childPath: string): string {
  const trimmedFolder = projectFolderPath.replace(/[\\/]+$/, "");
  const separator = trimmedFolder.includes("\\") && !trimmedFolder.includes("/") ? "\\" : "/";
  const normalizedChild = childPath.replace(/^[\\/]+/, "").replace(/[\\/]+/g, separator);
  return `${trimmedFolder}${separator}${normalizedChild}`;
}

export function mapProjectFolderDirectoryEntries(input: {
  projectFolderPath: string;
  entries: readonly ProjectFolderSuggestionEntry[];
}): ProjectFolderSuggestionEntry[] {
  return input.entries.flatMap((entry) => {
    if (entry.kind !== "directory") {
      return [];
    }
    return [
      {
        ...entry,
        path: resolveProjectFolderChildPath(input.projectFolderPath, entry.path),
      },
    ];
  });
}

export function filterProjectFolderSuggestions(input: {
  entries: readonly ProjectFolderSuggestionEntry[];
  projects: readonly Pick<Project, "cwd">[];
}): ProjectFolderSuggestion[] {
  const existingWorkspaceRoots = new Set(
    input.projects.map((project) => normalizeWorkspaceRootForComparison(project.cwd)),
  );

  return input.entries.flatMap((entry) => {
    if (entry.kind !== "directory") {
      return [];
    }
    if (existingWorkspaceRoots.has(normalizeWorkspaceRootForComparison(entry.path))) {
      return [];
    }
    return [{ path: entry.path, name: entry.name }];
  });
}
