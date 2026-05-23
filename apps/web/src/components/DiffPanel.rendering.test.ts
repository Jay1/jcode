import { describe, expect, it } from "vitest";

import { buildFileDiffRenderKey, resolveFileDiffPath } from "./DiffPanel.rendering";

describe("DiffPanel rendering helpers", () => {
  it("normalizes git-prefixed file paths", () => {
    expect(resolveFileDiffPath({ name: "b/src/app.ts" } as never)).toBe("src/app.ts");
    expect(resolveFileDiffPath({ prevName: "a/src/old.ts" } as never)).toBe("src/old.ts");
    expect(resolveFileDiffPath({ name: "src/app.ts" } as never)).toBe("src/app.ts");
  });

  it("prefers cache keys and falls back to stable previous/current names", () => {
    expect(buildFileDiffRenderKey({ cacheKey: "cached", name: "src/app.ts" } as never)).toBe(
      "cached",
    );
    expect(buildFileDiffRenderKey({ prevName: "src/old.ts", name: "src/new.ts" } as never)).toBe(
      "src/old.ts:src/new.ts",
    );
    expect(buildFileDiffRenderKey({ name: "src/new.ts" } as never)).toBe("none:src/new.ts");
  });
});
