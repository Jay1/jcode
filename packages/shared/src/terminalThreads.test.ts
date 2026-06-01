import { describe, expect, it } from "vitest";

import { MOUSE_REPORTING_RESET_SEQUENCE } from "./terminalThreads";

describe("MOUSE_REPORTING_RESET_SEQUENCE", () => {
  it("disables basic mouse tracking (mode 1000)", () => {
    expect(MOUSE_REPORTING_RESET_SEQUENCE).toContain("\u001b[?1000l");
  });

  it("disables button-event tracking (mode 1002)", () => {
    expect(MOUSE_REPORTING_RESET_SEQUENCE).toContain("\u001b[?1002l");
  });

  it("disables any-event tracking (mode 1003)", () => {
    expect(MOUSE_REPORTING_RESET_SEQUENCE).toContain("\u001b[?1003l");
  });

  it("disables SGR mouse protocol (mode 1006)", () => {
    expect(MOUSE_REPORTING_RESET_SEQUENCE).toContain("\u001b[?1006l");
  });

  it("disables UTF-8 mouse protocol (mode 1015)", () => {
    expect(MOUSE_REPORTING_RESET_SEQUENCE).toContain("\u001b[?1015l");
  });
});
