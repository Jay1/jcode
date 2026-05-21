import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  applyManagedTerminalAgentWrapperEnv,
  prepareManagedTerminalAgentWrappers,
} from "./managedTerminalWrappers";

describe("managedTerminalWrappers", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  function makeTempDir(prefix: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    tempDirs.push(dir);
    return dir;
  }

  it("injects JCode managed wrapper env without leaking old T3Code control names", () => {
    const nextEnv = applyManagedTerminalAgentWrapperEnv(
      {
        HOME: "/home/test",
        PATH: "/usr/bin",
        ZDOTDIR: "/home/test/.config/zsh",
      },
      { binDir: "/tmp/jcode-bin", zshDir: "/tmp/jcode-zsh" },
    );

    expect(nextEnv.JCODE_MANAGED_BIN_DIR).toBe("/tmp/jcode-bin");
    expect(nextEnv.JCODE_ORIGINAL_ZDOTDIR).toBe("/home/test/.config/zsh");
    expect(nextEnv.T3CODE_MANAGED_BIN_DIR).toBeUndefined();
    expect(nextEnv.T3CODE_ORIGINAL_ZDOTDIR).toBeUndefined();
    expect(nextEnv.PATH?.split(path.delimiter)[0]).toBe("/tmp/jcode-bin");
    expect(nextEnv.ZDOTDIR).toBe("/tmp/jcode-zsh");
  });

  it("writes wrappers with JCode terminal hook markers", () => {
    if (process.platform === "win32") return;

    const fakeBin = makeTempDir("jcode-wrapper-targets-");
    const targetDir = makeTempDir("jcode-managed-bin-");
    const zshDir = makeTempDir("jcode-managed-zsh-");
    const codexTarget = path.join(fakeBin, "codex");
    fs.writeFileSync(codexTarget, "#!/bin/sh\n", { mode: 0o755 });

    const state = prepareManagedTerminalAgentWrappers({
      baseEnv: { PATH: fakeBin, HOME: "/home/test" },
      targetDir,
      zshDir,
    });

    expect(state.binDir).toBe(targetDir);
    const wrapper = fs.readFileSync(path.join(targetDir, "codex"), "utf8");
    expect(wrapper).toContain("JCODE_TERMINAL_CLI_KIND");
    expect(wrapper).toContain("JCODE_CODEX_START_WATCHER_PID");

    const hook = fs.readFileSync(path.join(targetDir, "notify-hook.sh"), "utf8");
    expect(hook).toContain("633;JCODE_AGENT_EVENT=");
    expect(hook).not.toContain("633;T3CODE_AGENT_EVENT=");

    const zshrc = fs.readFileSync(path.join(zshDir, ".zshrc"), "utf8");
    expect(zshrc).toContain("JCODE_MANAGED_BIN_DIR");
    expect(zshrc).toContain("T3CODE_MANAGED_BIN_DIR");
  });
});
