export type JCodeLinguistLanguageId =
  | "go"
  | "javascript"
  | "python"
  | "react"
  | "rust"
  | "svelte"
  | "typescript"
  | "vue";

export interface RepositoryFileSample {
  readonly path: string;
  readonly sizeBytes?: number;
  readonly text?: string;
}

export interface LinguistAttributeRule {
  readonly pattern: string;
  readonly languageId?: JCodeLinguistLanguageId;
  readonly generated?: boolean;
  readonly vendored?: boolean;
}

export interface LanguageBreakdownEntry {
  readonly languageId: JCodeLinguistLanguageId;
  readonly label: string;
  readonly bytes: number;
  readonly files: number;
  readonly percentage: number;
}

export interface RepositoryLanguageProfile {
  readonly primaryLanguageId: JCodeLinguistLanguageId | null;
  readonly primaryLabel: string | null;
  readonly languages: readonly LanguageBreakdownEntry[];
  readonly analyzedFileCount: number;
  readonly skippedFileCount: number;
  readonly totalBytes: number;
}

export interface ProjectIconMetadataLike {
  readonly iconId: JCodeLinguistLanguageId;
  readonly label: string;
}

interface LanguageDefinition {
  readonly id: JCodeLinguistLanguageId;
  readonly label: string;
  readonly extensions: readonly string[];
  readonly filenames: readonly string[];
}

const LANGUAGE_DEFINITIONS: readonly LanguageDefinition[] = [
  {
    id: "python",
    label: "Python",
    extensions: [".py", ".pyi"],
    filenames: ["Pipfile", "pyproject.toml", "requirements.txt", "setup.cfg", "setup.py"],
  },
  {
    id: "typescript",
    label: "TypeScript",
    extensions: [".ts", ".tsx", ".mts", ".cts"],
    filenames: ["tsconfig.json", "tsconfig.base.json", "tsconfig.app.json", "tsconfig.node.json"],
  },
  {
    id: "javascript",
    label: "JavaScript",
    extensions: [".js", ".jsx", ".mjs", ".cjs"],
    filenames: ["package.json"],
  },
  {
    id: "vue",
    label: "Vue",
    extensions: [".vue"],
    filenames: [],
  },
  {
    id: "react",
    label: "React",
    extensions: [],
    filenames: [],
  },
  {
    id: "svelte",
    label: "Svelte",
    extensions: [".svelte"],
    filenames: [],
  },
  {
    id: "go",
    label: "Go",
    extensions: [".go"],
    filenames: ["go.mod", "go.sum"],
  },
  {
    id: "rust",
    label: "Rust",
    extensions: [".rs"],
    filenames: ["Cargo.lock", "Cargo.toml"],
  },
] as const;

const LANGUAGE_BY_ID = new Map(
  LANGUAGE_DEFINITIONS.map((definition) => [definition.id, definition]),
);
const EXTENSION_TO_LANGUAGE = new Map<string, LanguageDefinition>();
const FILENAME_TO_LANGUAGE = new Map<string, LanguageDefinition>();

for (const definition of LANGUAGE_DEFINITIONS) {
  for (const extension of definition.extensions) {
    EXTENSION_TO_LANGUAGE.set(extension, definition);
  }
  for (const filename of definition.filenames) {
    FILENAME_TO_LANGUAGE.set(filename.toLowerCase(), definition);
  }
}

const SKIPPED_PATH_SEGMENTS = new Set([
  ".git",
  ".hg",
  ".next",
  ".nuxt",
  ".ruff_cache",
  ".svelte-kit",
  ".turbo",
  ".venv",
  ".vite",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "target",
  "vendor",
  "venv",
  "__pycache__",
]);

const DOCUMENTATION_EXTENSIONS = new Set([".adoc", ".md", ".markdown", ".rst", ".txt"]);

const DEFAULT_MAX_FILES = 1_200;
const FALLBACK_FILE_BYTES = 1;
const FRAMEWORK_SCORE_BOOST = 1_000_000_000;
const PRIMARY_CONFIDENCE_RATIO = 0.55;

function normalizeRepositoryPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\/+/, "");
}

function basename(path: string): string {
  const normalized = normalizeRepositoryPath(path);
  const slash = normalized.lastIndexOf("/");
  return slash >= 0 ? normalized.slice(slash + 1) : normalized;
}

