interface MarkdownPoint {
  readonly line?: number;
  readonly offset?: number;
}

interface MarkdownPosition {
  readonly start?: MarkdownPoint;
}

interface MarkdownAstNode {
  readonly type: string;
  readonly value?: unknown;
  readonly position?: MarkdownPosition;
  children?: MarkdownAstNode[];
}

interface MarkdownCodeNode extends MarkdownAstNode {
  readonly type: "code";
  readonly value: string;
}

interface MarkdownListNode extends MarkdownAstNode {
  readonly type: "list";
  spread?: boolean;
}

interface MarkdownListItemNode extends MarkdownAstNode {
  readonly type: "listItem";
  spread?: boolean;
}

interface MarkdownFile {
  readonly value?: unknown;
}

interface MarkdownParser {
  parse(markdown: string): unknown;
}

interface RecoveredMarkdown {
  readonly blocks: MarkdownAstNode[];
  readonly source: string;
}

const INLINE_PARSE_PREFIX = "jcode-markdown-inline-prefix:";

function isMarkdownAstNode(value: unknown): value is MarkdownAstNode {
  return (
    typeof value === "object" && value !== null && "type" in value && typeof value.type === "string"
  );
}

function isMarkdownListNode(node: MarkdownAstNode | undefined): node is MarkdownListNode {
  return node?.type === "list";
}

function isMarkdownListItemNode(node: MarkdownAstNode): node is MarkdownListItemNode {
  return node.type === "listItem";
}

function isSameLineOverIndentedCode(
  node: MarkdownAstNode,
  parent: MarkdownAstNode | undefined,
  markdown: string,
): node is MarkdownCodeNode {
  if (
    node.type !== "code" ||
    parent?.type !== "listItem" ||
    typeof node.value !== "string" ||
    !/^[\t ]/.test(node.value)
  ) {
    return false;
  }

  const nodeStart = node.position?.start;
  const parentStart = parent.position?.start;
  if (
    nodeStart?.line === undefined ||
    nodeStart.offset === undefined ||
    parentStart?.line === undefined ||
    nodeStart.line !== parentStart.line
  ) {
    return false;
  }

  const sourceCharacter = markdown[nodeStart.offset];
  return sourceCharacter !== "`" && sourceCharacter !== "~";
}

function fallbackRecoveredMarkdown(value: string, source: string): RecoveredMarkdown {
  return {
    blocks: [{ type: "paragraph", children: [{ type: "text", value }] }],
    source,
  };
}

function parseRecoveredMarkdown(value: string, parser: MarkdownParser): RecoveredMarkdown {
  // A text prefix keeps the first block inline while the active processor
  // reparses GFM, math, blank-line tail blocks, and nested list syntax.
  const source = `${INLINE_PARSE_PREFIX}${value}`;
  const document = parser.parse(source);
  if (!isMarkdownAstNode(document)) {
    return fallbackRecoveredMarkdown(value, source);
  }

  const blocks = document.children;
  const paragraph = blocks?.[0];
  if (!blocks || !paragraph || paragraph.type !== "paragraph" || !paragraph.children) {
    return fallbackRecoveredMarkdown(value, source);
  }

  const children = paragraph.children;
  const first = children?.[0];
  if (
    first?.type !== "text" ||
    typeof first.value !== "string" ||
    !first.value.startsWith(INLINE_PARSE_PREFIX)
  ) {
    return fallbackRecoveredMarkdown(value, source);
  }

  const firstValue = first.value.slice(INLINE_PARSE_PREFIX.length);
  const restoredFirstChildren: MarkdownAstNode[] = firstValue
    ? [{ ...first, value: firstValue }, ...children.slice(1)]
    : children.slice(1);
  return {
    blocks: [{ ...paragraph, children: restoredFirstChildren }, ...blocks.slice(1)],
    source,
  };
}

function blocksFromIndentedCode(node: MarkdownCodeNode, parser: MarkdownParser): RecoveredMarkdown {
  const recovered = parseRecoveredMarkdown(node.value.trim(), parser);
  const first = recovered.blocks[0];
  return {
    ...recovered,
    blocks:
      first && node.position
        ? [{ ...first, position: node.position }, ...recovered.blocks.slice(1)]
        : recovered.blocks,
  };
}

/**
 * CommonMark interprets four or more spaces after a list marker as code.
 * Chat output sometimes contains additional alignment whitespace on that same
 * line. Recover only those excess-indented nodes; intentional code remains.
 */
function attachListItemIndentationNormalizer(this: MarkdownParser) {
  return (tree: MarkdownAstNode, file: MarkdownFile): void => {
    if (typeof file.value !== "string") {
      return;
    }

    const visit = (
      node: MarkdownAstNode,
      source: string,
      parent: MarkdownAstNode | undefined,
    ): void => {
      if (!node.children) {
        return;
      }

      node.children = node.children.flatMap((child) => {
        if (isSameLineOverIndentedCode(child, node, source)) {
          const recovered = blocksFromIndentedCode(child, this);
          if (recovered.blocks.length > 1 && isMarkdownListItemNode(node)) {
            node.spread = true;
            if (isMarkdownListNode(parent)) {
              parent.spread = true;
            }
          }
          for (const block of recovered.blocks) {
            visit(block, recovered.source, node);
          }
          return recovered.blocks;
        }

        visit(child, source, node);
        return [child];
      });
    };

    visit(tree, file.value, undefined);
  };
}

export const remarkNormalizeListItemIndentation = attachListItemIndentationNormalizer;
