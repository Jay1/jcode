import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ProjectSidebarIcon } from "./ProjectSidebarIcon";

describe("ProjectSidebarIcon", () => {
  it("renders accessible branded TypeScript project icons", () => {
    const markup = renderToStaticMarkup(
      <ProjectSidebarIcon
        cwd="/work/typescript-app"
        expanded={false}
        iconMetadata={{ iconId: "typescript", label: "TypeScript" }}
      />,
    );

    expect(markup).toContain('role="img"');
    expect(markup).toContain('aria-label="TypeScript project icon"');
    expect(markup).toContain('data-project-icon-id="typescript"');
    expect(markup).toContain("<svg");
    expect(markup).toContain("#3178C6");
    expect(markup).not.toContain("project-favicon");
  });

  it("renders accessible branded Vue project icons", () => {
    const markup = renderToStaticMarkup(
      <ProjectSidebarIcon
        cwd="/work/vue-app"
        expanded={false}
        iconMetadata={{ iconId: "vue", label: "Vue" }}
      />,
    );

    expect(markup).toContain('role="img"');
    expect(markup).toContain('aria-label="Vue project icon"');
    expect(markup).toContain('data-project-icon-id="vue"');
    expect(markup).toContain("<svg");
    expect(markup).toContain("#42B883");
  });

  it("keeps the decorative folder fallback when metadata is absent", () => {
    const markup = renderToStaticMarkup(
      <ProjectSidebarIcon cwd="/work/plain-folder" expanded={false} />,
    );

    expect(markup).toContain("<svg");
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).not.toContain('role="img"');
    expect(markup).not.toContain("TypeScript");
    expect(markup).not.toContain("Vue");
  });
});
