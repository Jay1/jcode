import "../index.css";

import { page } from "vitest/browser";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { ProjectSidebarIcon } from "./ProjectSidebarIcon";

type ImageLoadListener = () => void;

const originalImage = window.Image;

function installImageProbeRecorder(requests: string[]) {
  class MockImage {
    private loadListeners: ImageLoadListener[] = [];

    addEventListener(type: string, listener: ImageLoadListener) {
      if (type === "load") {
        this.loadListeners.push(listener);
      }
    }

    removeEventListener(type: string, listener: ImageLoadListener) {
      if (type !== "load") return;
      this.loadListeners = this.loadListeners.filter((candidate) => candidate !== listener);
    }

    set src(value: string) {
      requests.push(value);
      window.setTimeout(() => {
        for (const listener of this.loadListeners) {
          listener();
        }
      }, 0);
    }
  }

  Object.defineProperty(window, "Image", {
    configurable: true,
    value: MockImage,
  });
}

afterEach(() => {
  Object.defineProperty(window, "Image", {
    configurable: true,
    value: originalImage,
  });
});

describe("ProjectSidebarIcon", () => {
  it("renders TypeScript project icon metadata without probing for a favicon", async () => {
    const imageRequests: string[] = [];
    installImageProbeRecorder(imageRequests);

    const screen = await render(
      <ProjectSidebarIcon
        cwd="/workspace/typescript-app"
        expanded={false}
        iconMetadata={{ iconId: "typescript", label: "TypeScript" }}
      />,
    );

    await expect.element(page.getByLabelText("TypeScript project icon")).toBeInTheDocument();
    await expect.element(page.getByText("TS")).toBeInTheDocument();
    expect(screen.container.textContent).not.toContain("V");
    expect(imageRequests).toEqual([]);
    await screen.unmount();
  });

  it("renders Vue project icon metadata distinctly", async () => {
    const imageRequests: string[] = [];
    installImageProbeRecorder(imageRequests);

    const screen = await render(
      <ProjectSidebarIcon
        cwd="/workspace/vue-app"
        expanded={false}
        iconMetadata={{ iconId: "vue", label: "Vue" }}
      />,
    );

    await expect.element(page.getByLabelText("Vue project icon")).toBeInTheDocument();
    await expect.element(page.getByText("V")).toBeInTheDocument();
    expect(screen.container.textContent).not.toContain("TS");
    expect(imageRequests).toEqual([]);
    await screen.unmount();
  });

  it("keeps the folder and favicon fallback when icon metadata is null", async () => {
    const imageRequests: string[] = [];
    installImageProbeRecorder(imageRequests);

    const screen = await render(
      <span className="relative inline-flex size-5 items-center justify-center">
        <ProjectSidebarIcon cwd="/workspace/plain-folder" expanded={false} iconMetadata={null} />
      </span>,
    );

    expect(screen.container.querySelector("svg")).not.toBeNull();
    await vi.waitFor(() => {
      expect(screen.container.querySelector("img")?.getAttribute("src")).toContain(
        "/api/project-favicon",
      );
    });
    expect(imageRequests).toHaveLength(1);
    await screen.unmount();
  });
});
