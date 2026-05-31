import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const splashSource = readFileSync(new URL("./SplashScreen.tsx", import.meta.url), "utf8");

describe("SplashScreen structure", () => {
  it("contains the logo without cropping the mark", () => {
    expect(splashSource).toContain("splash-logo-frame");
    expect(splashSource).toContain("splash-logo-image");
    expect(splashSource).toContain("object-contain");
    expect(splashSource).toContain('src="/jcode-hero.png"');
    expect(splashSource).not.toContain("object-cover");
    expect(splashSource).not.toContain("rounded-full");
    expect(splashSource).not.toContain(
      "splash-logo-frame flex size-26 items-center justify-center rounded",
    );
    expect(splashSource).not.toContain("splash-logo-image size-full rounded");
  });
});
