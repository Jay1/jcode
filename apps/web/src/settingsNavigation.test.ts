import { describe, expect, it } from "vitest";

import { normalizeSettingsSection, SETTINGS_NAV_ITEMS } from "./settingsNavigation";

describe("settings navigation", () => {
  it("exposes the Skill Library as a first-class JCode settings section", () => {
    expect(normalizeSettingsSection("skills")).toBe("skills");

    expect(SETTINGS_NAV_ITEMS.find((item) => item.id === "skills")).toMatchObject({
      group: "jcode",
      label: "Skill Library",
    });
  });
});
