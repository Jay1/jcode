import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "vitest";

import {
  resolveActiveCodexHomeWritePath,
  resolveBaseCodexHomePath,
  resolveCodexHomeAllowlistCandidates,
  resolveJCodeCodexHomeOverlayPath,
  shouldDisableJCodeBrowserPlugin,
} from "./codexHomePaths.ts";

describe("resolveBaseCodexHomePath", () => {
  it("prefers the explicit home path over CODEX_HOME and the default", () => {
    assert.equal(
      resolveBaseCodexHomePath({ CODEX_HOME: "/env/codex" }, "/explicit/codex"),
      "/explicit/codex",
    );
  });

  it("falls back to CODEX_HOME when no explicit home is supplied", () => {
    assert.equal(resolveBaseCodexHomePath({ CODEX_HOME: "/env/codex" }), "/env/codex");
  });

  it("falls back to ~/.codex when nothing is provided", () => {
    const result = resolveBaseCodexHomePath({});
    assert.ok(result.endsWith(`${path.sep}.codex`));
  });
});

describe("resolveJCodeCodexHomeOverlayPath", () => {
  it("anchors the overlay under JCODE_HOME when set", () => {
    assert.equal(
      resolveJCodeCodexHomeOverlayPath(
        { JCODE_HOME: "/j/runtime", DPCODE_HOME: "/dp/runtime" },
        "/users/me/.codex",
      ),
      path.join("/j/runtime", "codex-home-overlay"),
    );
  });

  it("anchors the overlay under DPCODE_HOME when set", () => {
    assert.equal(
      resolveJCodeCodexHomeOverlayPath({ DPCODE_HOME: "/dp/runtime" }, "/users/me/.codex"),
      path.join("/dp/runtime", "codex-home-overlay"),
    );
  });

  it("honours the legacy T3CODE_HOME variable", () => {
    assert.equal(
      resolveJCodeCodexHomeOverlayPath({ T3CODE_HOME: "/t3/runtime" }, "/users/me/.codex"),
      path.join("/t3/runtime", "codex-home-overlay"),
    );
  });

  it("derives a default overlay sibling of the source home", () => {
    assert.equal(
      resolveJCodeCodexHomeOverlayPath({}, "/users/me/.codex"),
      path.join("/users/me", ".jcode", "runtime", "codex-home-overlay"),
    );
  });
});

describe("shouldDisableJCodeBrowserPlugin", () => {
  it("disables the plugin (overlay active) by default", () => {
    assert.equal(shouldDisableJCodeBrowserPlugin({}), true);
  });

  it("respects the explicit JCode '0' opt-out", () => {
    assert.equal(
      shouldDisableJCodeBrowserPlugin({ JCODE_DISABLE_CODEX_BROWSER_PLUGIN: "0" }),
      false,
    );
  });

  it("respects the legacy DPCode '0' opt-out", () => {
    assert.equal(
      shouldDisableJCodeBrowserPlugin({ DPCODE_DISABLE_CODEX_DPCODE_BROWSER_PLUGIN: "0" }),
      false,
    );
  });
});

describe("resolveActiveCodexHomeWritePath", () => {
  it("returns the overlay home when the plugin is disabled (default)", () => {
    assert.equal(
      resolveActiveCodexHomeWritePath({
        env: { DPCODE_HOME: "/dp/runtime" },
        homePath: "/users/me/.codex",
      }),
      path.join("/dp/runtime", "codex-home-overlay"),
    );
  });

  it("returns the source home when the plugin is explicitly enabled", () => {
    assert.equal(
      resolveActiveCodexHomeWritePath({
        env: {
          DPCODE_HOME: "/dp/runtime",
          DPCODE_DISABLE_CODEX_DPCODE_BROWSER_PLUGIN: "0",
        },
        homePath: "/users/me/.codex",
      }),
      "/users/me/.codex",
    );
  });
});

describe("resolveCodexHomeAllowlistCandidates", () => {
  it("includes both source and overlay homes when distinct", () => {
    const candidates = resolveCodexHomeAllowlistCandidates({
      env: { DPCODE_HOME: "/dp/runtime" },
      homePath: "/users/me/.codex",
    });
    assert.deepEqual(candidates, [
      "/users/me/.codex",
      path.join("/dp/runtime", "codex-home-overlay"),
    ]);
  });

  it("returns just the source when overlay equals source", () => {
    const candidates = resolveCodexHomeAllowlistCandidates({
      env: { DPCODE_HOME: "/users/me" },
      homePath: path.join("/users/me", "codex-home-overlay"),
    });
    assert.deepEqual(candidates, [path.join("/users/me", "codex-home-overlay")]);
  });
});
