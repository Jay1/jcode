import { assert, describe, it } from "@effect/vitest";

import {
  generateGithubReleaseBody,
  generateWhatsNewEntriesSource,
  parseReleaseNoteSource,
  resolveGithubBodyOutputPath,
} from "./release-notes.ts";

const releaseNote = `---
version: 1.2.3
date: May 24
title: Release notes stay tidy
summary: JCode now keeps release notes concise and package downloads latest-only.
---

## Highlights

- **One changelog source:** A compact product-first note drives the app history and GitHub release body.
- **Latest packages only:** GitHub keeps the newest stable package and the newest prerelease package during testing.
- **Short notes by default:** Empty sections are omitted so each release stays easy to scan.

## Fixes

- **Release cleanup is mandatory:** The workflow fails loudly when old GitHub releases cannot be pruned.

## Upgrade note

No manual cleanup is needed after the next release.
`;

describe("release notes", () => {
  it("parses the compact Markdown release-note source", () => {
    const parsed = parseReleaseNoteSource(releaseNote, "docs/releases/v1.2.3.md");

    assert.equal(parsed.version, "1.2.3");
    assert.equal(parsed.date, "May 24");
    assert.equal(parsed.title, "Release notes stay tidy");
    assert.equal(
      parsed.summary,
      "JCode now keeps release notes concise and package downloads latest-only.",
    );
    assert.deepStrictEqual(
      parsed.highlights.map((highlight) => highlight.id),
      ["one-changelog-source", "latest-packages-only", "short-notes-by-default"],
    );
    assert.equal(parsed.fixes[0]?.title, "Release cleanup is mandatory");
    assert.equal(parsed.upgradeNote, "No manual cleanup is needed after the next release.");
  });

  it("generates concise GitHub release notes from the same source", () => {
    const parsed = parseReleaseNoteSource(releaseNote, "docs/releases/v1.2.3.md");
    const body = generateGithubReleaseBody(parsed);

    assert.equal(
      body,
      `# JCode v1.2.3

JCode now keeps release notes concise and package downloads latest-only.

## Highlights

- **One changelog source:** A compact product-first note drives the app history and GitHub release body.
- **Latest packages only:** GitHub keeps the newest stable package and the newest prerelease package during testing.
- **Short notes by default:** Empty sections are omitted so each release stays easy to scan.

## Fixes

- **Release cleanup is mandatory:** The workflow fails loudly when old GitHub releases cannot be pruned.

## Upgrade note

No manual cleanup is needed after the next release.
`,
    );
  });

  it("generates app release-history data newest-first", () => {
    const first = parseReleaseNoteSource(releaseNote, "docs/releases/v1.2.3.md");
    const second = parseReleaseNoteSource(
      releaseNote.replaceAll("1.2.3", "1.2.4").replace("May 24", "May 25"),
      "docs/releases/v1.2.4.md",
    );

    const source = generateWhatsNewEntriesSource([first, second]);

    assert.match(source, /version: "1\.2\.4"[\s\S]*version: "1\.2\.3"/);
    assert.match(source, /id: "one-changelog-source"/);
    assert.match(source, /title: "Release cleanup is mandatory"/);
    assert.match(source, /title: "Upgrade note"/);
  });

  it("rejects missing compact release-note sections", () => {
    assert.throws(
      () =>
        parseReleaseNoteSource(
          releaseNote.replace("## Highlights", "## Notes"),
          "docs/releases/v1.2.3.md",
        ),
      /Highlights/,
    );
  });

  it("rejects GitHub body output paths outside the repository", () => {
    assert.throws(() => resolveGithubBodyOutputPath("../release-body.md"), /outside repository/);
    assert.throws(
      () => resolveGithubBodyOutputPath("nested/release-body.md"),
      /outside repository/,
    );
    assert.match(resolveGithubBodyOutputPath("release-body.md"), /release-body\.md$/);
  });
});