function extensionOf(path: string): string {
  const name = basename(path);
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot).toLowerCase() : "";
}

function shouldSkipPath(path: string): boolean {
  const normalized = normalizeRepositoryPath(path);
  const segments = normalized.split("/");
  if (segments.some((segment) => SKIPPED_PATH_SEGMENTS.has(segment))) {
    return true;
  }
  if (segments.length > 0 && segments[0]?.startsWith(".") && segments[0] !== ".github") {
    return true;
  }
  return false;
}

function detectFrameworkFromPackageJson(
  file: RepositoryFileSample,
): JCodeLinguistLanguageId | null {
  if (basename(file.path).toLowerCase() !== "package.json" || !file.text) {
    return null;
  }

  try {
    const packageJson = JSON.parse(file.text) as unknown;
    if (typeof packageJson !== "object" || packageJson === null || Array.isArray(packageJson)) {
      return null;
    }
    const record = packageJson as Record<string, unknown>;
    const dependencyGroups = [record.dependencies, record.devDependencies, record.peerDependencies];
    const dependencyNames = new Set<string>();
    for (const group of dependencyGroups) {
      if (typeof group !== "object" || group === null || Array.isArray(group)) {
        continue;
      }
      for (const dependencyName of Object.keys(group)) {
        dependencyNames.add(dependencyName);
      }
    }
    if (dependencyNames.has("vue")) return "vue";
    if (dependencyNames.has("svelte")) return "svelte";
    if (dependencyNames.has("react")) return "react";
  } catch {
    return null;
  }

  return null;
}

function detectLanguageForFile(file: RepositoryFileSample): JCodeLinguistLanguageId | null {
  const frameworkId = detectFrameworkFromPackageJson(file);
  if (frameworkId) {
    return frameworkId;
  }

  const name = basename(file.path).toLowerCase();
  const filenameMatch = FILENAME_TO_LANGUAGE.get(name);
  if (filenameMatch) {
    return filenameMatch.id;
  }

  const extension = extensionOf(file.path);
  if (DOCUMENTATION_EXTENSIONS.has(extension)) {
    return null;
  }
  return EXTENSION_TO_LANGUAGE.get(extension)?.id ?? null;
}

function labelForLanguage(languageId: JCodeLinguistLanguageId): string {
  return LANGUAGE_BY_ID.get(languageId)?.label ?? languageId;
}

export function analyzeRepositoryLanguages(input: {
  readonly files: readonly RepositoryFileSample[];
  readonly attributesText?: string;
  readonly maxFiles?: number;
}): RepositoryLanguageProfile {
  const maxFiles = input.maxFiles ?? DEFAULT_MAX_FILES;
  const attributeRules = parseLinguistAttributeRules(input.attributesText ?? "");
  const totals = new Map<
    JCodeLinguistLanguageId,
    { bytes: number; files: number; framework: boolean }
  >();
  let analyzedFileCount = 0;
  let skippedFileCount = 0;

  for (const file of input.files.slice(0, maxFiles)) {
    const attributeOverride = resolveLinguistAttributes(file.path, attributeRules);
    if (attributeOverride.generated || attributeOverride.vendored || shouldSkipPath(file.path)) {
      skippedFileCount += 1;
      continue;
    }

    analyzedFileCount += 1;
    const languageId = attributeOverride.languageId ?? detectLanguageForFile(file);
    if (!languageId) {
      continue;
    }

    const existing = totals.get(languageId) ?? { bytes: 0, files: 0, framework: false };
    const fileBytes = Math.max(
      file.sizeBytes ?? file.text?.length ?? FALLBACK_FILE_BYTES,
      FALLBACK_FILE_BYTES,
    );
    existing.bytes += fileBytes;
    existing.files += 1;
    existing.framework = existing.framework || ["react", "svelte", "vue"].includes(languageId);
    totals.set(languageId, existing);
  }

  skippedFileCount += Math.max(input.files.length - maxFiles, 0);

  const totalBytes = Array.from(totals.values()).reduce((sum, entry) => sum + entry.bytes, 0);
  const languages = Array.from(totals.entries())
    .map(([languageId, entry]) => ({
      bytes: entry.bytes,
      files: entry.files,
      label: labelForLanguage(languageId),
      languageId,
      percentage: totalBytes > 0 ? (entry.bytes / totalBytes) * 100 : 0,
      sortScore: entry.bytes + (entry.framework ? FRAMEWORK_SCORE_BOOST : 0),
    }))
    .sort(
      (a, b) => b.sortScore - a.sortScore || b.files - a.files || a.label.localeCompare(b.label),
    )
    .map(({ sortScore: _sortScore, ...entry }) => entry);

  const primary = languages[0] ?? null;
  const primaryDominates =
    primary !== null &&
    (primary.percentage >= PRIMARY_CONFIDENCE_RATIO * 100 ||
      ["react", "svelte", "vue"].includes(primary.languageId));

  return {
    analyzedFileCount,
    languages,
    primaryLanguageId: primaryDominates ? primary.languageId : null,
    primaryLabel: primaryDominates ? primary.label : null,
    skippedFileCount,
    totalBytes,
  };
}

