import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  TerminalElement,
} from "@powershow/document-schema";

import {
  renderTerminal,
} from "../src/render-terminal";

import {
  createTerminalElement,
} from "./fixtures/render-fixtures";

describe("renderTerminal", () => {
  it("omits the title region when no title is provided", () => {
    const html = renderTerminal(
      createTerminalElement(),
    );

    expect(html).not.toContain(
      "powershow-terminal-title",
    );
    expect(html).toContain(
      'class="powershow-terminal-body"',
    );
  });

  it("renders an empty terminal body for no lines", () => {
    const html = renderTerminal(
      createTerminalElement({
        title: "Empty terminal",
        lines: [],
      }),
    );

    expect(html).toContain("powershow-terminal-body");
    expect(html).not.toContain(
      "data-terminal-line-type",
    );
  });

  it.each([
    "command",
    "output",
    "error",
    "comment",
  ] as const)("renders %s lines with semantic type metadata", (type) => {
    const line: TerminalElement["lines"][number] = {
      type,
      content: `${type} content`,
    };

    const html = renderTerminal(
      createTerminalElement({
        lines: [line],
      }),
    );

    expect(html).toContain(
      `powershow-terminal-line-${type}`,
    );
    expect(html).toContain(
      `data-terminal-line-type="${type}"`,
    );
    expect(html).toContain(`${type} content`);
  });

  it("escapes HTML in the title and every line", () => {
    const html = renderTerminal(
      createTerminalElement({
        title: '<Terminal title="unsafe">',
        lines: [
          {
            type: "command",
            content: '<script>alert("command")</script>',
          },
          {
            type: "output",
            content: "output & result",
          },
        ],
      }),
    );

    expect(html).not.toContain("<script>");
    expect(html).not.toContain('<Terminal title="unsafe">');
    expect(html).toContain(
      "&lt;Terminal title=&quot;unsafe&quot;&gt;",
    );
    expect(html).toContain(
      "&lt;script&gt;alert(&quot;command&quot;)&lt;/script&gt;",
    );
    expect(html).toContain("output &amp; result");
  });

  it("renders nothing for a hidden terminal", () => {
    const html = renderTerminal(
      createTerminalElement({
        hidden: true,
        title: "Hidden terminal",
        lines: [
          {
            type: "output",
            content: "Hidden output",
          },
        ],
      }),
    );

    expect(html).toBe("");
  });
});
