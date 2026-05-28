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

  it("renders the navbar wordmark larger with a blood-red J", () => {
    expect(sidebarSource).toContain("text-[18px] font-semibold text-[#8a0303]");
    expect(sidebarSource).toContain("text-[18px] font-normal text-foreground/89");
  });
});
