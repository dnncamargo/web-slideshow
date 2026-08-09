import {
  describe,
  expect,
  it,
} from "vitest";

import {
  renderBorder,
  renderGradient,
  renderShadow,
} from "../src/render-visual";

describe("renderGradient", () => {
  it("renders a linear gradient", () => {
    expect(
      renderGradient({
        type: "linear",
        angle: 135,

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
      }),
    ).toBe(
      "linear-gradient(135deg,#7c3aed 0%,#06b6d4 100%)",
    );
  });

  it("uses 180 degrees by default", () => {
    expect(
      renderGradient({
        type: "linear",

        stops: [
          {
            color: "#000",
            position: 0,
          },
          {
            color: "#fff",
            position: 100,
          },
        ],
      }),
    ).toBe(
      "linear-gradient(180deg,#000 0%,#fff 100%)",
    );
  });

  it("renders a radial gradient", () => {
    expect(
      renderGradient({
        type: "radial",
        shape: "circle",

        stops: [
          {
            color: "#fff",
            position: 0,
          },
          {
            color: "#000",
            position: 100,
          },
        ],
      }),
    ).toBe(
      "radial-gradient(circle,#fff 0%,#000 100%)",
    );
  });
});

describe("renderShadow", () => {
  it("renders a regular shadow", () => {
    expect(
      renderShadow({
        x: 0,
        y: 16,
        blur: 40,
        spread: -8,
        color: "rgba(0,0,0,0.4)",
      }),
    ).toBe(
      "0px 16px 40px -8px rgba(0,0,0,0.4)",
    );
  });

  it("renders an inset shadow", () => {
    expect(
      renderShadow({
        x: 0,
        y: 2,
        blur: 8,
        color: "#000",
        inset: true,
      }),
    ).toBe(
      "inset 0px 2px 8px #000",
    );
  });
});

describe("renderBorder", () => {
  it("renders a color border", () => {
    expect(
      renderBorder({
        width: 2,
        style: "solid",
        color: "#fff",
      }),
    ).toEqual([
      "border-width:2px",
      "border-style:solid",
      "border-color:#fff",
    ]);
  });

  it("renders a gradient border", () => {
    expect(
      renderBorder({
        width: 3,

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
      }),
    ).toEqual([
      "border-width:3px",
      "border-style:solid",
      "border-color:transparent",
      "border-image:linear-gradient(90deg,#7c3aed 0%,#06b6d4 100%) 1",
    ]);
  });
});