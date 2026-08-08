import { describe, expect, it } from "vitest";

import {
  renderLength,
  renderStyle,
} from "../src/render-style";

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

    expect(result).toContain(
      "background:#000",
    );

    expect(result).toContain(
      "color:#fff",
    );

    expect(result).toContain(
      "border-radius:12px",
    );

    expect(result).toContain(
      "opacity:0.75",
    );

    expect(result).toContain(
      "overflow:hidden",
    );
  });

  it("does not render alignment properties directly", () => {
    const result = renderStyle({
      horizontalAlign: "center",
      verticalAlign: "end",
    });

    expect(result).not.toContain(
      "justify-content",
    );

    expect(result).not.toContain(
      "align-items",
    );
  });
});