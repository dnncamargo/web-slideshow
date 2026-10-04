import { describe, expect, it } from "vitest";
import { createContext, runInContext, runInNewContext } from "node:vm";

import type {
  FontResource,
  Presentation,
  PresentationFileResource,
  ScriptedElement,
} from "@web-slideshow/document-schema";

import { renderElement } from "../src/render-element";
import { renderFontResources } from "../src/render-font-resources";
import { renderScripted } from "../src/render-scripted";
import {
  createPresentation,
  createSlide,
} from "./fixtures/render-fixtures";

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

    ports: [],

    hidden: false,

    ...overrides,
  };
}

function presentationWithFonts(fonts: FontResource[]): Presentation {
  return createPresentation({
    slides: [createSlide({ elements: [scripted()] })],
    resources: { fonts },
  });
}

function presentationWithFiles(files: PresentationFileResource[]): Presentation {
  return createPresentation({
    slides: [createSlide({ elements: [scripted()] })],
    resources: { files },
  });
}

function fontResource(
  overrides: Partial<FontResource> = {},
): FontResource {
  return {
    id: "demo-font",
    family: "Demo Sans",
    faces: [{
      weight: 400,
      style: "normal",
      source: {
        type: "url",
        url: "https://cdn.example.com/demo-sans.woff2",
        format: "woff2",
      },
    }],
    ...overrides,
  };
}

