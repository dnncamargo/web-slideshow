import { describe, expect, it } from "vitest";

import type {
  ScriptedElement,
} from "@powershow/document-schema";

import { renderElement } from "../src/render-element";
import { renderScripted } from "../src/render-scripted";

function scripted(
  overrides: Partial<ScriptedElement> = {},
): ScriptedElement {
  return {
    id: "scripted-1",

    type: "scripted",

    title: "Signal generator",

    html: "<button>Run</button>",

    css: "button { color: teal; }",

    script: "console.log('ready');",

    hidden: false,

    ...overrides,
  };
}

function decodeHtmlEntities(value: string): string {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

// Extracts the srcdoc attribute value from the emitted outer markup and
// decodes it, reproducing the exact document the browser parses inside
// the sandboxed iframe.
function extractSrcdoc(html: string): string {
  const match = html.match(/srcdoc="([^"]*)"/);

  expect(match).not.toBeNull();

  return decodeHtmlEntities(match![1]!);
}

// Extracts an authored payload attribute from the inner (decoded) srcdoc
// and applies the same recovery path the fixed bootstrap uses:
// attribute value -> entity decode -> JSON.parse.
function recoverPayload(
  srcdoc: string,
  name: string,
): string {
  const regex = new RegExp(`data-${name}="([^"]*)"`);

  const match = srcdoc.match(regex);

  expect(match).not.toBeNull();

  return JSON.parse(decodeHtmlEntities(match![1]!)) as string;
}

// Extracts the CSP meta content attribute from the inner (decoded) srcdoc
// and decodes it a second time, reproducing the value the browser parses.
function extractCsp(srcdoc: string): string {
  const match = srcdoc.match(
    /http-equiv="Content-Security-Policy" content="([^"]*)"/,
  );

  expect(match).not.toBeNull();

  return decodeHtmlEntities(match![1]!);
}

