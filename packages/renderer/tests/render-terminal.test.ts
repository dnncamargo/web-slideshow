import { describe, expect, it } from "vitest";

import type { TerminalElement } from "@powershow/document-schema";

import { renderTerminal } from "../src/render-terminal";

import { createTerminalElement } from "./fixtures/render-fixtures";

describe("renderTerminal", () => {
  it.each([
    ["empty string", ""],
    ["empty runs", { type: "rich-text", runs: [] } as TerminalElement["title"]],
    ["empty marked run", { type: "rich-text", runs: [{ text: "", marks: { bold: true } }] } as TerminalElement["title"]],
  ])("omits a titlebar for %s", (_name, title) => {
    expect(renderTerminal(createTerminalElement({ title }))).not.toContain(
      "powershow-terminal-titlebar",
    );
  });

  it("renders a non-empty RichText title with its marks", () => {
    const html = renderTerminal(createTerminalElement({
      title: { type: "rich-text", runs: [{ text: "Title", marks: { bold: true, italic: true } }] },
    }));

    expect(html).toContain("powershow-terminal-titlebar");
    expect(html).toContain("<em><strong>Title</strong></em>");
  });

  it("renders RichText title and line content with semantic defaults", () => {
    const html = renderTerminal(createTerminalElement({
      title: { type: "rich-text", runs: [{ text: "Terminal", marks: { bold: true, color: "#f00" } }] },
      lines: [{ type: "output", content: { type: "rich-text", runs: [{ text: "ok", marks: { italic: true } }] } }],
    }));

    expect(html).toContain("<strong>");
    expect(html).toContain("Terminal");
    expect(html).toContain("<em>ok</em>");
    expect(html).toContain("powershow-terminal-line-output");
  });
  it("omits the title region when no title is provided", () => {
    const html = renderTerminal(createTerminalElement());

    expect(html).not.toContain("powershow-terminal-title");
    expect(html).toContain('class="powershow-terminal-body"');
    expect(html).not.toContain("--powershow-terminal-");
    expect(html).not.toContain("font-family:");
  });

  it("renders authored body typography without becoming title typography", () => {
    const html = renderTerminal(createTerminalElement({
      title: "Terminal title",
      typography: {
        fontFamily: "Fira Code",
        fontSize: 18,
        lineHeight: 1.25,
        letterSpacing: "0.02em",
      },
    }));

    expect(html).toContain('class="powershow-terminal-title">Terminal title</div>');
    expect(html).toContain('class="powershow-terminal-body" style="font-family:&quot;Fira Code&quot;;font-size:18px;line-height:1.25;--powershow-terminal-line-height:1.25em;letter-spacing:0.02em"');
    expect(html).not.toContain('powershow-terminal-title" style=');
  });

  it("renders authored title typography and visual styling independently", () => {
    const html = renderTerminal(createTerminalElement({
      title: "Terminal title",
      titleStyle: {
        color: "#facc15",
        background: { color: { kind: "palette", colorId: "accent" } },
        border: { width: 1, style: "solid", color: "#ffffff" },
        borderRadius: 8,
        className: "custom-title",
      },
      titleTypography: {
        fontFamily: 'Example "Mono"',
        fontSize: 14,
        fontWeight: 600,
        fontStyle: "italic",
        lineHeight: 1.2,
        letterSpacing: "0.02em",
        textTransform: "uppercase",
      },
      typography: { fontFamily: "Fira Code", fontSize: 18 },
    }));

    expect(html).toContain('class="powershow-terminal-title custom-title"');
    expect(html).toContain('style="color:#facc15;background:var(--ps-palette-');
    expect(html).toContain("border-width:1px;border-style:solid;border-color:#ffffff;border-radius:8px");
    expect(html).toContain('font-family:&quot;Example \\22 Mono\\22 &quot;');
    expect(html).toContain("font-size:14px;font-weight:600;font-style:italic;line-height:1.2;letter-spacing:0.02em;text-transform:uppercase");
    expect(html).toContain('class="powershow-terminal-body" style="font-family:&quot;Fira Code&quot;;font-size:18px"');
  });

  it("does not emit authored title style when title styling is absent", () => {
    const html = renderTerminal(createTerminalElement({ title: "Plain title" }));

    expect(html).toContain('class="powershow-terminal-title">Plain title</div>');
    expect(html).not.toContain('powershow-terminal-title" style=');
  });

  it("publishes authored semantic colors as root custom properties", () => {
    const html = renderTerminal(createTerminalElement({
      style: {
        commandColor: "#ffffff",
        promptColor: { kind: "palette", colorId: "accent" },
        outputColor: "#cbd5e1",
        commentColor: "#64748b",
        errorColor: "#fca5a5",
      },
    }));

    expect(html).toContain("--powershow-terminal-command-color:#ffffff");
    expect(html).toContain("--powershow-terminal-prompt-color:var(--ps-palette-");
    expect(html).toContain("--powershow-terminal-output-color:#cbd5e1");
    expect(html).toContain("--powershow-terminal-comment-color:#64748b");
    expect(html).toContain("--powershow-terminal-error-color:#fca5a5");
    expect(html).not.toContain("powershow-terminal-body\" style=\"--powershow-terminal");
  });

  it("keeps canonical root styles alongside body typography and semantic colors", () => {
    const html = renderTerminal(createTerminalElement({
      layout: { position: "absolute", left: 12 },
      style: {
        background: { color: "#080b0a" },
        commandColor: "#ffffff",
      },
      typography: { lineHeight: 2 },
      effect: { opacity: 0.8 },
    }));

    expect(html).toContain("position:absolute;left:12px;background:#080b0a;opacity:0.8;--powershow-terminal-command-color:#ffffff");
    expect(html).toContain("line-height:2;--powershow-terminal-line-height:2em");
  });

  it("renders an empty terminal body for no lines", () => {
    const html = renderTerminal(
      createTerminalElement({
        title: "Empty terminal",
        lines: [],
      }),
    );

    expect(html).toContain("powershow-terminal-body");
    expect(html).not.toContain("data-terminal-line-type");
  });

  it.each(["command", "output", "error", "comment"] as const)(
    "renders %s lines with semantic type metadata",
    (type) => {
      const line: TerminalElement["lines"][number] = {
        type,
        content: `${type} content`,
      };

      const html = renderTerminal(
        createTerminalElement({
          lines: [line],
        }),
      );

      expect(html).toContain(`powershow-terminal-line-${type}`);
      expect(html).toContain(`data-terminal-line-type="${type}"`);
      expect(html).toContain(`${type} content`);
    },
  );

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
    expect(html).toContain("&lt;Terminal title=&quot;unsafe&quot;&gt;");
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

  it("renders the terminal titlebar and controls", () => {
    const html = renderTerminal({
      type: "terminal",
      id: "terminal-titlebar",
      hidden: false,

      title: "PowerShow",

      lines: [
        {
          type: "command",
          content: "pnpm dev",
        },
      ],
    });

    expect(html).toContain('class="powershow-terminal-titlebar"');

    expect(html).toContain('class="powershow-terminal-controls"');

    expect(html).toContain(
      'class="powershow-terminal-control powershow-terminal-control-close"',
    );

    expect(html).toContain(
      'class="powershow-terminal-control powershow-terminal-control-minimize"',
    );

    expect(html).toContain(
      'class="powershow-terminal-control powershow-terminal-control-expand"',
    );

    expect(html).toContain('aria-hidden="true"');

    expect(html).toContain('class="powershow-terminal-title"');

    expect(html).toContain(">PowerShow</div>");

    expect(html).toContain('class="powershow-terminal-body"');

    expect(html).toContain(
      'class="powershow-terminal-line powershow-terminal-line-command"',
    );

    expect(html).toContain('data-terminal-line-type="command"');

    expect(html).toContain("pnpm dev");
  });

  it("does not render a titlebar without a title", () => {
    const html = renderTerminal({
      type: "terminal",
      id: "terminal-no-title",
      hidden: false,

      lines: [
        {
          type: "output",
          content: "Hello",
        },
      ],
    });

    expect(html).not.toContain("powershow-terminal-titlebar");
  });
});
