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
type ImageProbeOutcome = "load" | "error";

const originalImage = window.Image;

function installImageProbeRecorder(
  requests: string[],
  outcome: ImageProbeOutcome | ((src: string) => ImageProbeOutcome) = "load",
) {
  class MockImage {
    private loadListeners: ImageLoadListener[] = [];
    private errorListeners: ImageLoadListener[] = [];

    addEventListener(type: string, listener: ImageLoadListener) {
      if (type === "load") {
        this.loadListeners.push(listener);
      } else if (type === "error") {
        this.errorListeners.push(listener);
      }
    }

    removeEventListener(type: string, listener: ImageLoadListener) {
      if (type === "load") {
        this.loadListeners = this.loadListeners.filter((candidate) => candidate !== listener);
      } else if (type === "error") {
        this.errorListeners = this.errorListeners.filter((candidate) => candidate !== listener);
      }
    }

    set src(value: string) {
      requests.push(value);
      window.setTimeout(() => {
        const resolvedOutcome = typeof outcome === "function" ? outcome(value) : outcome;
        const listeners = resolvedOutcome === "load" ? this.loadListeners : this.errorListeners;
        for (const listener of listeners) {
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
  it("prefers a project favicon over TypeScript icon metadata when the favicon loads", async () => {
    const imageRequests: string[] = [];
    installImageProbeRecorder(imageRequests);

    const screen = await render(
      <ProjectSidebarIcon
        cwd="/workspace/typescript-app"
        expanded={false}
        iconMetadata={{ iconId: "typescript", label: "TypeScript" }}
      />,
    );

    await vi.waitFor(() => {
      expect(screen.container.querySelector("img")?.getAttribute("src")).toContain(
        "/api/project-favicon",
      );
    });
    expect(screen.container.querySelector("[data-project-folder-icon]")).not.toBeNull();
    expect(screen.container.querySelector('[data-project-icon-id="typescript"]')).toBeNull();
    expect(imageRequests).toHaveLength(1);
    await screen.unmount();
  });

  it("falls back to TypeScript icon metadata when the favicon probe fails", async () => {
    const imageRequests: string[] = [];
    installImageProbeRecorder(imageRequests, "error");

    const screen = await render(
      <ProjectSidebarIcon
        cwd="/workspace/typescript-missing-favicon"
        expanded={false}
        iconMetadata={{ iconId: "typescript", label: "TypeScript" }}
      />,
    );

    await expect.element(page.getByLabelText("TypeScript project icon")).toBeInTheDocument();
    await vi.waitFor(() => {
      expect(imageRequests).toHaveLength(1);
    });
    const icon = screen.container.querySelector('[data-project-icon-id="typescript"]');
    expect(icon).not.toBeNull();
    expect(icon?.getAttribute("data-project-favicon-preferred")).toBe("true");
    expect(screen.container.querySelector("img")).toBeNull();
    await screen.unmount();
  });

  it("rechecks preferred favicon state when the project cwd changes", async () => {
    const imageRequests: string[] = [];
    installImageProbeRecorder(imageRequests, (src) =>
      src.includes("favicon-loaded-app") ? "load" : "error",
    );

    const screen = await render(
      <ProjectSidebarIcon
        cwd="/workspace/favicon-missing-app"
        expanded={false}
        iconMetadata={{ iconId: "typescript", label: "TypeScript" }}
      />,
    );

    await expect.element(page.getByLabelText("TypeScript project icon")).toBeInTheDocument();
    await vi.waitFor(() => {
      expect(imageRequests).toHaveLength(1);
    });

    await screen.rerender(
      <ProjectSidebarIcon
        cwd="/workspace/favicon-loaded-app"
        expanded={false}
        iconMetadata={{ iconId: "typescript", label: "TypeScript" }}
      />,
    );

    await vi.waitFor(() => {
      expect(screen.container.querySelector("img")?.getAttribute("src")).toContain(
        "favicon-loaded-app",
      );
    });
    expect(screen.container.querySelector('[data-project-icon-id="typescript"]')).toBeNull();
    expect(imageRequests).toHaveLength(2);
    await screen.unmount();
  });

  it("falls back to icon metadata when a preferred favicon image later errors", async () => {
    const imageRequests: string[] = [];
    installImageProbeRecorder(imageRequests);

    const screen = await render(
      <ProjectSidebarIcon
        cwd="/workspace/favicon-visible-error-app"
        expanded={false}
        iconMetadata={{ iconId: "typescript", label: "TypeScript" }}
      />,
    );

    await vi.waitFor(() => {
      expect(screen.container.querySelector("img")?.getAttribute("src")).toContain(
        "/api/project-favicon",
      );
    });
    screen.container.querySelector("img")?.dispatchEvent(new Event("error", { bubbles: true }));

    await expect.element(page.getByLabelText("TypeScript project icon")).toBeInTheDocument();
    expect(screen.container.querySelector("img")).toBeNull();
    expect(screen.container.querySelector("[data-project-folder-icon]")).toBeNull();
    await screen.unmount();
  });

  it("renders Vue project icon metadata distinctly with brand color when no favicon exists", async () => {
    const imageRequests: string[] = [];
    installImageProbeRecorder(imageRequests, "error");

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
    await vi.waitFor(() => {
      expect(imageRequests).toHaveLength(1);
    });
    await screen.unmount();
  });

  it("keeps the sidebar project header wrapper flat for language icons", async () => {
    const imageRequests: string[] = [];
    installImageProbeRecorder(imageRequests, "error");

    const screen = await render(
      <span className={getProjectHeaderIconClassName()} data-testid="project-icon-wrapper">
        <ProjectSidebarIcon
          className={PROJECT_HEADER_ICON_SIZE_CLASS}
          cwd="/workspace/typescript-wrapper-app"
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
    await vi.waitFor(() => {
      expect(imageRequests).toHaveLength(1);
    });
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
    const folderIconBoxElement = screen.container.querySelector("[data-project-folder-icon]");
    const folderIcon = screen.container.querySelector("svg");
    const folderIconBox = folderIconBoxElement?.getBoundingClientRect();
    const folderGlyphBox = folderIcon?.getBoundingClientRect();
    await expect.element(wrapper).toBeInTheDocument();
    expect(getComputedStyle(wrapper.element()).backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(getComputedStyle(wrapper.element()).borderTopWidth).toBe("0px");
    expect(wrapper.element().className).not.toContain("rounded-md");
    expect(folderIconBoxElement?.classList.contains(PROJECT_HEADER_ICON_SIZE_CLASS)).toBe(true);
    expect(folderIcon).not.toBeNull();
    expect(folderIconBox?.width).toBeGreaterThanOrEqual(17);
    expect(folderIconBox?.height).toBeGreaterThanOrEqual(17);
    expect(
      Math.abs((folderGlyphBox?.width ?? 0) - (folderIconBox?.width ?? 0)),
    ).toBeLessThanOrEqual(0.5);
    expect(
      Math.abs((folderGlyphBox?.height ?? 0) - (folderIconBox?.height ?? 0)),
    ).toBeLessThanOrEqual(0.5);
    await vi.waitFor(() => {
      expect(screen.container.querySelector("img")?.getAttribute("src")).toContain(
        "/api/project-favicon",
      );
    });
    const faviconBadgeBox = screen.container.querySelector("img")?.getBoundingClientRect();
    expect(faviconBadgeBox?.width).toBeLessThanOrEqual(13);
    expect(faviconBadgeBox?.height).toBeLessThanOrEqual(13);
    expect(imageRequests).toHaveLength(1);
    await screen.unmount();
  });

  it("keeps folder icons bounded when rendered in a full project row", async () => {
    const imageRequests: string[] = [];
    installImageProbeRecorder(imageRequests);

    const screen = await render(
      <button type="button" className="flex h-8 w-[260px] items-center gap-2 px-2">
        <span className={getProjectHeaderIconClassName()} data-testid="project-icon-wrapper">
          <ProjectSidebarIcon
            className={PROJECT_HEADER_ICON_SIZE_CLASS}
            cwd="/workspace/plain-folder-row"
            expanded={false}
            iconMetadata={null}
          />
        </span>
        <span>homeassist</span>
        <span className="ml-auto inline-flex gap-2">
          <span className="size-5" />
          <span className="size-5" />
        </span>
      </button>,
    );

    const folderIconBoxElement = screen.container.querySelector("[data-project-folder-icon]");
    const folderIconBox = folderIconBoxElement?.getBoundingClientRect();
    const wrapperBox = screen.getByTestId("project-icon-wrapper").element().getBoundingClientRect();
    expect(folderIconBox?.width).toBeLessThanOrEqual(18.5);
    expect(folderIconBox?.height).toBeLessThanOrEqual(18.5);
    expect(folderIconBox?.width).toBeGreaterThanOrEqual(17.5);
    expect(folderIconBox?.height).toBeGreaterThanOrEqual(17.5);
    expect(wrapperBox.width).toBeGreaterThanOrEqual(19.5);
    expect(wrapperBox.width).toBeLessThanOrEqual(20.5);
    expect(wrapperBox.height).toBeGreaterThanOrEqual(19.5);
    expect(wrapperBox.height).toBeLessThanOrEqual(20.5);
    await screen.unmount();
  });
});
