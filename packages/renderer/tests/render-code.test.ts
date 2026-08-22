import {
  describe,
  expect,
  it,
} from "vitest";

import {
  renderCode,
} from "../src/render-code";

import {
  createCodeElement,
} from "./fixtures/render-fixtures";

function countOccurrences(
  value: string,
  search: string,
): number {
  return value.split(search).length - 1;
}

function getLineOpeningTag(
  html: string,
  lineNumber: number,
): string {
  const lineAttribute =
    `data-line="${lineNumber}"`;
  const attributeIndex =
    html.indexOf(lineAttribute);
  const tagStart =
    html.lastIndexOf("<span", attributeIndex);
  const tagEnd =
    html.indexOf(">", attributeIndex);

  return html.slice(tagStart, tagEnd + 1);
}

describe("renderCode", () => {
  it("renders empty code as one empty visual line", () => {
    const html = renderCode(
      createCodeElement({ code: "" }),
    );

    expect(countOccurrences(html, 'data-line="')).toBe(1);
    expect(html).toContain('data-line="1"');
    expect(html).not.toContain('data-line="2"');
    expect(html).toContain(
      'class="powershow-code-line-content"',
    );
  });

  it("preserves multiple code lines and their order", () => {
    const html = renderCode(
      createCodeElement({
        code: "first();\nsecond();\nthird();",
      }),
    );

    expect(countOccurrences(html, 'data-line="')).toBe(3);
    expect(html.indexOf("first();")).toBeLessThan(
      html.indexOf("second();"),
    );
    expect(html.indexOf("second();")).toBeLessThan(
      html.indexOf("third();"),
    );
  });

  it("renders a line number for each line when enabled", () => {
    const html = renderCode(
      createCodeElement({
        code: "one\ntwo",
        showLineNumbers: true,
      }),
    );

    expect(
      countOccurrences(
        html,
        'class="powershow-code-line-number"',
      ),
    ).toBe(2);
    expect(html).toContain(">1</span>");
    expect(html).toContain(">2</span>");
  });

  it("omits all line-number markup when disabled", () => {
    const html = renderCode(
      createCodeElement({
        code: "one\ntwo",
        showLineNumbers: false,
      }),
    );

    expect(html).not.toContain(
      "powershow-code-line-number",
    );
    expect(countOccurrences(html, 'data-line="')).toBe(2);
  });

  it("marks only the requested existing lines as highlighted", () => {
    const html = renderCode(
      createCodeElement({
        code: "one\ntwo\nthree",
        highlightedLines: [2],
      }),
    );

    expect(
      getLineOpeningTag(html, 2),
    ).toContain(
      "powershow-code-line-highlighted",
    );
    expect(
      getLineOpeningTag(html, 1),
    ).not.toContain(
      "powershow-code-line-highlighted",
    );
    expect(
      countOccurrences(
        html,
        "powershow-code-line-highlighted",
      ),
    ).toBe(1);
  });

  it("ignores highlighted lines outside the rendered range", () => {
    const html = renderCode(
      createCodeElement({
        code: "one\ntwo",
        highlightedLines: [99],
      }),
    );

    expect(html).not.toContain(
      "powershow-code-line-highlighted",
    );
    expect(html).not.toContain('data-line="99"');
    expect(countOccurrences(html, 'data-line="')).toBe(2);
  });

  it("escapes HTML in code without changing line structure", () => {
    const html = renderCode(
      createCodeElement({
        code: '<button title="a&b">Run</button>',
      }),
    );

    expect(html).not.toContain("<button");
    expect(html).toContain(
      "&lt;button title=&quot;a&amp;b&quot;&gt;Run&lt;/button&gt;",
    );
    expect(countOccurrences(html, 'data-line="')).toBe(1);
  });

  it("renders supported custom classes and styles", () => {
    const html = renderCode(
      createCodeElement({
        style: {
          className: "code-emphasis",
          width: 320,
          background: "#101218",
        },
      }),
    );

    expect(html).toMatch(
      /class="[^"]*\bcode-emphasis\b[^"]*"/,
    );
    expect(html).toContain("width:320px");
    expect(html).toContain("background:#101218");
  });
});

// ============================================================
// BEGIN: CODE SEMANTIC REGRESSION
//
// Code is textual source code with static display semantics. The
// renderer must never turn code into a runtime: no script elements,
// no event handlers, no eval/Function execution, no generated
// executable code. A language name is display metadata only.
// ============================================================

describe("Code element semantics remain static and non-executable", () => {
  it("renders JavaScript-looking content as escaped inert text", () => {
    const html = renderCode(
      createCodeElement({
        code: '<script>eval("alert(1)")</script>',
      }),
    );

    expect(html).not.toContain("<script");

    expect(html).not.toContain("</script>");

    expect(html).toContain(
      "&lt;script&gt;eval(&quot;alert(1)&quot;)&lt;/script&gt;",
    );
  });

  it("emits pre/code with the language kept as metadata only", () => {
    const html = renderCode(
      createCodeElement({
        code: 'function dangerous() { return eval("1"); }',
        language: "javascript",
      }),
    );

    expect(html).toContain("<pre");

    expect(html).toContain("<code>");

    expect(html).toContain('data-language="javascript"');

    expect(html).not.toMatch(/javascript:/);

    expect(html).not.toContain("src=");
  });

  it("introduces no script, handler, or runtime markup", () => {
    const html = renderCode(
      createCodeElement({
        code: 'onclick="run()"\nconstructor.constructor("x")()',
      }),
    );

    expect(html).not.toContain("<script");

    expect(html).not.toContain("</script>");

    expect(
      html,
    ).not.toMatch(/<[a-zA-Z][^>]*\s+on[a-zA-Z]+\s*=/);

    expect(html).not.toContain("javascript:");
  });

  it("escapes code exactly once, without double escaping", () => {
    const html = renderCode(
      createCodeElement({ code: "a && b < c" }),
    );

    expect(html).toContain("a &amp;&amp; b &lt; c");

    expect(html).not.toContain("&amp;amp;");
  });
});

// ============================================================
// END: CODE SEMANTIC REGRESSION
// ============================================================
