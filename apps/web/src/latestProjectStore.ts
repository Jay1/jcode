import type { ProjectId } from "@jcode/contracts";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { getLocalStorage } from "./lib/storage";

const LATEST_PROJECT_STORAGE_KEY = "jcode:latest-project:v1";

interface LatestProjectStore {
  latestProjectId: ProjectId | null;
  setLatestProjectId: (projectId: ProjectId) => void;
  clearLatestProjectId: (projectId?: ProjectId) => void;
}

export const useLatestProjectStore = create<LatestProjectStore>()(
  persist(
    (set) => ({
      latestProjectId: null,
      setLatestProjectId: (projectId) => set({ latestProjectId: projectId }),
      clearLatestProjectId: (projectId) =>
        set((state) => {
          if (projectId && state.latestProjectId !== projectId) {
            return state;
          }
          if (state.latestProjectId === null) {
            return state;
          }
          return { latestProjectId: null };
        }),
    }),
    {
      name: LATEST_PROJECT_STORAGE_KEY,
      storage: createJSONStorage(() => getLocalStorage()),
    },
  ),
);
