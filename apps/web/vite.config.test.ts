import { describe, expect, it } from "vitest";

import { resolveBuildSourcemapEnv } from "./vite.config";

describe("resolveBuildSourcemapEnv", () => {
  it("prefers the JCode sourcemap env with T3Code fallback", () => {
    expect(
      resolveBuildSourcemapEnv({
        JCODE_WEB_SOURCEMAP: "hidden",
        T3CODE_WEB_SOURCEMAP: "false",
      }),
    ).toBe("hidden");

    expect(resolveBuildSourcemapEnv({ T3CODE_WEB_SOURCEMAP: "false" })).toBe(false);
  });
});
