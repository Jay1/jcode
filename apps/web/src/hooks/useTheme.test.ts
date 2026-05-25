import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_THEME_STATE } from "../theme/theme.logic";

function installThemeDom() {
  const classList = {
    add: vi.fn(),
    remove: vi.fn(),
    toggle: vi.fn(),
  };
  const style = {
    removeProperty: vi.fn(),
    setProperty: vi.fn(),
  };
  const root = {
    classList,
    offsetHeight: 0,
    setAttribute: vi.fn(),
    style,
  };

  vi.stubGlobal("document", { documentElement: root });
  vi.stubGlobal("localStorage", {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
  });
  vi.stubGlobal("window", {
    matchMedia: vi.fn(() => ({ matches: false })),
  });

  return { classList, root, style };
}

afterEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
});

describe("applyThemeState", () => {
  it("does not rewrite DOM attributes or variables for identical theme inputs", async () => {
    const dom = installThemeDom();
    const { applyThemeState } = await import("./useTheme");

    const initialAttributeWrites = dom.root.setAttribute.mock.calls.length;
    const initialClassToggles = dom.classList.toggle.mock.calls.length;
    const initialVariableWrites = dom.style.setProperty.mock.calls.length;
    const initialVariableRemovals = dom.style.removeProperty.mock.calls.length;

    applyThemeState(DEFAULT_THEME_STATE);

    expect(dom.root.setAttribute).toHaveBeenCalledTimes(initialAttributeWrites);
    expect(dom.classList.toggle).toHaveBeenCalledTimes(initialClassToggles);
    expect(dom.style.setProperty).toHaveBeenCalledTimes(initialVariableWrites);
    expect(dom.style.removeProperty).toHaveBeenCalledTimes(initialVariableRemovals);
  });
});
