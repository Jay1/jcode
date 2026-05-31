import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sidebarSource = readFileSync(new URL("./Sidebar.tsx", import.meta.url), "utf8");

describe("Sidebar structure", () => {
  it("routes major section labels through the section identity header", () => {
    expect(sidebarSource).toContain("function SidebarSectionHeader");

    for (const label of ["Pinned", "Threads", "Workspace", "Chats"]) {
      expect(sidebarSource).toContain(`label=\"${label}\"`);
    }

    expect(sidebarSource).toContain("sidebar-section-header");
    expect(sidebarSource).toContain("sidebar-section-header-icon");
  });

  it("renders the navbar wordmark with a blood-red glider mark", () => {
    expect(sidebarSource).toContain("function AppWordmarkMark");
    expect(sidebarSource).toContain('viewBox="110 110 280 280"');
    expect(sidebarSource).toContain("text-(--app-wordmark-prefix)");
    expect(sidebarSource).toContain("text-[18px] font-normal text-foreground/89");
    expect(sidebarSource).toContain("<AppWordmarkMark />");
    expect(sidebarSource).toContain("aria-label={APP_BASE_NAME}");
    expect(sidebarSource).not.toContain("$$$");
  });

  it("distinguishes the top Threads header from project headers", () => {
    expect(sidebarSource).toContain("sidebar-section-header-elevated");
    expect(sidebarSource).toContain('className="sidebar-section-header-elevated"');
  });

  it("renders project headers with accent icon chips and semibold labels", () => {
    expect(sidebarSource).toContain("sidebar-project-header-icon");
    expect(sidebarSource).toContain("sidebar-project-header-label");
  });
});
