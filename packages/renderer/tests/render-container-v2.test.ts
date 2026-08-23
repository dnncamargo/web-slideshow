import { describe, expect, it } from "vitest";

import {
  V2ContainerSchema,
  type ContainerElement,
  type V2ContainerElement,
} from "@powershow/document-schema";

import { renderContainerV2 } from "../src/render-container-v2";
import { renderElement } from "../src/render-element";

const dotPattern = "radial-gradient(#444CF7 1.5px, transparent 1.5px)";

const gradient = {
  type: "linear" as const,
  angle: 135,
  stops: [
    { color: "#111827", position: 0 },
    { color: "#312e81", position: 100 },
  ],
};

function createLegacyFixture(): ContainerElement {
  return {
    id: "parity-content",
    type: "container",
    hidden: false,
    role: "content",
    direction: "column",
    gap: 24,
    horizontalAlign: "center",
    verticalAlign: "center",
    style: {
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
      placement: {
        mode: "absolute",
        anchor: "center",
        offsetX: "-4px",
        offsetY: 12,
      },
      color: "#f8fafc",
      background: "#0f172a",
      backgroundGradient: gradient,
      backgroundPattern: {
        image: dotPattern,
        size: "20px 20px",
        opacity: 0.8,
      },
      border: {
        width: 2,
        style: "solid",
        color: "#334155",
      },
      borderRadius: 24,
      opacity: 0.9,
      shadow: {
        x: 0,
        y: 12,
        blur: 32,
        color: "#00000066",
      },
      className: "content-surface",
      fontFamily: "Inter",
      fontSize: 20,
      textAlign: "center",
    },
    link: {
      kind: "url",
      href: "https://example.com/content",
      target: "_blank",
    },
    children: [
      {
        id: "legacy-text",
        type: "text",
        hidden: false,
        variant: "body",
        content: "Legacy content",
      },
    ],
  };
}

function createCandidateFixture(): V2ContainerElement {
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
      placement: {
        mode: "absolute",
        anchor: "center",
        offsetX: "-4px",
        offsetY: 12,
      },
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

function expectParityFragment(legacy: string, candidate: string, fragment: string) {
  expect(legacy, `legacy missing ${fragment}`).toContain(fragment);
  expect(candidate, `candidate missing ${fragment}`).toContain(fragment);
}

describe("renderContainerV2", () => {
  it("reproduces legacy observable Container capabilities at semantic addresses", () => {
    const legacy = renderElement(createLegacyFixture());
    const candidate = renderContainerV2(createCandidateFixture(), renderElement);

    for (const fragment of [
      '<div class="powershow-element powershow-container powershow-container-content content-surface"',
      'data-powershow-id="parity-content"',
      'data-powershow-type="container"',
      'data-powershow-role="content"',
      "width:78%",
      "height:72%",
      "min-width:240px",
      "max-width:90%",
      "margin:16px",
      "padding:48px",
      "position:absolute",
      "left:calc(50% + -4px)",
      "top:calc(50% + 12px)",
      "display:flex",
      "flex-direction:column",
      "gap:24px",
      "align-items:center",
      "justify-content:center",
      "background:#0f172a",
      "background-image:linear-gradient(135deg,#111827 0%,#312e81 100%)",
      "opacity:0.8",
      "border-width:2px",
      "border-color:#334155",
      "border-radius:24px",
      "opacity:0.9",
      "box-shadow:0px 12px 32px #00000066",
      'data-powershow-container-link-surface="true"',
      "powershow-container-background-pattern",
    ]) {
      expectParityFragment(legacy, candidate, fragment);
    }
  });

  it("maps the legacy top-level Container width to candidate layout.width", () => {
    const legacyFixture = createLegacyFixture();
    const { width: _styleWidth, ...legacyStyle } = legacyFixture.style ?? {};
    const legacy = {
      ...legacyFixture,
      width: "78%",
      style: legacyStyle,
    };
    const candidate = createCandidateFixture();

    expect(renderElement(legacy)).toContain("width:78%");
    expect(renderContainerV2(candidate, renderElement)).toContain("width:78%");
  });

  it("preserves gradient border rendering through style.border", () => {
    const border = {
      width: 3,
      style: "solid" as const,
      gradient: {
        type: "linear" as const,
        angle: 90,
        stops: [
          { color: "#7c3aed", position: 0 },
          { color: "#06b6d4", position: 100 },
        ],
      },
    };
    const legacyFixture = createLegacyFixture();
    const candidateFixture = createCandidateFixture();
    legacyFixture.style = { ...legacyFixture.style, border };
    candidateFixture.style = { ...candidateFixture.style, border };

    const expected =
      "border-image:linear-gradient(90deg,#7c3aed 0%,#06b6d4 100%) 1";

    expect(renderElement(legacyFixture)).toContain(expected);
    expect(renderContainerV2(candidateFixture, renderElement)).toContain(expected);
  });

  it.each([
    ["flow row", "flow", "row", "display:flex;flex-direction:row"],
    ["flow column", "flow", "column", "display:flex;flex-direction:column"],
    ["stack row", "stack", "row", "display:grid"],
    ["stack column", "stack", "column", "display:grid"],
  ] as const)("preserves %s child layout", (_name, mode, direction, expected) => {
    const candidate = V2ContainerSchema.parse({
      id: "layout-candidate",
      type: "container",
      hidden: false,
      layout: {
        children: { mode, direction },
      },
      children: [],
    });

    const html = renderContainerV2(candidate, renderElement);

    expect(html).toContain(expected);
    if (mode === "stack") {
      expect(html).toContain("powershow-container-stack");
    }
  });

  it("preserves absolute children, nested candidates, hidden state, and links", () => {
    const candidate = V2ContainerSchema.parse({
      id: "candidate-parent",
      type: "container",
      hidden: false,
      layout: {
        children: { mode: "stack", direction: "row" },
      },
      link: {
        kind: "url",
        href: "https://example.com/parent",
      },
      children: [
        {
          id: "candidate-child",
          type: "container",
          hidden: false,
          layout: {
            placement: { mode: "absolute", anchor: "top-left" },
            children: { mode: "flow", direction: "column" },
          },
          link: {
            kind: "url",
            href: "https://example.com/child",
          },
          children: [],
        },
      ],
    });

    const html = renderContainerV2(candidate, renderElement);

    expect(html).toContain('data-powershow-id="candidate-parent"');
    expect(html).toContain('data-powershow-id="candidate-child"');
    expect(html).toContain("position:relative");
    expect(html).toContain("grid-area:1 / 1");
    expect(html.match(/data-powershow-container-link-surface/g)).toHaveLength(2);

    expect(
      renderContainerV2(
        { ...candidate, hidden: true },
        renderElement,
      ),
    ).toBe("");
  });
});
