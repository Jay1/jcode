import { describe, expect, it } from "vitest";

import { resolveMarkdownFileLinkTarget, rewriteMarkdownFileUriHref } from "./markdown-links";

describe("rewriteMarkdownFileUriHref", () => {
  it("rewrites file uri hrefs into direct path hrefs", () => {
    expect(rewriteMarkdownFileUriHref("file:///Users/julius/project/src/main.ts#L42")).toBe(
      "/Users/julius/project/src/main.ts#L42",
    );
  });

  it("preserves encoded octets so file paths are decoded only once later", () => {
    expect(rewriteMarkdownFileUriHref("file:///Users/julius/project/file%2520name.md")).toBe(
      "/Users/julius/project/file%2520name.md",
    );
  });
});

describe("resolveMarkdownFileLinkTarget", () => {
  it("resolves absolute posix file paths", () => {
    expect(resolveMarkdownFileLinkTarget("/Users/julius/project/AGENTS.md")).toBe(
      "/Users/julius/project/AGENTS.md",
    );
  });

  it("resolves relative file paths against cwd", () => {
    expect(resolveMarkdownFileLinkTarget("src/processRunner.ts:71", "/Users/julius/project")).toBe(
      "/Users/julius/project/src/processRunner.ts:71",
    );
  });

  it("does not treat filename line references as external schemes", () => {
    expect(resolveMarkdownFileLinkTarget("script.ts:10", "/Users/julius/project")).toBe(
      "/Users/julius/project/script.ts:10",
    );
  });

  it("resolves bare file names against cwd", () => {
    expect(resolveMarkdownFileLinkTarget("AGENTS.md", "/Users/julius/project")).toBe(
      "/Users/julius/project/AGENTS.md",
    );
  });

  it("maps #L line anchors to editor line suffixes", () => {
    expect(resolveMarkdownFileLinkTarget("/Users/julius/project/src/main.ts#L42C7")).toBe(
      "/Users/julius/project/src/main.ts:42:7",
    );
  });

  it("ignores external urls", () => {
    expect(resolveMarkdownFileLinkTarget("https://example.com/docs")).toBeNull();
  });

  it("does not double-decode file URLs", () => {
    expect(resolveMarkdownFileLinkTarget("file:///Users/julius/project/file%2520name.md")).toBe(
      "/Users/julius/project/file%20name.md",
    );
  });

  it("does not treat app routes as file links", () => {
    expect(resolveMarkdownFileLinkTarget("/chat/settings")).toBeNull();
  });

  it("resolves file paths containing spaces", () => {
    expect(resolveMarkdownFileLinkTarget("my file.ts", "/Users/julius/project")).toBe(
      "/Users/julius/project/my file.ts",
    );
  });

  it("resolves file paths containing parentheses", () => {
    expect(resolveMarkdownFileLinkTarget("file (copy).ts", "/Users/julius/project")).toBe(
      "/Users/julius/project/file (copy).ts",
    );
  });

  it("resolves relative paths with spaces in directory names", () => {
    expect(resolveMarkdownFileLinkTarget("src/my folder/process.ts", "/Users/julius/project")).toBe(
      "/Users/julius/project/src/my folder/process.ts",
    );
  });

  it("resolves URL-encoded file paths with decoded spaces", () => {
    expect(resolveMarkdownFileLinkTarget("my%20file.ts", "/Users/julius/project")).toBe(
      "/Users/julius/project/my file.ts",
    );
  });
});
