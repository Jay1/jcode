import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const splashSource = readFileSync(new URL("./SplashScreen.tsx", import.meta.url), "utf8");

describe("SplashScreen structure", () => {
  it("contains the logo inside a padded frame without cropping the mark", () => {
    expect(splashSource).toContain("splash-logo-frame");
    expect(splashSource).toContain("splash-logo-image");
    expect(splashSource).toContain("object-contain");
    expect(splashSource).not.toContain("object-cover");
    expect(splashSource).not.toContain("rounded-full");
  });
});
