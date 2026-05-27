#!/usr/bin/env node
// FILE: release-notes.ts
// Purpose: Validates curated release-note sources and generates app/GitHub release outputs.
// Layer: Release automation script
// Depends on: docs/releases Markdown sources and apps/web What's New data shape.

import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export interface ReleaseNoteItem {
  readonly id: string;
  readonly title: string;
  readonly description: string;
}

export interface ReleaseNote {
  readonly version: string;
  readonly date: string;
  readonly title: string;
  readonly summary: string;
  readonly highlights: readonly ReleaseNoteItem[];
  readonly fixes: readonly ReleaseNoteItem[];
  readonly upgradeNote?: string;
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultReleaseNotesDirectory = resolve(repoRoot, "docs/releases");
const defaultEntriesPath = resolve(repoRoot, "apps/web/src/whatsNew/entries.ts");

function isReleaseNoteFileName(fileName: string): boolean {
  return /^v[0-9]+\.[0-9]+\.[0-9]+(?:[.-][0-9A-Za-z.-]+)?\.md$/.test(fileName);
}

function releaseNotePath(fileName: string): string {
  if (!isReleaseNoteFileName(fileName))
    throw new Error(`Invalid release note file name: ${fileName}`);
  return `${defaultReleaseNotesDirectory}/${fileName}`;
}

async function readValidatedReleaseNoteFile(fileName: string): Promise<string> {
  return Bun.file(releaseNotePath(fileName)).text();
}

export function resolveGithubBodyOutputPath(fileName: string): string {
  if (!/^[A-Za-z0-9._-]+$/.test(fileName)) {
    throw new Error(`${fileName} resolves outside repository release paths`);
  }
  return `${repoRoot}/${fileName}`;
}

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseFrontmatter(rawFrontmatter: string, sourcePath: string): Record<string, string> {
  const fields: Record<string, string> = {};

  for (const line of rawFrontmatter.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const separatorIndex = trimmed.indexOf(":");
    if (separatorIndex <= 0) {
      throw new Error(`${sourcePath}: invalid frontmatter line: ${line}`);
    }

    fields[trimmed.slice(0, separatorIndex).trim()] = stripQuotes(
      trimmed.slice(separatorIndex + 1),
    );
  }

  return fields;
}

function requiredField(fields: Record<string, string>, field: string, sourcePath: string): string {
  const value = fields[field];
  if (!value) throw new Error(`${sourcePath}: missing required frontmatter field '${field}'`);
  return value;
}

function splitSections(markdown: string): Map<string, string> {
  const sections = new Map<string, string>();
  let currentHeading: string | null = null;
  let currentLines: string[] = [];

  function flush(): void {
    if (currentHeading) sections.set(currentHeading, currentLines.join("\n").trim());
  }

  for (const line of markdown.split("\n")) {
    const heading = /^##\s+(.+?)\s*$/.exec(line);
    if (heading) {
      flush();
      currentHeading = heading[1] ?? "";
      currentLines = [];
      continue;
    }

    if (currentHeading) currentLines.push(line);
  }

  flush();
  return sections;
}

function parseItems(
  section: string | undefined,
  sectionName: string,
  sourcePath: string,
): ReleaseNoteItem[] {
  if (!section?.trim()) {
    if (sectionName === "Highlights")
      throw new Error(`${sourcePath}: missing required Highlights section`);
    return [];
  }

  const items: ReleaseNoteItem[] = [];
  for (const line of section.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = /^-\s+\*\*(.+?):\*\*\s+(.+)$/.exec(trimmed);
    if (!match) {
      throw new Error(`${sourcePath}: ${sectionName} bullets must use '- **Title:** Description'`);
    }

    const title = match[1] ?? "";
    const description = match[2] ?? "";
    items.push({ id: slugify(title), title, description });
  }

  return items;
}

function parseUpgradeNote(section: string | undefined): string | undefined {
  const value = section?.trim();
  return value ? value.replace(/\n+/g, " ") : undefined;
}

export function parseReleaseNoteSource(source: string, sourcePath: string): ReleaseNote {
  if (!source.startsWith("---\n")) {
    throw new Error(`${sourcePath}: release note must start with YAML frontmatter`);
  }

  const frontmatterEnd = source.indexOf("\n---", 4);
  if (frontmatterEnd === -1) {
    throw new Error(`${sourcePath}: release note must close YAML frontmatter`);
  }

  const fields = parseFrontmatter(source.slice(4, frontmatterEnd), sourcePath);
  const body = source.slice(frontmatterEnd + "\n---".length).trim();
  const sections = splitSections(body);
  const highlights = parseItems(sections.get("Highlights"), "Highlights", sourcePath);

  if (highlights.length < 3 || highlights.length > 5) {
    throw new Error(`${sourcePath}: Highlights must contain three to five bullets`);
  }

  const upgradeNote = parseUpgradeNote(sections.get("Upgrade note"));
  const note: ReleaseNote = {
    version: requiredField(fields, "version", sourcePath),
    date: requiredField(fields, "date", sourcePath),
    title: requiredField(fields, "title", sourcePath),
    summary: requiredField(fields, "summary", sourcePath),
    highlights,
    fixes: parseItems(sections.get("Fixes"), "Fixes", sourcePath),
  };

  return upgradeNote ? { ...note, upgradeNote } : note;
}

function compareVersionsDescending(a: ReleaseNote, b: ReleaseNote): number {
  const aParts = a.version.split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);
  const bParts = b.version.split(/[.-]/).map((part) => Number.parseInt(part, 10) || 0);
  for (let index = 0; index < Math.max(aParts.length, bParts.length); index += 1) {
    const diff = (bParts[index] ?? 0) - (aParts[index] ?? 0);
    if (diff !== 0) return diff;
  }
  return b.version.localeCompare(a.version);
}