function parseLinguistAttributeRules(attributesText: string): readonly LinguistAttributeRule[] {
  const rules: LinguistAttributeRule[] = [];
  for (const rawLine of attributesText.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    if (!line) {
      continue;
    }
    const [pattern, ...attributes] = line.split(/\s+/);
    if (!pattern) {
      continue;
    }
    const rule: LinguistAttributeRule = { pattern };
    let nextRule = rule;
    for (const attribute of attributes) {
      const [name, rawValue] = attribute.split("=");
      if (name === "linguist-language" && rawValue) {
        const languageId = languageIdFromLabel(rawValue);
        if (languageId) {
          nextRule = { ...nextRule, languageId };
        }
      } else if (name === "linguist-vendored") {
        nextRule = { ...nextRule, vendored: true };
      } else if (name === "-linguist-vendored") {
        nextRule = { ...nextRule, vendored: false };
      } else if (name === "linguist-generated") {
        nextRule = { ...nextRule, generated: true };
      } else if (name === "-linguist-generated") {
        nextRule = { ...nextRule, generated: false };
      }
    }
    rules.push(nextRule);
  }
  return rules;
}

function resolveLinguistAttributes(
  path: string,
  rules: readonly LinguistAttributeRule[],
): {
  readonly generated: boolean;
  readonly languageId: JCodeLinguistLanguageId | null;
  readonly vendored: boolean;
} {
  let generated = false;
  let languageId: JCodeLinguistLanguageId | null = null;
  let vendored = false;
  for (const rule of rules) {
    if (!matchesAttributePattern(rule.pattern, path)) {
      continue;
    }
    if (typeof rule.generated === "boolean") {
      generated = rule.generated;
    }
    if (rule.languageId) {
      languageId = rule.languageId;
    }
    if (typeof rule.vendored === "boolean") {
      vendored = rule.vendored;
    }
  }
  return { generated, languageId, vendored };
}

function languageIdFromLabel(label: string): JCodeLinguistLanguageId | null {
  const normalized = label
    .trim()
    .toLowerCase()
    .replace(/[-_\s]+/g, "");
  for (const definition of LANGUAGE_DEFINITIONS) {
    if (
      definition.id === normalized ||
      definition.label.toLowerCase().replace(/\s+/g, "") === normalized
    ) {
      return definition.id;
    }
  }
  if (normalized === "js") return "javascript";
  if (normalized === "ts") return "typescript";
  if (normalized === "golang") return "go";
  return null;
}

function matchesAttributePattern(pattern: string, path: string): boolean {
  const normalizedPath = normalizeRepositoryPath(path);
  const normalizedPattern = normalizeRepositoryPath(pattern);
  if (normalizedPattern.endsWith("/**")) {
    return normalizedPath.startsWith(normalizedPattern.slice(0, -3));
  }
  if (normalizedPattern.includes("*")) {
    const regex = new RegExp(`^${normalizedPattern.split("*").map(escapeRegExp).join("[^/]*")}$`);
    return regex.test(normalizedPath);
  }
  return normalizedPath === normalizedPattern;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function inferProjectIconMetadata(
  profile: RepositoryLanguageProfile,
): ProjectIconMetadataLike | null {
  if (!profile.primaryLanguageId || !profile.primaryLabel) {
    return null;
  }
  return {
    iconId: profile.primaryLanguageId,
    label: profile.primaryLabel,
  };
}
