import { describe, expect, it } from "vitest";

import {
  V2ContainerSchema,
  type PowerShowElement,
} from "@powershow/document-schema";

import { renderContainerV2 } from "../src/render-container-v2";

const dotPattern = "radial-gradient(#444CF7 1.5px, transparent 1.5px)";

const gradient = {
  type: "linear" as const,
  angle: 135,
  stops: [
    { color: "#111827", position: 0 },
    { color: "#312e81", position: 100 },
  ],
};

// A minimal legacy child renderer returning a simple element stub.
const renderLegacy = (element: PowerShowElement): string =>
  `<span class="powershow-element" data-powershow-type="${element.type}">stub</span>`;

function createCandidateFixture() {
  return V2ContainerSchema.parse({
    id: "parity-content",
    type: "container",
    hidden: false,
    role: "content",
    layout: {
      width: "78%",
      height: "72%",
      minWidth: 240,
      minHeight: "20%",
      maxWidth: "90%",
      maxHeight: 720,
      margin: 16,
      marginTop: 8,
      marginRight: "2%",
      marginBottom: 24,
      marginLeft: 4,
      padding: 48,
      paddingTop: 32,
      paddingRight: "4%",
      paddingBottom: 40,
      paddingLeft: 24,
      overflow: "hidden",
      position: "absolute",
      top: "4%",
      left: 12,
      children: {
        mode: "flow",
        direction: "column",
        gap: 24,
        horizontalAlign: "center",
        verticalAlign: "center",
      },
    },
    style: {
      color: "#f8fafc",
      background: {
        color: "#0f172a",
        gradient,
        pattern: {
          image: dotPattern,
          size: "20px 20px",
          opacity: 0.8,
        },
      },
      border: {
        width: 2,
        style: "solid",
        color: "#334155",
      },
      borderRadius: 24,
      className: "content-surface",
    },
    typography: {
      fontFamily: "Inter",
      fontSize: 20,
      textAlign: "center",
    },
    effect: {
      opacity: 0.9,
      shadow: {
        x: 0,
        y: 12,
        blur: 32,
        color: "#00000066",
      },
    },
    link: {
      kind: "url",
      href: "https://example.com/content",
      target: "_blank",
    },
    children: [
      {
        id: "candidate-text",
        type: "text",
        hidden: false,
        variant: "body",
        content: "Candidate content",
      },
    ],
  });
}

function renderFixture(): string {
  return renderContainerV2(createCandidateFixture(), renderLegacy);
}

// Test-only helper: extracts the root Container's style attribute value so
// tests can assert the effective CSS deterministically rather than relying
// on substring presence that a later override would still satisfy.
function rootStyle(html: string): string {
  const match = /<(?:\w+)[^>]*?data-powershow-type="container"[^>]*style="([^"]*)"/.exec(
    html,
  );

  if (!match || !match[1]) {
    throw new Error(`No root Container style found in: ${html}`);
  }

  return match[1];
}

function parseProperty(style: string, property: string): string | undefined {
  for (const declaration of style.split(";")) {
    const [name, ...valueParts] = declaration.split(":");
    const value = valueParts.join(":");

    if (name?.trim() === property) {
      return value;
    }
  }

  return undefined;
}

