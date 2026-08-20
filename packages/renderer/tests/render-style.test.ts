import { describe, expect, it } from "vitest";

import type { ElementStyle } from "@powershow/document-schema";

import { renderStyle } from "../src/render-style";

import { renderLength } from "../src//render-length";

function countOccurrences(value: string, search: string): number {
  return value.split(search).length - 1;
}

describe("renderLength", () => {
  it("converts numeric lengths to pixels", () => {
    expect(renderLength(32)).toBe("32px");
  });

  it("preserves string lengths", () => {
    expect(renderLength("50%")).toBe("50%");
    expect(renderLength("3rem")).toBe("3rem");
    expect(renderLength("100vh")).toBe("100vh");
  });
});

describe("renderStyle", () => {
  it("returns an empty string when style is undefined", () => {
    expect(renderStyle(undefined)).toBe("");
  });

  it("renders dimensional styles", () => {
    const result = renderStyle({
      width: 640,
      height: "50%",
      padding: 24,
      marginTop: "2rem",
    });

    expect(result).toContain("width:640px");
    expect(result).toContain("height:50%");
    expect(result).toContain("padding:24px");
    expect(result).toContain("margin-top:2rem");
  });

  it("renders visual styles", () => {
    const result = renderStyle({
      background: "#000",
      color: "#fff",
      borderRadius: 12,
      opacity: 0.75,
      overflow: "hidden",
    });

    expect(result).toContain("background:#000");

    expect(result).toContain("color:#fff");

    expect(result).toContain("border-radius:12px");

    expect(result).toContain("opacity:0.75");

    expect(result).toContain("overflow:hidden");
  });

  it.each([
    ["font family", { fontFamily: "Source Sans 3" }, 'font-family:"Source Sans 3"'],
    ["font size", { fontSize: 32 }, "font-size:32px"],
    ["font weight", { fontWeight: 600 }, "font-weight:600"],
    ["font style", { fontStyle: "italic" }, "font-style:italic"],
    ["text alignment", { textAlign: "justify" }, "text-align:justify"],
    ["line height", { lineHeight: 1.2 }, "line-height:1.2"],
    ["letter spacing", { letterSpacing: -1 }, "letter-spacing:-1px"],
  ] satisfies readonly [string, ElementStyle, string][])(
    "renders %s",
    (_name, style, expected) => {
      expect(renderStyle(style)).toContain(expected);
    },
  );

  it("renders numeric line height without a length unit", () => {
    const result = renderStyle({
      lineHeight: 1.5,
    });

    expect(result).toContain("line-height:1.5");
    expect(result).not.toContain("line-height:1.5px");
  });

  it.each([
    ["none transform", { textTransform: "none" }, "text-transform:none"],
    ["uppercase transform", { textTransform: "uppercase" }, "text-transform:uppercase"],
    ["lowercase transform", { textTransform: "lowercase" }, "text-transform:lowercase"],
    ["capitalize transform", { textTransform: "capitalize" }, "text-transform:capitalize"],
    ["normal whitespace", { whiteSpace: "normal" }, "white-space:normal"],
    ["nowrap whitespace", { whiteSpace: "nowrap" }, "white-space:nowrap"],
    ["pre-line whitespace", { whiteSpace: "pre-line" }, "white-space:pre-line"],
    ["pre-wrap whitespace", { whiteSpace: "pre-wrap" }, "white-space:pre-wrap"],
    ["auto text-wrap-style", { textWrapStyle: "auto" }, "text-wrap-style:auto"],
    ["balance text-wrap-style", { textWrapStyle: "balance" }, "text-wrap-style:balance"],
    ["pretty text-wrap-style", { textWrapStyle: "pretty" }, "text-wrap-style:pretty"],
    ["normal overflow-wrap", { overflowWrap: "normal" }, "overflow-wrap:normal"],
    ["break-word overflow-wrap", { overflowWrap: "break-word" }, "overflow-wrap:break-word"],
    ["anywhere overflow-wrap", { overflowWrap: "anywhere" }, "overflow-wrap:anywhere"],
    ["underline decoration", { textDecorationLine: "underline" }, "text-decoration-line:underline"],
    ["overline decoration", { textDecorationLine: "overline" }, "text-decoration-line:overline"],
    ["line-through decoration", { textDecorationLine: "line-through" }, "text-decoration-line:line-through"],
    ["decoration color", { textDecorationColor: "#f8fafc" }, "text-decoration-color:#f8fafc"],
  ] satisfies readonly [string, ElementStyle, string][])(
    "renders %s",
    (_name, style, expected) => {
      expect(renderStyle(style)).toContain(expected);
    },
  );

  it("renders a combined text-capability style", () => {
    const result = renderStyle({
      textTransform: "uppercase",
      whiteSpace: "pre-wrap",
      textWrapStyle: "balance",
      overflowWrap: "break-word",
      textDecorationLine: "underline",
    });

    expect(result).toBe(
      "text-transform:uppercase;white-space:pre-wrap;text-wrap-style:balance;" +
        "overflow-wrap:break-word;text-decoration-line:underline",
    );
  });

  it("keeps white-space and text-wrap-style independent", () => {
    const result = renderStyle({
      whiteSpace: "nowrap",
      textWrapStyle: "balance",
    });

    expect(result).toContain("white-space:nowrap");
    expect(result).toContain("text-wrap-style:balance");
    expect(result).not.toContain("text-wrap:balance");
  });

  it("does not emit the text-wrap shorthand", () => {
    const result = renderStyle({
      textWrapStyle: "pretty",
    });

    expect(result).toContain("text-wrap-style:pretty");
    expect(result).not.toMatch(/text-wrap:/);
  });

  it("does not emit text-capability declarations when undefined", () => {
    const result = renderStyle({});

    expect(result).not.toContain("text-transform");
    expect(result).not.toContain("white-space");
    expect(result).not.toContain("text-wrap-style");
    expect(result).not.toContain("overflow-wrap");
    expect(result).not.toContain("text-decoration-line");
  });

  it("renders combined typography overrides", () => {
    const result = renderStyle({
      fontFamily: "Inter",
      fontSize: 48,
      fontWeight: 600,
      fontStyle: "italic",
      textAlign: "center",
      lineHeight: 1.3,
      letterSpacing: 1,
      textDecorationColor: "#f8fafc",
    });

    expect(result).toBe(
      'font-family:"Inter";font-size:48px;font-weight:600;font-style:italic;' +
        "text-align:center;line-height:1.3;letter-spacing:1px;" +
        "text-decoration-color:#f8fafc",
    );
  });

  it("escapes a font family as a CSS string", () => {
    const result = renderStyle({
      fontFamily: 'Family";color:red</style>',
    });

    expect(result).toBe(
      "font-family:\"Family\\22 ;color:red\\3c /style\\3e \"",
    );
    expect(result).not.toContain("</style>");
  });

  it("does not render alignment properties directly", () => {
    const result = renderStyle({
      horizontalAlign: "center",
      verticalAlign: "end",
    });

    expect(result).not.toContain("justify-content");

    expect(result).not.toContain("align-items");
  });

  it("renders a background gradient", () => {
    const result = renderStyle({
      backgroundGradient: {
        type: "linear",
        angle: 135,

        stops: [
          {
            color: "#111827",
            position: 0,
          },
          {
            color: "#312e81",
            position: 100,
          },
        ],
      },
    });

    expect(result).toContain(
      "background-image:linear-gradient(135deg,#111827 0%,#312e81 100%)",
    );

    expect(countOccurrences(result, "background-image:")).toBe(1);
  });

  it("renders a box shadow", () => {
    const result = renderStyle({
      shadow: {
        x: 0,
        y: 16,
        blur: 40,
        spread: -8,
        color: "rgba(0,0,0,0.4)",
      },
    });

    expect(result).toContain("box-shadow:0px 16px 40px -8px rgba(0,0,0,0.4)");

    expect(countOccurrences(result, "box-shadow:")).toBe(1);
  });

  it("renders a text stroke with numeric widths as pixels", () => {
    const result = renderStyle({
      textStroke: {
        width: 1,
        color: "#0f172a",
      },
    });

    expect(result).toContain("-webkit-text-stroke:1px #0f172a");
  });

  it("does not render a text stroke when undefined", () => {
    const result = renderStyle({ textStroke: undefined });

    expect(result).not.toContain("text-stroke:");
  });

  it("renders text stroke together with a shadow", () => {
    const result = renderStyle({
      shadow: {
        x: 0,
        y: 4,
        blur: 12,
        color: "#000000",
      },
      textStroke: {
        width: "0.1em",
        color: "#f8fafc",
      },
    });

    expect(result).toContain("box-shadow:0px 4px 12px #000000");
    expect(result).toContain("-webkit-text-stroke:0.1em #f8fafc");
  });

  it("renders a border", () => {
    const result = renderStyle({
      border: {
        width: 2,
        style: "solid",
        color: "#fff",
      },
    });

    expect(result).toContain("border-width:2px");

    expect(result).toContain("border-style:solid");

    expect(result).toContain("border-color:#fff");

    expect(countOccurrences(result, "border-width:")).toBe(1);

    expect(countOccurrences(result, "border-style:")).toBe(1);

    expect(countOccurrences(result, "border-color:")).toBe(1);
  });

  it("renders a gradient border once", () => {
    const result = renderStyle({
      border: {
        width: 3,
        style: "dashed",
        gradient: {
          type: "linear",
          angle: 90,
          stops: [
            {
              color: "#7c3aed",
              position: 0,
            },
            {
              color: "#06b6d4",
              position: 100,
            },
          ],
        },
      },
    });

    expect(result).toContain(
      "border-image:linear-gradient(90deg,#7c3aed 0%,#06b6d4 100%) 1",
    );

    expect(countOccurrences(result, "border-width:")).toBe(1);

    expect(countOccurrences(result, "border-style:")).toBe(1);

    expect(countOccurrences(result, "border-color:")).toBe(1);

    expect(countOccurrences(result, "border-image:")).toBe(1);
  });
  // ============================================================
  // BEGIN: TESTE DE DIMENSÕES DO CONTAINER
  //
  // Garante que width e height estruturados são convertidos
  // corretamente para CSS.
  // ============================================================

  it("renders width and height", () => {
    const result = renderStyle({
      width: "72%",
      height: "60%",
    });

    expect(result).toContain("width:72%");

    expect(result).toContain("height:60%");
  });

  // ============================================================
  // END: TESTE DE DIMENSÕES DO CONTAINER
  // ============================================================

  // ============================================================
  // BEGIN: TESTE DE DIMENSÕES NUMÉRICAS
  //
  // Números são convertidos para px pelo renderLength().
  // ============================================================

  it("renders numeric dimensions as pixels", () => {
    const result = renderStyle({
      width: 640,
      height: 360,
    });

    expect(result).toContain("width:640px");

    expect(result).toContain("height:360px");
  });

  // ============================================================
  // END: TESTE DE DIMENSÕES NUMÉRICAS
  // ============================================================
});
