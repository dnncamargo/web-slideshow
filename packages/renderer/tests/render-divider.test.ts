import { describe, expect, it } from "vitest";

import type {
  DividerElement,
} from "@powershow/document-schema";

import { renderDivider } from "../src/render-divider";

function divider(
  overrides: Partial<DividerElement> = {},
): DividerElement {
  return {
    id: "divider-1",

    type: "divider",

    hidden: false,

    orientation: "horizontal",

    ...overrides,
  };
}

describe("renderDivider", () => {
  it("renders horizontal semantic separator metadata", () => {
    const html = renderDivider(divider());

    expect(html).toContain("<div ");

    expect(html).toContain('role="separator"');

    expect(html).toContain('aria-orientation="horizontal"');

    expect(html).toContain("powershow-divider");

    expect(html).toContain("powershow-divider-horizontal");

    expect(html).toContain('data-powershow-id="divider-1"');

    expect(html).toContain('data-powershow-type="divider"');
  });

  it("renders vertical aria-orientation", () => {
    const html = renderDivider(divider({ orientation: "vertical" }));

    expect(html).toContain('aria-orientation="vertical"');

    expect(html).toContain("powershow-divider-vertical");
  });

  it("defaults horizontal geometry to 100% x 2px", () => {
    const html = renderDivider(divider());

    expect(html).toContain("width:100%");

    expect(html).toContain("height:2px");
  });

  it("defaults vertical geometry to 2px x 100%", () => {
    const html = renderDivider(divider({ orientation: "vertical" }));

    expect(html).toContain("width:2px");

    expect(html).toContain("height:100%");
  });

  it("lets explicit width, height and background override effective defaults", () => {
    const html = renderDivider(
      divider({
        style: {
          width: "40%",

          height: "6px",

          background: "#0ea5e9",
        },
      }),
    );

    expect(html).toContain("width:40%");

    expect(html).toContain("height:6px");

    expect(html).toContain("background:#0ea5e9");

    expect(html).not.toContain("background:currentColor");
  });

  it("uses a neutral inherited color fallback when no background is authored", () => {
    const html = renderDivider(divider());

    expect(html).toContain("background:currentColor");
  });

  it("renders nothing when hidden", () => {
    expect(renderDivider(divider({ hidden: true }))).toBe("");
  });
});