describe("renderContainerV2", () => {
  it("renders minimal container with effective flow defaults but no namespaces", () => {
    const minimal = V2ContainerSchema.parse({
      id: "minimal-candidate",
      type: "container",
      children: [],
    });

    const html = renderContainerV2(minimal, renderLegacy);

    expect(html).toContain('data-powershow-type="container"');
    expect(html).toContain("display:flex");
    expect(html).toContain("flex-direction:column");
    expect(html).not.toContain("width:");
    expect(html).not.toContain("background:");
  });

  it("renders layout dimensions, spacing, and overflow", () => {
    const html = renderFixture();

    expect(html).toContain("width:78%");
    expect(html).toContain("height:72%");
    expect(html).toContain("min-width:240px");
    expect(html).toContain("min-height:20%");
    expect(html).toContain("max-width:90%");
    expect(html).toContain("max-height:720px");
    expect(html).toContain("margin-top:8px");
    expect(html).toContain("padding-left:24px");
    expect(html).toContain("overflow:hidden");
  });

  it("renders absolute positioning from layout.position and independent edges", () => {
    const html = renderFixture();

    expect(html).toContain("position:absolute");
    expect(html).toContain("top:4%");
    expect(html).toContain("left:12px");
  });

  it("does not consult placement/anchor/offset/inset authored addresses", () => {
    const html = renderFixture();

    // The renderer emits no authored placement vocabulary. Renderer-owned
    // overlay CSS (inset:0 on the link surface / pattern layer) is a
    // renderer implementation detail, explicitly allowed by the freeze.
    expect(html).not.toContain("placement");
    expect(html).not.toContain("anchor");
    expect(html).not.toContain("offset");
    expect(html.match(/inset:/g)?.length).toBe(2);
  });

  it("renders child flow, stack, gap, distribution, and alignment", () => {
    const flow = renderFixture();
    expect(flow).toContain("display:flex");
    expect(flow).toContain("flex-direction:column");
    expect(flow).toContain("gap:24px");
    expect(flow).toContain("align-items:center");
    expect(flow).toContain("justify-content:center");

    const stackCandidate = V2ContainerSchema.parse({
      id: "stack-candidate",
      type: "container",
      layout: {
        children: { mode: "stack", direction: "row" },
      },
      children: [],
    });

    const stackHtml = renderContainerV2(stackCandidate, renderLegacy);
    expect(stackHtml).toContain("display:grid");
    expect(stackHtml).toContain("powershow-container-stack");
  });

  it("renders background color, gradient, and pattern together", () => {
    const html = renderFixture();

    expect(html).toContain("background:#0f172a");
    expect(html).toContain(
      "background-image:linear-gradient(135deg,#111827 0%,#312e81 100%)",
    );
    expect(html).toContain("powershow-container-background-pattern");
    expect(html).toContain("background-image:radial-gradient");
    expect(html).toContain("opacity:0.8");
  });

  it("renders border and radius", () => {
    const html = renderFixture();

    expect(html).toContain("border-width:2px");
    expect(html).toContain("border-style:solid");
    expect(html).toContain("border-color:#334155");
    expect(html).toContain("border-radius:24px");
  });

  it("renders typography namespace as inherited CSS capability", () => {
    const html = renderFixture();

    for (const fragment of [
      "font-family:Inter",
      "font-size:20px",
      "text-align:center",
    ]) {
      expect(html).toContain(fragment);
    }
  });

  it("renders effect.opacity and effect.shadow, not style-opacity/shadow", () => {
    const html = renderFixture();

    expect(html).toContain("opacity:0.9");
    expect(html).toContain("box-shadow:0px 12px 32px #00000066");
  });

  it("renders role semantic tag, link surface, and hidden suppression", () => {
    const html = renderFixture();

    expect(html).toContain('data-powershow-role="content"');
    expect(html).toContain('data-powershow-container-link-surface="true"');
    expect(html).toContain('href="https://example.com/content"');

    const hiddenCandidate = {
      ...createCandidateFixture(),
      hidden: true,
    };
    expect(renderContainerV2(hiddenCandidate, renderLegacy)).toBe("");
  });

  it("recurses nested candidate containers", () => {
    const nested = V2ContainerSchema.parse({
      id: "nested-candidate",
      type: "container",
      layout: {
        children: { mode: "stack", direction: "row" },
      },
      children: [],
    });

    const parent = V2ContainerSchema.parse({
      id: "candidate-parent",
      type: "container",
      layout: {
        children: { mode: "stack", direction: "column" },
      },
      children: [nested],
    });

    const html = renderContainerV2(parent, renderLegacy);

    expect(html).toContain('data-powershow-id="candidate-parent"');
    expect(html).toContain('data-powershow-id="nested-candidate"');
    expect(html.match(/data-powershow-type="container"/g)).toHaveLength(2);
  });

  it("dispatches legacy non-Container children through the legacy renderer", () => {
    const candidate = V2ContainerSchema.parse({
      id: "candidate-parent",
      type: "container",
      children: [
        {
          id: "legacy-text",
          type: "text",
          hidden: false,
          variant: "body",
          content: "Legacy",
        },
      ],
    });

    const calls: string[] = [];
    const spyRenderer = (element: PowerShowElement): string => {
      calls.push(element.type);
      return `<span data-powershow-child-type="${element.type}"></span>`;
    };

    const html = renderContainerV2(candidate, spyRenderer);

    expect(calls).toContain("text");
    expect(html).toContain('data-powershow-child-type="text"');
  });
});

