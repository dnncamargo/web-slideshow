import { describe, expect, it } from "vitest";

import { renderMarkdownToSafeHtml } from "../src/render-markdown";

describe("renderMarkdownToSafeHtml", () => {
  it("renders common Markdown block and inline formatting", () => {
    const html = renderMarkdownToSafeHtml([
      "# Vida",
      "",
      "Um parágrafo com **negrito**, *itálico*, ~~riscado~~ e " + String.fromCharCode(96) + "código" + String.fromCharCode(96) + ".",
      "",
      "- Primeiro item",
      "- Segundo item",
      "",
      "1. Primeiro passo",
      "2. Segundo passo",
      "",
      "> Uma citação.",
      "",
      "| Tema | Estado |",
      "| --- | --- |",
      "| Markdown | Formatado |",
    ].join("\n"));

    expect(html).toContain("<h1>Vida</h1>");
    expect(html).toContain("<strong>negrito</strong>");
    expect(html).toContain("<em>itálico</em>");
    expect(html).toContain("<del>riscado</del>");
    expect(html).toContain("<code>código</code>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<ol>");
    expect(html).toContain("<blockquote>");
    expect(html).toContain("<table>");
  });

  it("escapes raw HTML instead of interpreting it", () => {
    const html = renderMarkdownToSafeHtml([
      "<script>window.pwned = true</script>",
      "",
      '<div onclick="alert(1)">texto</div>',
    ].join("\n"));

    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;div onclick=&quot;alert(1)&quot;&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<div onclick=");
  });

  it("does not emit unsafe link or image URLs", () => {
    const html = renderMarkdownToSafeHtml([
      "[ataque](javascript:alert%281%29)",
      "",
      "![imagem](javascript:alert%281%29)",
      "",
      "[seguro](https://example.com)",
      "",
      "![poster](https://example.com/poster.png)",
    ].join("\n"));

    expect(html).not.toMatch(/href="javascript:/i);
    expect(html).not.toMatch(/src="javascript:/i);
    expect(html).toContain('<a href="https://example.com" rel="noopener noreferrer">seguro</a>');
    expect(html).toContain('<img src="https://example.com/poster.png" alt="poster"');
  });
}
