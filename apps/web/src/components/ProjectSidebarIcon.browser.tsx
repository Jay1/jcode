import "../index.css";

import { page } from "vitest/browser";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { ProjectSidebarIcon } from "./ProjectSidebarIcon";
import {
  PROJECT_HEADER_ICON_SIZE_CLASS,
  getProjectHeaderIconClassName,
} from "./projectSidebarIconPresentation";

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
  it("renders a branded TypeScript project icon without probing for a favicon", async () => {
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
    const icon = screen.container.querySelector('[data-project-icon-id="typescript"]');
    expect(icon).not.toBeNull();
    const svg = icon?.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.classList.contains("size-[94%]")).toBe(true);
    expect(getComputedStyle(icon as HTMLElement).color).toBe("rgb(49, 120, 198)");
    expect(getComputedStyle(icon as HTMLElement).backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(screen.container.textContent).not.toContain("TS");
    expect(imageRequests).toEqual([]);
    await screen.unmount();
  });

  it("renders Vue project icon metadata distinctly with brand color", async () => {
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
    const icon = screen.container.querySelector('[data-project-icon-id="vue"]');
    expect(icon).not.toBeNull();
    expect(icon?.querySelector("svg")).not.toBeNull();
    expect(getComputedStyle(icon as HTMLElement).color).toBe("rgb(66, 184, 131)");
    expect(screen.container.textContent).not.toContain("TS");
    expect(imageRequests).toEqual([]);
    await screen.unmount();
  });

  it("keeps the sidebar project header wrapper flat for language icons", async () => {
    const imageRequests: string[] = [];
    installImageProbeRecorder(imageRequests);

    const screen = await render(
      <span className={getProjectHeaderIconClassName()} data-testid="project-icon-wrapper">
        <ProjectSidebarIcon
          className={PROJECT_HEADER_ICON_SIZE_CLASS}
          cwd="/workspace/typescript-app"
          expanded={false}
          iconMetadata={{ iconId: "typescript", label: "TypeScript" }}
        />
      </span>,
    );

    const wrapper = screen.getByTestId("project-icon-wrapper");
    await expect.element(wrapper).toBeInTheDocument();
    expect(getComputedStyle(wrapper.element()).backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(getComputedStyle(wrapper.element()).borderTopWidth).toBe("0px");
    expect(wrapper.element().className).not.toContain("rounded-md");
    expect(wrapper.element().className).not.toContain("bg-[");
    expect(wrapper.element().className).not.toContain("border ");
    expect(imageRequests).toEqual([]);
    await screen.unmount();
  });

  it("keeps the sidebar project header wrapper flat for folder icons", async () => {
    const imageRequests: string[] = [];
    installImageProbeRecorder(imageRequests);

    const screen = await render(
      <span className={getProjectHeaderIconClassName()} data-testid="project-icon-wrapper">
        <ProjectSidebarIcon
          className={PROJECT_HEADER_ICON_SIZE_CLASS}
          cwd="/workspace/plain-folder"
          expanded={false}
          iconMetadata={null}
        />
      </span>,
    );

    const wrapper = screen.getByTestId("project-icon-wrapper");
    const folderIcon = screen.container.querySelector("svg");
    await expect.element(wrapper).toBeInTheDocument();
    expect(getComputedStyle(wrapper.element()).backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(getComputedStyle(wrapper.element()).borderTopWidth).toBe("0px");
    expect(wrapper.element().className).not.toContain("rounded-md");
    expect(folderIcon).not.toBeNull();
    expect(folderIcon?.classList.contains(PROJECT_HEADER_ICON_SIZE_CLASS)).toBe(true);
    await vi.waitFor(() => {
      expect(screen.container.querySelector("img")?.getAttribute("src")).toContain(
        "/api/project-favicon",
      );
    });
    expect(imageRequests).toHaveLength(1);
    await screen.unmount();
  });
});
