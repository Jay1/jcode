import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@pierre/diffs", () => ({
  getSharedHighlighter: () =>
    Promise.resolve({
      codeToHtml(code: string) {
        return `<pre class="shiki"><code>${code}</code></pre>`;
      },
    }),
}));

vi.mock("../hooks/useTheme", () => ({
  useTheme: () => ({ resolvedTheme: "light" }),
}));

async function renderMarkdown(text: string, cwd = "C:\\Users\\LENOVO\\dpcode") {
  const { default: ChatMarkdown } = await import("./ChatMarkdown");

  return renderToStaticMarkup(<ChatMarkdown text={text} cwd={cwd} isStreaming={false} />);
}

describe("ChatMarkdown", () => {
  it("renders inline math with KaTeX", async () => {
    const markup = await renderMarkdown("Euler wrote $e^{i\\\\pi} + 1 = 0$.");

    expect(markup).toContain('class="katex"');
    expect(markup).not.toContain("katex-display");
    expect(markup).not.toContain("$e^{i\\\\pi} + 1 = 0$");
  });

  it("renders display math with KaTeX block output", async () => {
    const markup = await renderMarkdown("$$\n\\\\int_0^1 x^2 \\, dx\n$$");

    expect(markup).toContain("katex-display");
    expect(markup).not.toContain("$$");
  });

  it("keeps links and code intact when math is present", async () => {
    const markup = await renderMarkdown(
      [
        "Read [local notes](./notes.md) and [external docs](https://example.com).",
        "",
        "Inline math $x^2 + y^2$ still renders.",
        "",
        "Inline code `$z$` stays literal.",
        "",
        "```ts",
        'const price = "$5";',
        "```",
      ].join("\n"),
    );

    expect(markup).toContain('href="./notes.md"');
    expect(markup).not.toContain('href="./notes.md" target="_blank"');
    expect(markup).toContain(
      'href="https://example.com" target="_blank" rel="noopener noreferrer"',
    );
    expect(markup).toContain("<code>$z$</code>");
    expect(markup).toContain("const price = &quot;$5&quot;;");
    expect(markup.match(/class="katex"/g) ?? []).toHaveLength(1);
  });

  it("keeps dollar signs in markdown file links from becoming math", async () => {
    const source =
      "Files touched:\n\n- [_chat.$threadId.tsx](/Users/julius/project/apps/web/src/routes/_chat.$threadId.tsx:1192)";
    const markup = await renderMarkdown(source, "/Users/julius/project");

    expect(markup).toContain(
      'href="/Users/julius/project/apps/web/src/routes/_chat.$threadId.tsx:1192"',
    );
    expect(markup).toContain("_chat.$threadId.tsx");
    expect(markup).not.toContain('class="katex"');
    expect(markup).not.toContain("CHATMARKDOWNLITERALDOLLARPLACEHOLDER");
  });

  it("does not turn ordinary dollar text or escaped dollars into math", async () => {
    const markup = await renderMarkdown(
      "It costs $5 to $10 per seat. Escape \\$E=mc^2\\$ when you want literal TeX.",
    );

    expect(markup).toContain("$5 to $10");
    expect(markup).toContain("$E=mc^2$");
    expect(markup).not.toContain('class="katex"');
  });

  it("keeps currency literal without swallowing later inline math", async () => {
    const markup = await renderMarkdown("Price $5. Formula $x$ still renders.");

    expect(markup).toContain("$5. Formula");
    expect(markup).toContain('class="katex"');
    expect(markup).not.toContain("$x$");
  });

  it("keeps all-caps dollar identifiers literal", async () => {
    const markup = await renderMarkdown("Use $USD$ for price and $PATH$ for shell lookup.");

    expect(markup).toContain("$USD$");
    expect(markup).toContain("$PATH$");
    expect(markup).not.toContain('class="katex"');
  });

  it("keeps plan and diff surfaces routed through the shared renderer", () => {
    const planSidebarSource = readFileSync(new URL("./PlanSidebar.tsx", import.meta.url), "utf8");
    const proposedPlanCardSource = readFileSync(
      new URL("./chat/ProposedPlanCard.tsx", import.meta.url),
      "utf8",
    );
    const diffPanelSource = readFileSync(new URL("./DiffPanel.tsx", import.meta.url), "utf8");

    expect(planSidebarSource).toContain('import ChatMarkdown from "./ChatMarkdown"');
    expect(planSidebarSource).toContain("<ChatMarkdown");
    expect(proposedPlanCardSource).toContain('import ChatMarkdown from "../ChatMarkdown"');
    expect(proposedPlanCardSource).toContain("<ChatMarkdown");
    expect(diffPanelSource).toContain('import ChatMarkdown from "./ChatMarkdown"');
    expect(diffPanelSource).toContain("<ChatMarkdown");
  });

  it("marks obvious inline file paths with the file semantic role", async () => {
    const markup = await renderMarkdown("Open `apps/web/src/components/ChatMarkdown.tsx:42` next.");

    expect(markup).toContain(
      '<code class="chat-markdown-code--file">apps/web/src/components/ChatMarkdown.tsx:42</code>',
    );
  });

  it("marks theme and CSS tokens with the token semantic role", async () => {
    const markup = await renderMarkdown(
      "Update `--app-chat-token` and `chat-markdown-code--file`.",
    );

    expect(markup).toContain('<code class="chat-markdown-code--token">--app-chat-token</code>');
    expect(markup).toContain(
      '<code class="chat-markdown-code--token">chat-markdown-code--file</code>',
    );
  });

  it("marks obvious shell commands with the command semantic role", async () => {
    const markup = await renderMarkdown(
      "Run `snip bun run --cwd apps/web test src/theme/theme.logic.test.ts`.",
    );

    expect(markup).toContain("chat-markdown-code--command");
  });

  it("marks status-like inline code with semantic state roles", async () => {
    const markup = await renderMarkdown(
      "Results: `17 passed`, `pending`, `Task not found`, `completed`.",
    );

    expect(markup).toContain('<code class="chat-markdown-code--success">17 passed</code>');
    expect(markup).toContain('<code class="chat-markdown-code--warning">pending</code>');
    expect(markup).toContain('<code class="chat-markdown-code--error">Task not found</code>');
    expect(markup).toContain('<code class="chat-markdown-code--success">completed</code>');
  });

  it("leaves ambiguous inline code neutral", async () => {
    const markup = await renderMarkdown("Keep `button` and `render` neutral.");

    expect(markup).toContain("<code>button</code>");
    expect(markup).toContain("<code>render</code>");
    expect(markup).not.toContain("chat-markdown-code--neutral");
  });
});
