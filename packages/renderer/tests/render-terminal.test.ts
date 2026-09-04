import { describe, expect, it } from "vitest";

import type { TerminalElement } from "@powershow/document-schema";

import { renderTerminal } from "../src/render-terminal";

import { createTerminalElement } from "./fixtures/render-fixtures";

describe("renderTerminal", () => {
  it("omits the title region when no title is provided", () => {
    const html = renderTerminal(createTerminalElement());

    expect(html).not.toContain("powershow-terminal-title");
    expect(html).toContain('class="powershow-terminal-body"');
    expect(html).not.toContain("--powershow-terminal-");
    expect(html).not.toContain("font-family:");
  });

  it("renders authored body typography without styling the titlebar", () => {
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
