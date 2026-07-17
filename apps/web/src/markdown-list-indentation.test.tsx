import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { describe, expect, it } from "vitest";

import { remarkNormalizeListItemIndentation } from "./markdown-list-indentation";

function renderMarkdown(markdown: string): string {
  return renderToStaticMarkup(
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath, remarkNormalizeListItemIndentation]}
      rehypePlugins={[rehypeKatex]}
    >
      {markdown}
    </ReactMarkdown>,
  );
}

describe("Markdown list indentation controls", () => {
  it("preserves a conventionally indented nested list", () => {
    // Given
    const markdown = "- parent\n  - child";

    // When
    const html = renderMarkdown(markdown);

    // Then
    expect(html).toMatch(/<li>parent\s*<ul>/);
    expect(html).toContain("<li>child</li>");
    expect(html).not.toContain("<pre>");
  });

  it("preserves fenced code within a list item", () => {
    // Given
    const markdown = "- ```ts\n  const value = 1;\n  ```";

    // When
    const html = renderMarkdown(markdown);

    // Then
    expect(html).toContain('<pre><code class="language-ts">const value = 1;');
  });

  it("preserves a conventional same-line indented code block", () => {
    // Given
    const markdown = "-     const value = 1;";

    // When
    const html = renderMarkdown(markdown);

    // Then
    expect(html).toContain("<pre><code>const value = 1;");
  });

  it("preserves indented code beginning below a list marker", () => {
    // Given
    const markdown = "-\n      const value = 1;";

    // When
    const html = renderMarkdown(markdown);

    // Then
    expect(html).toContain("<pre><code>const value = 1;");
  });
});

describe("over-indented same-line Markdown list recovery", () => {
  it("recovers an unordered list item as list text", () => {
    // Given
    const markdown = "-       unordered item";

    // When
    const html = renderMarkdown(markdown);

    // Then
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>unordered item</li>");
    expect(html).not.toContain("<p>");
    expect(html).not.toContain("<pre>");
  });

  it("recovers an ordered list item as list text", () => {
    // Given
    const markdown = "1.      ordered item";

    // When
    const html = renderMarkdown(markdown);

    // Then
    expect(html).toContain("<ol>");
    expect(html).toContain("<li>ordered item</li>");
    expect(html).not.toContain("<p>");
    expect(html).not.toContain("<pre>");
  });

  it("reparses GFM inline markup in recovered content", () => {
    // Given
    const markdown =
      "-       **important** [docs](https://example.com) use `inline code`, not ~~plain text~~";

    // When
    const html = renderMarkdown(markdown);

    // Then
    expect(html).toContain("<strong>important</strong>");
    expect(html).toContain('<a href="https://example.com">docs</a>');
    expect(html).toContain("<code>inline code</code>");
    expect(html).toContain("<del>plain text</del>");
    expect(html).not.toContain("<pre>");
  });

  it("reparses inline math in recovered content", () => {
    // Given
    const markdown = "-       formula $x^2 + y^2$";

    // When
    const html = renderMarkdown(markdown);

    // Then
    expect(html).toContain('class="katex"');
    expect(html).not.toContain("$x^2 + y^2$");
    expect(html).not.toContain("<pre>");
  });

  it("preserves recovered blocks separated by a blank line", () => {
    // Given
    const markdown = `-       **first block**

        [second block](https://example.com)`;

    // When
    const html = renderMarkdown(markdown);

    // Then
    expect(html.match(/<p>/g) ?? []).toHaveLength(2);
    expect(html).toContain("<strong>first block</strong>");
    expect(html).toContain('<a href="https://example.com">second block</a>');
    expect(html).not.toContain("<pre>");
  });

  it("recursively recovers a nested list in a tail block", () => {
    // Given
    const markdown = `-       parent item

        -       nested item`;

    // When
    const html = renderMarkdown(markdown);

    // Then
    expect(html.match(/<ul>/g) ?? []).toHaveLength(2);
    expect(html).toContain("<li>nested item</li>");
    expect(html).not.toContain("<pre>");
  });
});
