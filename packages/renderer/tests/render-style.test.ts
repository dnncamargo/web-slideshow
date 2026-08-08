import { describe, expect, it } from "vitest";

import { renderStyle } from "../src/render-style";

import { renderLength } from "../src//render-length";

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
  });
});