describe("renderContainerV2 absolute edge combinations", () => {
  it.each([
    ["top only", { top: 10 }],
    ["top + left", { top: 10, left: 20 }],
    ["top + right", { top: 10, right: 20 }],
    ["bottom + left", { bottom: 10, left: 20 }],
    ["all four", { top: 10, right: 20, bottom: 30, left: 40 }],
  ] as const)("renders %s by direct emission", (_name, edges) => {
    const candidate = V2ContainerSchema.parse({
      id: "pos-candidate",
      type: "container",
      layout: { position: "absolute", ...edges },
      children: [],
    });

    const html = renderContainerV2(candidate, renderLegacy);

    for (const [property, value] of Object.entries(edges)) {
      expect(html).toContain(`${property}:${value}px`);
    }
  });

  it("renders opposite edges without invented PowerShow interpretation", () => {
    const candidate = V2ContainerSchema.parse({
      id: "opposite-candidate",
      type: "container",
      layout: { position: "absolute", top: 10, bottom: 30 },
      children: [],
    });

    const html = renderContainerV2(candidate, renderLegacy);

    expect(html).toContain("top:10px");
    expect(html).toContain("bottom:30px");
  });
});

describe("renderContainerV2 containing-block regressions", () => {
  // A normal-flow Container (no authored position) hosting an absolute child
  // must receive renderer-owned position:relative to establish the containing
  // block its absolute descendant requires.
  it("normal-flow Container + absolute child gets position:relative", () => {
    const candidate = V2ContainerSchema.parse({
      id: "parent",
      type: "container",
      layout: { children: { mode: "flow", direction: "column" } },
      children: [
        {
          id: "child",
          type: "container",
          layout: { position: "absolute", top: 0, left: 0 },
          children: [],
        },
      ],
    });

    const html = renderContainerV2(candidate, renderLegacy);

    expect(parseProperty(rootStyle(html), "position")).toBe("relative");
  });

  // Regression: authored layout.position = "absolute" is author intent and
  // must always survive. A later renderer-owned position:relative must never
  // override it, even when the Container has an absolute child.
  it("absolute Container + absolute child keeps position:absolute with no later override", () => {
    const candidate = V2ContainerSchema.parse({
      id: "parent",
      type: "container",
      layout: { position: "absolute", top: 10, left: 10 },
      children: [
        {
          id: "child",
          type: "container",
          layout: { position: "absolute", top: 0, left: 0 },
          children: [],
        },
      ],
    });

    const html = renderContainerV2(candidate, renderLegacy);
    const style = rootStyle(html);

    const positionDeclarations = [...style.matchAll(/(?:^|;)position:([^;]*)/g)].map(
      (match) => match[1],
    );

    expect(positionDeclarations).toEqual(["absolute"]);
    expect(style).not.toContain("position:relative");
  });

  // Absolute Container + link: author intent survives; the link overlay still
  // needs a containing block, which the authored absolute already provides.
  it("absolute Container + link keeps position:absolute", () => {
    const candidate = V2ContainerSchema.parse({
      id: "parent",
      type: "container",
      layout: { position: "absolute", top: 10, left: 10 },
      link: { kind: "url", href: "https://example.com" },
      children: [],
    });

    const html = renderContainerV2(candidate, renderLegacy);

    expect(parseProperty(rootStyle(html), "position")).toBe("absolute");
    expect(rootStyle(html)).not.toContain("position:relative");
    expect(html).toContain('data-powershow-container-link-surface="true"');
  });

  // Absolute Container + pattern: root keeps authored absolute and must emit
  // isolation:isolate to keep the negative pattern layer in its stack context.
  it("absolute Container + pattern keeps position:absolute and emits isolation:isolate", () => {
    const candidate = V2ContainerSchema.parse({
      id: "parent",
      type: "container",
      layout: { position: "absolute", top: 10, left: 10 },
      style: {
        background: { pattern: { image: dotPattern, size: "20px 20px" } },
      },
      children: [],
    });

    const html = renderContainerV2(candidate, renderLegacy);
    const style = rootStyle(html);

    expect(parseProperty(style, "position")).toBe("absolute");
    expect(parseProperty(style, "isolation")).toBe("isolate");
    expect(style).not.toContain("position:relative");
  });

  // Normal-flow Container + pattern: needs renderer-owned position:relative
  // for the pattern overlay and must emit isolation:isolate.
  it("normal-flow Container + pattern gets position:relative and isolation:isolate", () => {
    const candidate = V2ContainerSchema.parse({
      id: "parent",
      type: "container",
      style: {
        background: { pattern: { image: dotPattern, size: "20px 20px" } },
      },
      children: [],
    });

    const html = renderContainerV2(candidate, renderLegacy);
    const style = rootStyle(html);

    expect(parseProperty(style, "position")).toBe("relative");
    expect(parseProperty(style, "isolation")).toBe("isolate");
  });

  // Normal-flow Container + link: needs a renderer-owned containing block for
  // the link overlay.
  it("normal-flow Container + link gets position:relative", () => {
    const candidate = V2ContainerSchema.parse({
      id: "parent",
      type: "container",
      link: { kind: "url", href: "https://example.com" },
      children: [],
    });

    const html = renderContainerV2(candidate, renderLegacy);

    expect(parseProperty(rootStyle(html), "position")).toBe("relative");
  });

  // Combined pattern + link: correct containing block, isolation, and both
  // renderer-owned overlays coexist without changing the freeze contract.
  it("Container + pattern + link keeps containing block, isolation:isolate, and both overlays", () => {
    const candidate = V2ContainerSchema.parse({
      id: "parent",
      type: "container",
      link: { kind: "url", href: "https://example.com" },
      style: {
        background: { pattern: { image: dotPattern, size: "20px 20px" } },
      },
      children: [],
    });

    const html = renderContainerV2(candidate, renderLegacy);
    const style = rootStyle(html);

    expect(parseProperty(style, "position")).toBe("relative");
    expect(parseProperty(style, "isolation")).toBe("isolate");
    expect(html).toContain('data-powershow-container-link-surface="true"');

    const patternLayerMatch = /class="powershow-container-background-pattern"[^>]*style="([^"]*)"/.exec(
      html,
    );

    expect(patternLayerMatch).not.toBeNull();
    expect(patternLayerMatch?.[1]).toContain("z-index:-1");
  });

  // Nested absolute V2 Container child: parent establishes a containing block
  // only as required; the child keeps authored absolute.
  it("nested absolute V2 Container child stays absolute with parent containing block only as required", () => {
    const candidate = V2ContainerSchema.parse({
      id: "parent",
      type: "container",
      children: [
        {
          id: "child",
          type: "container",
          layout: { position: "absolute", top: 0, left: 0 },
          children: [],
        },
      ],
    });

    const html = renderContainerV2(candidate, renderLegacy);

    expect(parseProperty(rootStyle(html), "position")).toBe("relative");
    // The nested absolute child keeps authored absolute.
    const childStyle = /class="powershow-element powershow-container" data-powershow-id="child"[^>]*style="([^"]*)"/.exec(
      html,
    );

    expect(childStyle?.[1]).toContain("position:absolute");
  });
});