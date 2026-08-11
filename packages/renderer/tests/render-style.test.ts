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

  it("renders combined typography overrides", () => {
    const result = renderStyle({
      fontSize: 48,
      fontWeight: 600,
      fontStyle: "italic",
      textAlign: "center",
      lineHeight: 1.3,
      letterSpacing: 1,
    });

    expect(result).toBe(
      "font-size:48px;font-weight:600;font-style:italic;" +
        "text-align:center;line-height:1.3;letter-spacing:1px",
    );
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
