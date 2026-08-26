import {
  describe,
  expect,
  it,
} from "vitest";

import {
  paletteColorCssVariableName,
  renderColorValue,
  renderPresentationPaletteVariables,
} from "../src";

describe("palette renderer helpers", () => {
  it("encodes ids deterministically using safe fixed-width hex code units", () => {
    const ids = [
      "accent;display:block",
      "accent:evil",
      '")} </style>',
      "áçúcar",
      "space value",
      "--strange",
    ];
    const names = ids.map(paletteColorCssVariableName);

    expect(names).toEqual(ids.map(paletteColorCssVariableName));
    expect(new Set(names).size).toBe(ids.length);
    expect(names).toEqual(names.map((name) => expect.stringMatching(/^--ps-palette-[0-9a-f]+$/)));
  });

  it("renders literal and referenced values", () => {
    expect(renderColorValue("#facc15")).toBe("#facc15");
    expect(renderColorValue({ kind: "palette", colorId: "accent" })).toBe(
      `var(${paletteColorCssVariableName("accent")})`,
    );
  });

  it("renders local palette declarations and leaves empty palettes empty", () => {
    const css = renderPresentationPaletteVariables({
      colors: [
        { id: "accent", name: "Accent", value: "#facc15" },
        { id: "accent;display:block", name: "Unsafe", value: "#ef4444" },
      ],
    });

    expect(css).toContain(`${paletteColorCssVariableName("accent")}:#facc15`);
    expect(css).toContain(`${paletteColorCssVariableName("accent;display:block")}:#ef4444`);
    expect(renderPresentationPaletteVariables({ colors: [] })).toBe("");
    expect(renderPresentationPaletteVariables(undefined)).toBe("");
  });
});