const gradient = {
  type: "linear" as const,
  stops: [{ color: "#000", position: 0 }, { color: "#fff", position: 100 }],
};

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
): unknown {
  const regex = new RegExp(`data-${name}="([^"]*)"`);

  const match = srcdoc.match(regex);

  expect(match).not.toBeNull();

  return JSON.parse(decodeHtmlEntities(match![1]!)) as unknown;
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

function cspDirectives(csp: string): Map<string, string> {
  const directives = new Map<string, string>();

  for (const directive of csp.split(";")) {
    const trimmed = directive.trim();

    if (trimmed === "") {
      continue;
    }

    const separator = trimmed.indexOf(" ");
    const name = separator === -1 ? trimmed : trimmed.slice(0, separator);
    const value = separator === -1 ? "" : trimmed.slice(separator + 1).trim();

    directives.set(name, value);
  }

  return directives;
}

function extractBootstrap(srcdoc: string): string {
  const match = srcdoc.match(
    /<script data-scripted-runtime-bootstrap="true">([\s\S]*)<\/script>/,
  );

  expect(match).not.toBeNull();

  return match![1]!;
}

type ScriptedPortDescriptor = {
  id: string;
  label: string;
  kind: "action" | "boolean" | "number";
  direction?: "input" | "output" | "input-output";
  min?: number;
  max?: number;
  step?: number;
};

type ScriptedResourceDescriptor = {
  id: string;
  name: string;
  kind: string;
  representation: "binary" | "text";
  contentType: string;
  url?: string;
  content?: string;
};

type ScriptedRuntimeTestWindow = {
  ScriptedRuntime: {
    ports: {
      list(): ReadonlyArray<ScriptedPortDescriptor>;
      onAction(id: string, handler: () => void): void;
      onInput(id: string, handler: (value: boolean | number) => void): void;
      report(id: string, value: boolean | number): void;
    };
    resources: {
      list(): ReadonlyArray<ScriptedResourceDescriptor>;
      get(id: string): ScriptedResourceDescriptor | null;
    };
  };
};

type ScriptedMessageEvent = {
  source: unknown;
  data: unknown;
};

function executeScriptedBootstrap(element: ScriptedElement, presentation?: Presentation): {
  context: ReturnType<typeof createContext>;
  errors: unknown[];
  listener: ((event: ScriptedMessageEvent) => void) | undefined;
  messageSource: unknown;
  reports: unknown[];
  runtimeWindow: ScriptedRuntimeTestWindow;
} {
  const rendered = presentation === undefined
    ? renderScripted(element)
    : renderElement(element, { presentation });
  const srcdoc = extractSrcdoc(rendered);
  const reports: unknown[] = [];
  const errors: unknown[] = [];
  const root = { innerHTML: "" };
  let listener: ((event: ScriptedMessageEvent) => void) | undefined;
  const messageSource = {
    postMessage: (message: unknown) => reports.push(message),
  };
  const payload = {
    getAttribute: (name: string) => JSON.stringify(recoverPayload(srcdoc, name.slice(5))),
    remove() {},
  };
  const sandbox: Record<string, unknown> = {
    parent: messageSource,
    addEventListener(type: string, handler: (event: ScriptedMessageEvent) => void) {
      if (type === "message") {
        listener = handler;
      }
    },
  };
  sandbox.window = sandbox;
  const context = createContext(sandbox);
  sandbox.document = {
    getElementById: (id: string) => id === "scripted-runtime-payload" ? payload : root,
    createElement: () => ({ textContent: "" }),
    head: { appendChild() {} },
    body: {
      appendChild(node: { textContent: string }) {
        expect(node.textContent).toBe(element.script);
        try { runInContext(node.textContent, context); } catch (error) { errors.push(error); }
      },
    },
  };

  runInContext(extractBootstrap(srcdoc), context);

  return {
    context,
    errors,
    listener,
    messageSource,
    reports,
    runtimeWindow: sandbox as unknown as ScriptedRuntimeTestWindow,
  };
}

describe("renderScripted", () => {
  it("renders gradient borders on an outer frame with the iframe as the runtime target", () => {
    const html = renderScripted(scripted({
      style: {
        border: { width: 2, style: "solid", gradient },
        borderRadius: 12,
        className: "custom-scripted-stage",
      },
    }));

    expect(html).toContain('<div class="presentation-gradient-border"');
    expect(html).toContain('<iframe class="presentation-element presentation-scripted custom-scripted-stage"');
    expect(html).toContain('data-presentation-id="scripted-1"');
    expect(html).toContain('data-presentation-type="scripted"');
    expect(html).toContain("--presentation-gradient-border-width:2px");
    expect(html).toContain("--presentation-gradient-border-paint:linear-gradient");
    expect(html).toContain("border:0");
    expect(html).toContain("padding:2px");
    expect(html).toContain("border-radius:12px");
    expect(html).toContain("border-radius:max(0px,calc(12px - 2px))");
    expect(html).not.toContain("border-image:");
    expect(html).not.toContain('class="presentation-gradient-border presentation-element');
  });

  it("maps authored dimensions to the frame and iframe viewport", () => {
    const html = renderScripted(scripted({
      layout: { width: "80%", height: "60%" },
      style: { border: { width: 4, style: "solid", gradient } },
    }));

    expect(html).toContain("width:80%;height:60%");
    expect(html).toContain('style="display:block;width:100%;height:100%;border:0"');

    const iframeStyle = html.match(/<iframe[^>]*style="([^"]*)"/)?.[1] ?? "";
    expect(iframeStyle).not.toContain("width:80%");
    expect(iframeStyle).not.toContain("height:60%");
  });

  it("maps width-only sizing without forcing iframe height", () => {
    const html = renderScripted(scripted({
      layout: { width: 320 },
      style: { border: { width: 4, style: "solid", gradient } },
    }));

    expect(html).toContain("width:320px");
    expect(html).toContain('style="display:block;width:100%;border:0"');

    const iframeStyle = html.match(/<iframe[^>]*style="([^"]*)"/)?.[1] ?? "";
    expect(iframeStyle).not.toContain("height:100%");
  });

  it("keeps omitted dimensions auto-sized and shrink-wraps the frame", () => {
    const html = renderScripted(scripted({
      style: { border: { width: 3, style: "solid", gradient } },
    }));

    expect(html).toContain("width:max-content");
    expect(html).toContain('style="display:block;border:0"');
    expect(html).not.toContain("width:100%;height:100%;border:0");
  });

  it("keeps height-only sizing on the frame and iframe", () => {
    const html = renderScripted(scripted({
      layout: { height: 240 },
      style: { border: { width: 3, style: "solid", gradient } },
    }));

    expect(html).toContain("height:240px");
    expect(html).toContain("width:max-content");
    expect(html).toContain('style="display:block;height:100%;border:0"');
    expect(html).not.toContain("width:100%;height:100%");
  });

  it("keeps absolute positioning and margins on the outer frame", () => {
    const html = renderScripted(scripted({
      layout: {
        position: "absolute",
        top: 10,
        right: "5%",
        margin: 6,
        marginLeft: 8,
      },
      style: { border: { width: 2, style: "solid", gradient } },
    }));

    expect(html).toContain("position:absolute");
    expect(html).toContain("top:10px");
    expect(html).toContain("right:5%");
    expect(html).toContain("margin:6px");
    expect(html).toContain("margin-left:8px");
    expect(html).not.toContain("position:relative");

    const iframeStyle = html.match(/<iframe[^>]*style="([^"]*)"/)?.[1] ?? "";
    expect(iframeStyle).not.toContain("position:absolute");
    expect(iframeStyle).not.toContain("margin:");
    expect(iframeStyle).not.toContain("top:");
  });

  it("adds a positioning context for non-positioned gradient frames", () => {
    const html = renderScripted(scripted({
      style: { border: { width: 2, style: "solid", gradient } },
    }));

    expect(html).toContain("position:relative");
  });

  it("keeps background, opacity, and shadow on the outer frame", () => {
    const html = renderScripted(scripted({
      style: {
        background: { color: "#123456" },
        border: { width: 2, style: "solid", gradient },
      },
      effect: {
        opacity: 0.5,
        shadow: { x: 1, y: 2, blur: 3, color: "#000" },
      },
    }));

    expect(html).toContain("background:#123456");
    expect(html).toContain("opacity:0.5");
    expect(html).toContain("box-shadow:1px 2px 3px #000");

    const iframeStyle = html.match(/<iframe[^>]*style="([^"]*)"/)?.[1] ?? "";
    expect(iframeStyle).not.toContain("background:");
    expect(iframeStyle).not.toContain("opacity:");
    expect(iframeStyle).not.toContain("box-shadow:");
  });

  it("keeps non-gradient Scripted as a single iframe", () => {
    const html = renderScripted(scripted({
      style: { border: { width: 2, style: "dashed", color: "#f87171" } },
    }));

    expect(html.match(/<iframe/g)).toHaveLength(1);
    expect(html).not.toContain("presentation-gradient-border");
    expect(html).toContain("border-style:dashed");
    expect(html).toContain("border-color:#f87171");
    expect(html).not.toContain("border-image:");
  });

  it.each([
    ["solid", "#f87171"],
    ["dotted", "#22d3ee"],
  ] as const)("keeps %s color borders native", (style, color) => {
    const html = renderScripted(scripted({
      style: { border: { width: 2, style, color } },
    }));

    expect(html.match(/<iframe/g)).toHaveLength(1);
    expect(html).not.toContain("presentation-gradient-border");
    expect(html).toContain(`border-style:${style}`);
    expect(html).toContain(`border-color:${color}`);
    expect(html).not.toContain("border-image:");
  });
  it("renders an empty string when hidden", () => {
    expect(renderScripted(scripted({ hidden: true }))).toBe("");

    expect(renderElement(scripted({ hidden: true }))).toBe("");
  });

  it("renders a real iframe when visible", () => {
    const html = renderScripted(scripted());

    expect(html).toContain("<iframe");

    expect(html).toContain("></iframe>");
  });

  it("emits the presentation-element and presentation-scripted classes", () => {
    const html = renderScripted(scripted());

    expect(html).toContain("presentation-element");

    expect(html).toContain("presentation-scripted");
  });

  it("emits data-presentation-id", () => {
    expect(renderScripted(scripted())).toContain(
      'data-presentation-id="scripted-1"',
    );
  });

  it("emits data-presentation-type=\"scripted\"", () => {
    expect(renderScripted(scripted())).toContain(
      'data-presentation-type="scripted"',
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

  it("applies canonical surface namespaces to the iframe", () => {
    const html = renderScripted(
      scripted({
        layout: { width: 200 },
        effect: { opacity: 0.5 },
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

    expect(html).toContain('data-presentation-type="scripted"');
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

    expect(cspDirectives(csp).get("default-src")).toBe("'none'");
  });

  it("sets the exact image sources", () => {
    const csp = extractCsp(extractSrcdoc(renderScripted(scripted())));

    expect(cspDirectives(csp).get("img-src")).toBe("https: data: blob:");
  });

  it("sets connect-src to 'none'", () => {
    const csp = extractCsp(extractSrcdoc(renderScripted(scripted())));

    expect(cspDirectives(csp).get("connect-src")).toBe("'none'");
  });

  it("sets frame-src to 'none'", () => {
    const csp = extractCsp(extractSrcdoc(renderScripted(scripted())));

    expect(cspDirectives(csp).get("frame-src")).toBe("'none'");
  });

  it("sets object-src to 'none'", () => {
    const csp = extractCsp(extractSrcdoc(renderScripted(scripted())));

    expect(cspDirectives(csp).get("object-src")).toBe("'none'");
  });

  it("sets base-uri to 'none'", () => {
    const csp = extractCsp(extractSrcdoc(renderScripted(scripted())));

    expect(cspDirectives(csp).get("base-uri")).toBe("'none'");
  });

  it("sets form-action to 'none'", () => {
    const csp = extractCsp(extractSrcdoc(renderScripted(scripted())));

    expect(cspDirectives(csp).get("form-action")).toBe("'none'");
  });

  it("allows HTTPS only for images, media, and fonts and keeps other directives exact", () => {
    const csp = extractCsp(extractSrcdoc(renderScripted(scripted())));
    const directives = cspDirectives(csp);

    expect(directives).toEqual(new Map([
      ["default-src", "'none'"],
      ["script-src", "'unsafe-inline'"],
      ["style-src", "'unsafe-inline'"],
      ["img-src", "https: data: blob:"],
      ["media-src", "https: data: blob:"],
      ["font-src", "https: data:"],
      ["connect-src", "'none'"],
      ["frame-src", "'none'"],
      ["object-src", "'none'"],
      ["base-uri", "'none'"],
      ["form-action", "'none'"],
    ]));

    for (const [name, value] of directives) {
      expect(value).not.toContain("http:");
      expect(value).not.toContain("*");
      expect(value).not.toContain("'self'");

      if (name !== "img-src" && name !== "media-src" && name !== "font-src") {
        expect(value).not.toContain("https:");
      }
    }
  });
});

describe("renderScripted Presentation file resources bootstrap", () => {
  const files: PresentationFileResource[] = [
    {
      id: "file-image",
      name: 'image "<& 日本語',
      kind: "image",
      representation: "binary",
      contentType: "image/png",
      source: { type: "url", url: "https://cdn.example.com/image.png" },
    },
    {
      id: "file-audio",
      name: "audio",
      kind: "audio",
      representation: "binary",
      contentType: "audio/mpeg",
      source: { type: "url", url: "https://cdn.example.com/audio.mp3" },
    },
    {
      id: "file-font",
      name: "font",
      kind: "font",
      representation: "binary",
      contentType: "font/woff2",
      source: { type: "url", url: "https://cdn.example.com/font.woff2" },
    },
    {
      id: "file-text",
      name: "plain text",
      kind: "text",
      representation: "text",
      contentType: "text/plain",
      source: { type: "text", content: 'plain </template><script>resource</script> & " 日本語' },
    },
    {
      id: "file-markdown",
      name: "markdown",
      kind: "markdown",
      representation: "text",
      contentType: "text/markdown",
      source: { type: "text", content: "# Markdown" },
    },
    {
      id: "file-csv",
      name: "CSV",
      kind: "structured-data",
      representation: "text",
      contentType: "text/csv",
      source: { type: "text", content: "name,value\nanswer,42" },
    },
    {
      id: "file-json",
      name: "JSON",
      kind: "structured-data",
      representation: "text",
      contentType: "application/json",
      source: { type: "text", content: '{"quote":"<value> & 日本語"}' },
    },
    {
      id: "file-xml",
      name: "XML",
      kind: "structured-data",
      representation: "text",
      contentType: "application/xml",
      source: { type: "text", content: '<root value="1" />' },
    },
    {
      id: "file-svg",
      name: "SVG",
      kind: "image",
      representation: "text",
      contentType: "image/svg+xml",
      source: { type: "text", content: '<svg viewBox="0 0 1 1"><path /></svg>' },
    },
  ];

  const expected = [
    { id: "file-image", name: 'image "<& 日本語', kind: "image", representation: "binary", contentType: "image/png", url: "https://cdn.example.com/image.png" },
    { id: "file-audio", name: "audio", kind: "audio", representation: "binary", contentType: "audio/mpeg", url: "https://cdn.example.com/audio.mp3" },
    { id: "file-font", name: "font", kind: "font", representation: "binary", contentType: "font/woff2", url: "https://cdn.example.com/font.woff2" },
    { id: "file-text", name: "plain text", kind: "text", representation: "text", contentType: "text/plain", content: 'plain </template><script>resource</script> & " 日本語' },
    { id: "file-markdown", name: "markdown", kind: "markdown", representation: "text", contentType: "text/markdown", content: "# Markdown" },
    { id: "file-csv", name: "CSV", kind: "structured-data", representation: "text", contentType: "text/csv", content: "name,value\nanswer,42" },
    { id: "file-json", name: "JSON", kind: "structured-data", representation: "text", contentType: "application/json", content: '{"quote":"<value> & 日本語"}' },
    { id: "file-xml", name: "XML", kind: "structured-data", representation: "text", contentType: "application/xml", content: '<root value="1" />' },
    { id: "file-svg", name: "SVG", kind: "image", representation: "text", contentType: "image/svg+xml", content: '<svg viewBox="0 0 1 1"><path /></svg>' },
  ];

  it("serializes files through the safe payload in canonical order", () => {
    const presentation = presentationWithFiles(files);
    const first = renderElement(scripted(), { presentation });
    const second = renderElement(scripted(), { presentation });
    const srcdoc = extractSrcdoc(first);

    expect(first).toBe(second);
    expect(recoverPayload(srcdoc, "resources")).toEqual(expected);
    expect(srcdoc).not.toContain("<script>resource");
    expect(JSON.stringify(presentation)).toContain("file-image");
  });

  it("installs resources before authored code and exposes only the exact API", () => {
    const element = scripted({
      script: "window.resourceApiAtStartup = Object.keys(ScriptedRuntime.resources).join(',');",
    });
    const { context, errors, runtimeWindow } = executeScriptedBootstrap(element, presentationWithFiles(files));
    const runtime = runtimeWindow.ScriptedRuntime;
    const listed = runtime.resources.list();

    expect(errors).toHaveLength(0);
    expect(runInContext("window.resourceApiAtStartup", context)).toBe("list,get");
    expect(Object.keys(runtime)).toEqual(["ports", "resources"]);
    expect(Object.keys(runtime.resources)).toEqual(["list", "get"]);
    expect(listed).toEqual(expected);
    expect(Object.isFrozen(runtime)).toBe(true);
    expect(Object.isFrozen(runtime.resources)).toBe(true);
    expect(Object.isFrozen(listed)).toBe(true);
    expect(listed.every((resource) => Object.isFrozen(resource))).toBe(true);
    expect(runtime.resources.list()).toBe(listed);
    expect(runtime.resources.get("file-image")).toBe(listed[0]);
    expect(runtime.resources.get("missing")).toBeNull();
    expect(() => runtime.resources.get(42 as unknown as string)).toThrowError(
      new TypeError("Scripted resource id must be a string"),
    );
    expect(Object.keys(listed[0]!)).toEqual(["id", "name", "kind", "representation", "contentType", "url"]);
    expect(Object.keys(listed[3]!)).toEqual(["id", "name", "kind", "representation", "contentType", "content"]);
    expect(listed[0]).not.toBe(files[0]);
    expect("source" in listed[0]!).toBe(false);
  });

  it("returns a frozen empty snapshot without a Presentation context", () => {
    const { errors, runtimeWindow } = executeScriptedBootstrap(scripted());
    const listed = runtimeWindow.ScriptedRuntime.resources.list();

    expect(errors).toHaveLength(0);
    expect(listed).toEqual([]);
    expect(Object.isFrozen(listed)).toBe(true);
    expect(runtimeWindow.ScriptedRuntime.resources.get("missing")).toBeNull();
  });

  it("keeps descriptor and snapshot mutation attempts isolated", () => {
    const presentation = presentationWithFiles(files);
    const before = JSON.stringify(presentation);
    const element = scripted({
      script: [
        "var snapshot = ScriptedRuntime.resources.list();",
        "try { snapshot.push({ id: 'injected' }); } catch (_error) {}",
        "try { snapshot[0].name = 'mutated'; } catch (_error) {}",
        "try { ScriptedRuntime.resources = {}; } catch (_error) {}",
        "try { ScriptedRuntime.resources.list = function () { return []; }; } catch (_error) {}",
      ].join("\n"),
    });
    const { errors, runtimeWindow } = executeScriptedBootstrap(element, presentation);
    const listed = runtimeWindow.ScriptedRuntime.resources.list();

    expect(errors).toHaveLength(0);
    expect(listed).toHaveLength(files.length);
    expect(listed[0]?.name).toBe(files[0]?.name);
    expect(runtimeWindow.ScriptedRuntime.resources.get("file-image")).toBe(listed[0]);
    expect(JSON.stringify(presentation)).toBe(before);
  });
});

describe("renderScripted presentation font resources", () => {
  it("omits the renderer-owned font style without Presentation font resources", () => {
    const srcdoc = extractSrcdoc(renderScripted(scripted()));

    expect(srcdoc).not.toContain("data-presentation-font-resources");
  });

  it("propagates Presentation font resources through renderElement", () => {
    const fonts = [fontResource()];
    const srcdoc = extractSrcdoc(
      renderElement(scripted(), { presentation: presentationWithFonts(fonts) }),
    );
    const expectedCss = renderFontResources(fonts);

    expect(srcdoc).toContain(
      `<style data-presentation-font-resources>${expectedCss}</style>`,
    );
    expect(srcdoc.indexOf("data-presentation-font-resources")).toBeLessThan(
      srcdoc.indexOf('data-scripted-runtime-bootstrap="true"'),
    );
  });

  it("renders truetype faces with canonical family, URL, format, and descriptors", () => {
    const fonts = [fontResource({
      family: "Demo Serif",
      faces: [{
        weight: 700,
        style: "italic",
        unicodeRange: "U+0000-00FF",
        source: {
          type: "url",
          url: "https://cdn.example.com/demo-serif.ttf",
          format: "truetype",
        },
      }],
    })];
    const srcdoc = extractSrcdoc(
      renderElement(scripted(), { presentation: presentationWithFonts(fonts) }),
    );

    expect(srcdoc).toContain('font-family:"Demo Serif"');
    expect(srcdoc).toContain('url("https://cdn.example.com/demo-serif.ttf")');
    expect(srcdoc).toContain('format("truetype")');
    expect(srcdoc).toContain("font-weight:700");
    expect(srcdoc).toContain("font-style:italic");
    expect(srcdoc).toContain("unicode-range:U+0000-00FF");
  });

  it("preserves woff2 serializer parity, multiple faces, and deduplication", () => {
    const face = {
      weight: 400 as const,
      style: "normal" as const,
      source: {
        type: "url" as const,
        url: "https://cdn.example.com/demo-sans.woff2",
        format: "woff2" as const,
      },
    };
    const fonts = [fontResource({ faces: [
      face,
      { ...face },
      { ...face, weight: 700 },
    ] })];
    const srcdoc = extractSrcdoc(
      renderElement(scripted(), { presentation: presentationWithFonts(fonts) }),
    );
    const expectedCss = renderFontResources(fonts);

    expect(srcdoc).toContain(expectedCss);
    expect(expectedCss.split("@font-face").length - 1).toBe(2);
    expect(srcdoc.split("@font-face").length - 1).toBe(2);
  });

  it("keeps hostile font metadata inside the single renderer-owned style", () => {
    const fonts = [fontResource({
      family: 'Unsafe"</style>',
      faces: [{
        source: {
          type: "url",
          url: 'https://cdn.example.com/font")}.woff2?<tag>',
          format: "woff2",
        },
      }],
    })];
    const srcdoc = extractSrcdoc(
      renderElement(scripted(), { presentation: presentationWithFonts(fonts) }),
    );
    const styleTags = srcdoc.match(/<style\b[^>]*>/g) ?? [];
    const styleCloses = srcdoc.match(/<\/style>/g) ?? [];

    expect(styleTags).toHaveLength(1);
    expect(styleCloses).toHaveLength(1);
    expect(srcdoc).not.toContain("</style><script");
    expect(srcdoc).toContain("\\22 ");
    expect(srcdoc).toContain("\\3c ");
    expect(srcdoc).toContain("\\3e ");
  });

  it("does not mutate Presentation or Scripted data while rendering", () => {
    const element = scripted();
    const presentation = presentationWithFonts([fontResource()]);
    const before = JSON.stringify({ element, presentation });

    renderElement(element, { presentation });

    expect(JSON.stringify({ element, presentation })).toBe(before);
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
    expect(srcdoc).toContain('data-scripted-runtime-bootstrap="true"');

    expect(srcdoc).toContain(
      "document.getElementById('scripted-runtime-root')",
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

describe("renderScripted ScriptedRuntime.ports bootstrap", () => {
  const ports: ScriptedElement["ports"] = [
    { id: "scroll-up", label: "Scroll up", kind: "action" },
    {
      id: "closed",
      label: "Closed",
      kind: "boolean",
      direction: "input",
    },
    {
      id: "current",
      label: "Current",
      kind: "number",
      direction: "output",
      min: 0,
      max: 100,
      step: 5,
    },
  ];

  it("continues rendering Scripted elements with no ports", () => {
    expect(renderScripted(scripted({ ports: [] }))).toContain("<iframe");
  });

  it("transports the element id and ports as serialized payload data", () => {
    const elementId = 'element "<& 日本語';

    const portPayload: ScriptedElement["ports"] = [
      {
        id: 'current "<& 日本語',
        label: 'Current </template><script>unsafe</script>',
        kind: "number",
        direction: "input-output",
        min: -1,
        max: 1,
        step: 0.1,
      },
    ];

    const srcdoc = extractSrcdoc(
      renderScripted(scripted({ id: elementId, ports: portPayload })),
    );

    expect(recoverPayload(srcdoc, "element-id")).toBe(elementId);
    expect(recoverPayload(srcdoc, "ports")).toEqual(portPayload);
    expect(srcdoc).not.toContain("<script>unsafe");
  });

  it("installs the exact public API before appending authored script", () => {
    const srcdoc = extractSrcdoc(renderScripted(scripted({ ports })));

    const apiIndex = srcdoc.indexOf("Object.defineProperty(window, 'ScriptedRuntime'");
    const authoredScriptIndex = srcdoc.indexOf("scriptNode.textContent = script");

    expect(apiIndex).toBeGreaterThan(-1);
    expect(authoredScriptIndex).toBeGreaterThan(apiIndex);
    expect(srcdoc).toContain("list: list");
    expect(srcdoc).toContain("onAction: onAction");
    expect(srcdoc).toContain("onInput: onInput");
    expect(srcdoc).toContain("report: report");
  });

  it.each([
    ["current source", "ScriptedRuntime.ports.report('current', 17.25);", true],
  ])("preserves and executes %s", (_label, script, works) => {
    const element = scripted({ ports, script: `// café\r\n  ${script}\r\n` });
    const original = JSON.stringify(element);
    const { context, errors, reports } = executeScriptedBootstrap(element);

    expect(JSON.stringify(element)).toBe(original);
    expect(runInContext("typeof ScriptedRuntime.ports.report", context)).toBe("function");
    expect(errors).toHaveLength(works ? 0 : 1);
    if (!works) expect(errors[0]).toMatchObject({ name: "ReferenceError" });
    expect(reports).toEqual(works ? [{
      type: "scripted:report", elementId: element.id, portId: "current", value: 17.25,
    }] : []);
  });

  it("lists detached frozen declared-port descriptors before authored code runs", () => {
    const element = scripted({
      ports,
      script: [
        "var declared = ScriptedRuntime.ports.list();",
        "if (!Object.isFrozen(declared) || declared.length !== 3 || !declared.every(Object.isFrozen)) { throw new Error('invalid declared ports snapshot'); }",
        "try { declared.push({ id: 'injected', label: 'Injected', kind: 'action' }); } catch (_error) {}",
        "try { declared[0].label = 'Renamed'; declared[0].kind = 'number'; } catch (_error) {}",
        "try { declared[1].direction = 'output'; } catch (_error) {}",
        "try { declared[2].min = -100; declared[2].max = 1000; declared[2].step = 1; } catch (_error) {}",
        "window.actionAccepted = false; window.inputAccepted = false;",
        "ScriptedRuntime.ports.onAction('scroll-up', function () { window.actionAccepted = true; });",
        "ScriptedRuntime.ports.onInput('closed', function (value) { window.inputAccepted = value; });",
        "ScriptedRuntime.ports.report('current', 17.25);",
      ].join("\n"),
    });
    const { context, errors, listener, messageSource, reports, runtimeWindow } = executeScriptedBootstrap(element);
    const listed = runtimeWindow.ScriptedRuntime.ports.list();

    expect(errors).toHaveLength(0);
    expect(listener).toBeDefined();
    listener!({
      source: messageSource,
      data: { type: "scripted:action", elementId: element.id, portId: "scroll-up" },
    });
    listener!({
      source: messageSource,
      data: { type: "scripted:input", elementId: element.id, portId: "closed", value: true },
    });
    expect(listed).toEqual(ports);
    expect(Object.isFrozen(listed)).toBe(true);
    expect(listed).not.toBe(ports);
    expect(listed.every((port, index) => port !== ports[index])).toBe(true);
    expect(Object.keys(listed[0]!)).toEqual(["id", "label", "kind"]);
    expect(Object.keys(listed[1]!)).toEqual(["id", "label", "kind", "direction"]);
    expect(Object.keys(listed[2]!)).toEqual(["id", "label", "kind", "direction", "min", "max", "step"]);
    expect(listed.every((port) => Object.isFrozen(port))).toBe(true);
    expect(runInContext("window.actionAccepted", context)).toBe(true);
    expect(runInContext("window.inputAccepted", context)).toBe(true);
    expect(reports).toEqual([{
      type: "scripted:report", elementId: element.id, portId: "current", value: 17.25,
    }]);
  });

  it("returns a frozen empty array when no ports are declared", () => {
    const element = scripted({
      ports: [],
      script: [
        "var declared = ScriptedRuntime.ports.list();",
        "if (!Array.isArray(declared) || declared.length !== 0 || !Object.isFrozen(declared)) { throw new Error('invalid empty declared ports snapshot'); }",
      ].join("\n"),
    });
    const { errors, runtimeWindow } = executeScriptedBootstrap(element);

    expect(errors).toHaveLength(0);
    expect(runtimeWindow.ScriptedRuntime.ports.list()).toEqual([]);
    expect(Object.isFrozen(runtimeWindow.ScriptedRuntime.ports.list())).toBe(true);
  });

  it("uses the exact three Scripted message types", () => {
    const srcdoc = extractSrcdoc(renderScripted(scripted({ ports })));

    expect(srcdoc).toContain("scripted:action");
    expect(srcdoc).toContain("scripted:input");
    expect(srcdoc).toContain("scripted:report");
    expect(srcdoc).toContain('id="scripted-runtime-root"');
    expect(srcdoc).toContain('id="scripted-runtime-payload"');
    expect(srcdoc).toContain('data-scripted-runtime-bootstrap="true"');
  });

  it("enforces source, exact envelopes, and canonical element and port checks", () => {
    const srcdoc = extractSrcdoc(renderScripted(scripted({ ports })));

    expect(srcdoc).toContain("event.source !== window.parent");
    expect(srcdoc).toContain("Object.keys(value)");
    expect(srcdoc).toContain("data.elementId !== elementId");
    expect(srcdoc).toContain("own(portsById, data.portId)");
    expect(srcdoc).toContain("portsById[data.portId].kind !== 'action'");
  });

  it("validates boolean and bounded finite number inputs and reports", () => {
    const srcdoc = extractSrcdoc(renderScripted(scripted({ ports })));

    expect(srcdoc).toContain("typeof value === 'boolean'");
    expect(srcdoc).toContain("typeof value === 'number'");
    expect(srcdoc).toContain("Number.isFinite(value)");
    expect(srcdoc).toContain("value >= port.min");
    expect(srcdoc).toContain("value <= port.max");
    expect(srcdoc).toContain("Scripted port does not permit reports");
    expect(srcdoc).not.toContain("value % port.step");
  });

  it("posts reports only to parent with the opaque-origin wildcard target", () => {
    const srcdoc = extractSrcdoc(renderScripted(scripted({ ports })));

    expect(srcdoc).toContain("window.parent.postMessage({ type: 'scripted:report'");
    expect(srcdoc).toContain("value: value }, '*')");
  });

  it("contains no message queue or prohibited dynamic execution primitive", () => {
    const srcdoc = extractSrcdoc(renderScripted(scripted({ ports })));

    expect(srcdoc).not.toContain("queue");
    expect(srcdoc).not.toContain("history");
    expect(srcdoc).not.toContain("eval(");
    expect(srcdoc).not.toContain("Function(");
    expect(srcdoc).not.toContain("document.write");
    expect(srcdoc).not.toContain("setTimeout(");
  });

  it("dispatches only valid commands and reports only valid primitive outputs", () => {
    const srcdoc = extractSrcdoc(renderScripted(scripted({ ports })));
    const messages: unknown[] = [];
    const parent = {
      postMessage(message: unknown, target: string) {
        messages.push({ message, target });
      },
    };
    let listener: ((event: { source: unknown; data: unknown }) => void) | undefined;
    const payload = {
      getAttribute(name: string) {
        const payloads: Record<string, unknown> = {
          html: "",
          css: "",
          script: "",
          "element-id": "scripted-1",
          ports,
          resources: [],
        };

        const value = payloads[name.slice(5)];

        return value === undefined ? null : JSON.stringify(value);
      },
      remove() {},
    };
    const root = { innerHTML: "" };
    const document = {
      getElementById(id: string) {
        if (id === "scripted-runtime-payload") {
          return payload;
        }

        return id === "scripted-runtime-root" ? root : null;
      },
      createElement() {
        return { textContent: "" };
      },
      head: { appendChild() {} },
      body: { appendChild() {} },
    };
    const sandboxWindow = {
      parent,
      addEventListener(type: string, handler: typeof listener) {
        if (type === "message") {
          listener = handler;
        }
      },
    };

    runInNewContext(extractBootstrap(srcdoc), {
      window: sandboxWindow,
      document,
    });

    expect(listener).toBeDefined();

    const runtimeWindow = sandboxWindow as typeof sandboxWindow & ScriptedRuntimeTestWindow;
    let actionCount = 0;
    const inputs: Array<boolean | number> = [];

    expect(Object.isFrozen(runtimeWindow.ScriptedRuntime)).toBe(true);
    expect(Object.isFrozen(runtimeWindow.ScriptedRuntime.ports)).toBe(true);
    expect(Object.keys(runtimeWindow.ScriptedRuntime.ports)).toEqual([
      "list", "onAction", "onInput", "report",
    ]);

    runtimeWindow.ScriptedRuntime.ports.onAction("scroll-up", () => {
      actionCount += 1;
    });
    runtimeWindow.ScriptedRuntime.ports.onInput("closed", (value) => {
      inputs.push(value);
    });

    listener!({
      source: parent,
      data: {
        type: "scripted:action",
        elementId: "scripted-1",
        portId: "scroll-up",
      },
    });
    listener!({
      source: parent,
      data: {
        type: "scripted:action",
        elementId: "scripted-1",
        portId: "scroll-up",
        value: true,
      },
    });
    listener!({
      source: parent,
      data: {
        type: "scripted:input",
        elementId: "scripted-1",
        portId: "closed",
        value: true,
      },
    });
    listener!({
      source: parent,
      data: {
        type: "scripted:input",
        elementId: "scripted-1",
        portId: "closed",
        value: 1,
      },
    });

    expect(actionCount).toBe(1);
    expect(inputs).toEqual([true]);

    // Unrecognized envelopes are rejected, never a supported API.
    listener!({ source: parent, data: {
      type: "unrecognized:scripted:action", elementId: "scripted-1", portId: "scroll-up",
    } });
    listener!({ source: parent, data: {
      type: "unrecognized:scripted:input", elementId: "scripted-1", portId: "closed", value: false,
    } });
    listener!({ source: {}, data: {
      type: "scripted:action", elementId: "scripted-1", portId: "scroll-up",
    } });
    listener!({ source: parent, data: {
      type: "scripted:action", elementId: "other-element", portId: "scroll-up",
    } });
    expect(actionCount).toBe(1);
    expect(inputs).toEqual([true]);

    runtimeWindow.ScriptedRuntime.ports.report("current", 17.25);

    expect(messages).toEqual([
      {
        message: {
          type: "scripted:report",
          elementId: "scripted-1",
          portId: "current",
          value: 17.25,
        },
        target: "*",
      },
    ]);
    expect(() => runtimeWindow.ScriptedRuntime.ports.report("current", Infinity)).toThrow();
    expect(() => runtimeWindow.ScriptedRuntime.ports.report("closed", false)).toThrow();
  });
});