describe("renderScripted", () => {
  it("renders an empty string when hidden", () => {
    expect(renderScripted(scripted({ hidden: true }))).toBe("");

    expect(renderElement(scripted({ hidden: true }))).toBe("");
  });

  it("renders a real iframe when visible", () => {
    const html = renderScripted(scripted());

    expect(html).toContain("<iframe");

    expect(html).toContain("></iframe>");
  });

  it("emits the powershow-element and powershow-scripted classes", () => {
    const html = renderScripted(scripted());

    expect(html).toContain("powershow-element");

    expect(html).toContain("powershow-scripted");
  });

  it("emits data-powershow-id", () => {
    expect(renderScripted(scripted())).toContain(
      'data-powershow-id="scripted-1"',
    );
  });

  it("emits data-powershow-type=\"scripted\"", () => {
    expect(renderScripted(scripted())).toContain(
      'data-powershow-type="scripted"',
    );
  });

  it("escapes the title attribute", () => {
    const html = renderScripted(
      scripted({ title: '<unsafe & "quoted">' }),
    );

    expect(html).toContain(
      'title="&lt;unsafe &amp; &quot;quoted&quot;&gt;"',
    );

    // The same escaped title reaches the inner srcdoc <title> element.
    const srcdoc = extractSrcdoc(html);

    expect(srcdoc).toContain(
      "<title>&lt;unsafe &amp; &quot;quoted&quot;&gt;</title>",
    );
  });

  it("preserves authored style.className on the iframe", () => {
    const html = renderScripted(
      scripted({
        style: {
          className: "custom-scripted-stage",
        },
      }),
    );

    expect(html).toContain("custom-scripted-stage");
  });

  it("applies normal ElementStyle to the iframe", () => {
    const html = renderScripted(
      scripted({
        style: {
          opacity: 0.5,
          width: 200,
        },
      }),
    );

    expect(html).toContain("opacity:0.5");

    expect(html).toContain("width:200px");
  });

  it("collapses the iframe border to 0 when no border is authored", () => {
    const html = renderScripted(scripted());

    expect(html).toContain("border:0");
  });

  it("does not override an authored border", () => {
    const html = renderScripted(
      scripted({
        style: {
          border: {
            width: 2,
            style: "solid",
            color: "#f87171",
          },
        },
      }),
    );

    expect(html).toContain("border-width:2px");

    expect(html).toContain("border-style:solid");

    expect(html).toContain("border-color:#f87171");

    expect(html).not.toContain("border:0");
  });

  it("emits exactly sandbox=\"allow-scripts\"", () => {
    const html = renderScripted(scripted());

    expect(html).toContain('sandbox="allow-scripts"');
  });

  it("does not grant allow-same-origin", () => {
    expect(renderScripted(scripted())).not.toContain("allow-same-origin");
  });

  it("does not grant allow-forms", () => {
    expect(renderScripted(scripted())).not.toContain("allow-forms");
  });

  it("does not grant allow-popups", () => {
    expect(renderScripted(scripted())).not.toContain("allow-popups");
  });

  it("does not grant allow-top-navigation", () => {
    expect(renderScripted(scripted())).not.toContain("allow-top-navigation");
  });

  it("does not grant allow-downloads", () => {
    expect(renderScripted(scripted())).not.toContain("allow-downloads");
  });

  it("does not grant storage-access sandbox permission", () => {
    const html = renderScripted(scripted());

    expect(html).not.toContain("allow-storage-access");

    expect(html).not.toContain("storage-access");
  });

  it("emits no allow attribute and no allowfullscreen", () => {
    const html = renderScripted(scripted());

    expect(html).not.toContain(" allow=");

    expect(html).not.toContain("allowfullscreen");
  });

  it("emits referrerpolicy=\"no-referrer\"", () => {
    expect(renderScripted(scripted())).toContain(
      'referrerpolicy="no-referrer"',
    );
  });

  it("renders through renderElement", () => {
    const html = renderElement(scripted());

    expect(html).toContain("<iframe");

    expect(html).toContain('data-powershow-type="scripted"');
  });
});

describe("renderScripted srcdoc CSP", () => {
  it("carries the fixed CSP meta into the srcdoc", () => {
    const srcdoc = extractSrcdoc(renderScripted(scripted()));

    expect(srcdoc).toContain(
      '<meta http-equiv="Content-Security-Policy" content="',
    );

    expect(srcdoc).toContain("Content-Security-Policy");
  });

  it("sets default-src to 'none'", () => {
    const csp = extractCsp(extractSrcdoc(renderScripted(scripted())));

    expect(csp).toContain("default-src 'none'");
  });

  it("sets connect-src to 'none'", () => {
    const csp = extractCsp(extractSrcdoc(renderScripted(scripted())));

    expect(csp).toContain("connect-src 'none'");
  });

  it("sets frame-src to 'none'", () => {
    const csp = extractCsp(extractSrcdoc(renderScripted(scripted())));

    expect(csp).toContain("frame-src 'none'");
  });

  it("sets object-src to 'none'", () => {
    const csp = extractCsp(extractSrcdoc(renderScripted(scripted())));

    expect(csp).toContain("object-src 'none'");
  });

  it("sets base-uri to 'none'", () => {
    const csp = extractCsp(extractSrcdoc(renderScripted(scripted())));

    expect(csp).toContain("base-uri 'none'");
  });

  it("sets form-action to 'none'", () => {
    const csp = extractCsp(extractSrcdoc(renderScripted(scripted())));

    expect(csp).toContain("form-action 'none'");
  });

  it("grants no http/https/'self'/* sources", () => {
    const srcdoc = extractSrcdoc(renderScripted(scripted()));

    const csp = extractCsp(srcdoc);

    expect(csp).not.toContain("http:");

    expect(csp).not.toContain("https:");

    expect(csp).not.toContain("'self'");

    expect(csp).not.toContain("*");

    expect(srcdoc).not.toContain("http:");

    expect(srcdoc).not.toContain("https:");
  });
});

