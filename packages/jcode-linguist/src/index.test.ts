import { describe, expect, it } from "vitest";

import { analyzeRepositoryLanguages, inferProjectIconMetadata } from ".";

describe("analyzeRepositoryLanguages", () => {
  it("recognizes RedOps-style Python repositories from bounded tracked file samples", () => {
    const profile = analyzeRepositoryLanguages({
      files: [
        { path: "README.md", sizeBytes: 5_200 },
        { path: "SECURITY_MODEL.md", sizeBytes: 4_100 },
        { path: "scripts/generate_executive_summary.py", sizeBytes: 7_200 },
        { path: "scripts/redops_state_query.py", sizeBytes: 6_400 },
        { path: "scripts/sync_redops_state.py", sizeBytes: 6_800 },
        { path: "tests/test_sync_redops_state.py", sizeBytes: 5_900 },
        { path: "private/operating-model.md", sizeBytes: 9_000 },
      ],
    });

    expect(profile.primaryLanguageId).toBe("python");
    expect(profile.languages[0]).toMatchObject({
      languageId: "python",
      label: "Python",
      files: 4,
    });
    expect(inferProjectIconMetadata(profile)).toEqual({ iconId: "python", label: "Python" });
  });

  it("keeps explicit framework identity above generic language scoring", () => {
    const profile = analyzeRepositoryLanguages({
      files: [
        {
          path: "package.json",
          sizeBytes: 800,
          text: JSON.stringify({ dependencies: { vue: "^3" } }),
        },
        { path: "src/main.ts", sizeBytes: 2_000 },
        { path: "src/App.vue", sizeBytes: 1_500 },
        { path: "src/router.ts", sizeBytes: 1_000 },
      ],
    });

    expect(profile.primaryLanguageId).toBe("vue");
    expect(inferProjectIconMetadata(profile)).toEqual({ iconId: "vue", label: "Vue" });
  });

  it.each([
    {
      expected: { iconId: "go", label: "Go" },
      files: [
        { path: "go.mod", sizeBytes: 200 },
        { path: "cmd/server/main.go", sizeBytes: 6_500 },
        { path: "internal/server/routes.go", sizeBytes: 4_800 },
      ],
    },
    {
      expected: { iconId: "rust", label: "Rust" },
      files: [
        { path: "Cargo.toml", sizeBytes: 400 },
        { path: "src/main.rs", sizeBytes: 7_200 },
        { path: "src/lib.rs", sizeBytes: 5_100 },
      ],
    },
    {
      expected: { iconId: "javascript", label: "JavaScript" },
      files: [
        {
          path: "package.json",
          sizeBytes: 600,
          text: JSON.stringify({ scripts: { start: "node index.js" } }),
        },
        { path: "index.js", sizeBytes: 3_200 },
        { path: "lib/routes.js", sizeBytes: 4_100 },
      ],
    },
    {
      expected: { iconId: "react", label: "React" },
      files: [
        {
          path: "package.json",
          sizeBytes: 700,
          text: JSON.stringify({ dependencies: { react: "^19" } }),
        },
        { path: "src/App.tsx", sizeBytes: 4_200 },
        { path: "src/main.tsx", sizeBytes: 2_100 },
      ],
    },
    {
      expected: { iconId: "svelte", label: "Svelte" },
      files: [
        {
          path: "package.json",
          sizeBytes: 700,
          text: JSON.stringify({ devDependencies: { svelte: "^5" } }),
        },
        { path: "src/App.svelte", sizeBytes: 3_800 },
        { path: "src/routes/+page.svelte", sizeBytes: 2_400 },
      ],
    },
  ])(
    "detects $expected.label repositories from supported language markers",
    ({ expected, files }) => {
      const profile = analyzeRepositoryLanguages({ files });

      expect(inferProjectIconMetadata(profile)).toEqual(expected);
    },
  );

  it("ignores vendored and generated-looking paths before choosing a primary language", () => {
    const profile = analyzeRepositoryLanguages({
      files: [
        { path: "vendor/big-library/main.go", sizeBytes: 200_000 },
        { path: "dist/generated/client.js", sizeBytes: 180_000 },
        { path: "scripts/redops_state_query.py", sizeBytes: 4_800 },
        { path: "tests/test_redops_state.py", sizeBytes: 5_200 },
      ],
    });

    expect(profile.skippedFileCount).toBe(2);
    expect(inferProjectIconMetadata(profile)).toEqual({ iconId: "python", label: "Python" });
  });

  it("returns no icon metadata for ambiguous mixed-language repositories", () => {
    const profile = analyzeRepositoryLanguages({
      files: [
        { path: "src/service.py", sizeBytes: 5_000 },
        { path: "src/index.ts", sizeBytes: 5_000 },
      ],
    });

    expect(profile.primaryLanguageId).toBeNull();
    expect(inferProjectIconMetadata(profile)).toBeNull();
  });

  it("honors basic .gitattributes linguist-language overrides", () => {
    const profile = analyzeRepositoryLanguages({
      attributesText: "tools/*.txt linguist-language=Python\n",
      files: [
        { path: ".gitattributes", sizeBytes: 40, text: "tools/*.txt linguist-language=Python\n" },
        { path: "tools/extract_state.txt", sizeBytes: 8_000 },
        { path: "README.md", sizeBytes: 2_000 },
      ],
    });

    expect(inferProjectIconMetadata(profile)).toEqual({ iconId: "python", label: "Python" });
  });

  it("honors basic .gitattributes vendored and generated exclusions", () => {
    const profile = analyzeRepositoryLanguages({
      attributesText: ["third_party/** linguist-vendored", "generated/** linguist-generated"].join(
        "\n",
      ),
      files: [
        { path: "third_party/client.py", sizeBytes: 100_000 },
        { path: "third_party_lib/redops_profile.py", sizeBytes: 9_000 },
        { path: "generated/bindings.go", sizeBytes: 100_000 },
        { path: "src/main.ts", sizeBytes: 8_000 },
        { path: "src/app.ts", sizeBytes: 6_000 },
      ],
    });

    expect(profile.skippedFileCount).toBe(2);
    expect(profile.languages.map((entry) => entry.languageId)).toContain("python");
  });
});