function serializeFeature(item: ReleaseNoteItem, indent = "      "): string {
  const description = JSON.stringify(item.description);
  const descriptionLine = `${indent}  description: ${description},`;
  const descriptionSource =
    descriptionLine.length <= 100
      ? descriptionLine
      : `${indent}  description:\n${indent}    ${description},`;

  return `${indent}{\n${indent}  id: ${JSON.stringify(item.id)},\n${indent}  title: ${JSON.stringify(item.title)},\n${descriptionSource}\n${indent}},`;
}

export function generateWhatsNewEntriesSource(notes: readonly ReleaseNote[]): string {
  const entries = notes.toSorted(compareVersionsDescending).map((note) => {
    const features = [...note.highlights, ...note.fixes];
    if (note.upgradeNote) {
      features.push({ id: "upgrade-note", title: "Upgrade note", description: note.upgradeNote });
    }

    return `  {\n    version: ${JSON.stringify(note.version)},\n    date: ${JSON.stringify(note.date)},\n    features: [\n${features.map((feature) => serializeFeature(feature)).join("\n")}\n    ],\n  },`;
  });

  return `// FILE: whatsNew/entries.ts
// Purpose: Generated release history for the post-update dialog and settings Release history view.
// Layer: static data consumed by useWhatsNew, WhatsNewDialog, and ChangelogAccordion.
//
// Generated by scripts/release-notes.ts from docs/releases/*.md. Do not edit by hand.

import type { WhatsNewEntry } from "./logic";

export const WHATS_NEW_ENTRIES: readonly WhatsNewEntry[] = [
${entries.join("\n")}
];
`;
}

function bulletList(items: readonly ReleaseNoteItem[]): string {
  return items.map((item) => `- **${item.title}:** ${item.description}`).join("\n");
}

export function generateGithubReleaseBody(note: ReleaseNote): string {
  const sections = [
    `# JCode v${note.version}`,
    note.summary,
    "## Highlights",
    bulletList(note.highlights),
  ];

  if (note.fixes.length > 0) {
    sections.push("## Fixes", bulletList(note.fixes));
  }

  if (note.upgradeNote) {
    sections.push("## Upgrade note", note.upgradeNote);
  }

  return `${sections.join("\n\n")}\n`;
}

export async function readReleaseNotes(): Promise<ReleaseNote[]> {
  if (!existsSync(defaultReleaseNotesDirectory)) return [];

  const notes: ReleaseNote[] = [];
  for (const fileName of readdirSync(defaultReleaseNotesDirectory).filter(isReleaseNoteFileName)) {
    const sourcePath = releaseNotePath(fileName);
    notes.push(parseReleaseNoteSource(await readValidatedReleaseNoteFile(fileName), sourcePath));
  }
  return notes;
}

function findReleaseNote(notes: readonly ReleaseNote[], version: string): ReleaseNote {
  const normalizedVersion = version.replace(/^v/, "");
  const note = notes.find((candidate) => candidate.version === normalizedVersion);
  if (!note) throw new Error(`Missing release note source for v${normalizedVersion}`);
  return note;
}

function parseArgs(argv: readonly string[]): Record<string, string | boolean> {
  const parsed: Record<string, string | boolean> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg?.startsWith("--")) throw new Error(`Unexpected argument: ${arg}`);
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

export async function runReleaseNotesCli(argv: readonly string[]): Promise<void> {
  const args = parseArgs(argv);
  const notes = await readReleaseNotes();
  const version = typeof args.version === "string" ? args.version : undefined;
  const generatedEntries = generateWhatsNewEntriesSource(notes);

  if (version) findReleaseNote(notes, version);

  if (args.write) {
    await Bun.write(defaultEntriesPath, generatedEntries);
  }

  if (typeof args["github-body"] === "string") {
    if (!version) throw new Error("--github-body requires --version");
    const outputPath = resolveGithubBodyOutputPath(args["github-body"]);
    mkdirSync(dirname(outputPath), { recursive: true });
    await Bun.write(outputPath, generateGithubReleaseBody(findReleaseNote(notes, version)));
  }

  if (args.check) {
    const currentEntries = existsSync(defaultEntriesPath)
      ? await Bun.file(defaultEntriesPath).text()
      : "";
    if (currentEntries !== generatedEntries) {
      throw new Error(
        "Generated app release-history data is stale. Run `node scripts/release-notes.ts --write`.",
      );
    }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runReleaseNotesCli(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