describe("renderScripted payload structural safety", () => {
  const hostileHtml = '</template><script>window.__escaped = true</script>';

  const hostileCss = '</style><script>window.__cssEscape = true</script>';

  const hostileScript = '</script><img src=x onerror=alert(1)>';

  it("keeps hostile closing tags inert inside the srcdoc", () => {
    const html = renderScripted(
      scripted({
        html: hostileHtml,
        css: hostileCss,
        script: hostileScript,
      }),
    );

    const srcdoc = extractSrcdoc(html);

    // The renderer-owned document must contain exactly one structural
    // script element (the fixed bootstrap) and one template element.
    const scriptTags = srcdoc.match(/<script[^>]*>/g) ?? [];

    const scriptCloses = srcdoc.match(/<\/script>/g) ?? [];

    const templateTags = srcdoc.match(/<template[^>]*>/g) ?? [];

    const templateCloses = srcdoc.match(/<\/template>/g) ?? [];

    expect(scriptTags).toHaveLength(1);

    expect(scriptCloses).toHaveLength(1);

    expect(templateTags).toHaveLength(1);

    expect(templateCloses).toHaveLength(1);

    // The one structural script and one structural template are the
    // renderer's own fixed elements (the renderer's template close is
    // immediately followed by the bootstrap script open), so the
    // authored sequences must never appear as unescaped structural
    // tags before authored content.
    expect(srcdoc).toContain('data-powershow-scripted-bootstrap="true"');

    expect(srcdoc).toContain(
      "document.getElementById('powershow-scripted-root')",
    );

    // Hostile authored sequences never become renderer-owned structure:
    // each authored string appears only inside the escaped payload
    // attribute, never as a real <script>, <style>, or <img> opener.
    expect(srcdoc).not.toContain("<script>window.__escaped");

    expect(srcdoc).not.toContain("<script>window.__cssEscape");

    expect(srcdoc).not.toContain("</style><script");

    expect(srcdoc).not.toContain("<img");

    expect(srcdoc).not.toContain("<style>");
  });

  it("recovers ordinary authored html/css/script from the payload exactly", () => {
    const html = "<h1>Hello</h1><p data-v=\"1\">World</p>";

    const css = "h1 { color: rgb(0, 128, 0); }\np { margin: 0; }";

    const script = "const answer = 42; console.log(answer);";

    const srcdoc = extractSrcdoc(
      renderScripted(scripted({ html, css, script })),
    );

    expect(recoverPayload(srcdoc, "html")).toBe(html);

    expect(recoverPayload(srcdoc, "css")).toBe(css);

    expect(recoverPayload(srcdoc, "script")).toBe(script);
  });

  it("recovers hostile payloads from the serialized payload exactly", () => {
    const srcdoc = extractSrcdoc(
      renderScripted(
        scripted({
          html: hostileHtml,
          css: hostileCss,
          script: hostileScript,
        }),
      ),
    );

    expect(recoverPayload(srcdoc, "html")).toBe(hostileHtml);

    expect(recoverPayload(srcdoc, "css")).toBe(hostileCss);

    expect(recoverPayload(srcdoc, "script")).toBe(hostileScript);
  });

  it("recovers payloads containing quotes, ampersands, and unicode", () => {
    const html = `text & "quotes" 'single' <b>&amp;</b> 日本語`;

    const script = 'alert("a&b<\\">");';

    const srcdoc = extractSrcdoc(
      renderScripted(scripted({ html, script })),
    );

    expect(recoverPayload(srcdoc, "html")).toBe(html);

    expect(recoverPayload(srcdoc, "script")).toBe(script);
  });

  it("preserves the authored title case-insensitively through renderElement", () => {
    const html = renderElement(
      scripted({ title: "PWM Demo" }),
    );

    expect(html).toContain("PWM Demo");
  });
});