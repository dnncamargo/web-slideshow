import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  Slide,
  SlideBackgroundPatternType,
} from "@powershow/document-schema";

import {
  renderSlide,
} from "../src/render-slide";

import {
  createSlide,
  createTextElement,
} from "./fixtures/render-fixtures";

describe("renderSlide", () => {
  it("renders separate background and content layers", () => {
    const slide: Slide = {
      id: "slide-1",
      title: "",
      summary: "",
      speakerNotes: "",
      elements: [
        {
          type: "text",
          id: "text-1",
          hidden: false,
          variant: "body",
          content: "PowerShow",
        },
      ],
      background: {
        color: "#101218",
      },
    };

    const html = renderSlide(slide);

    expect(html).toContain(
      'class="powershow-slide-background"',
    );

    expect(html).toContain(
      'class="powershow-slide-content"',
    );

    expect(html).toContain(
      "PowerShow",
    );
  });

  it("renders a background image", () => {
    const slide: Slide = {
      id: "slide-image",
      title: "",
      summary: "",
      speakerNotes: "",
      elements: [],
      background: {
        image:
          "/assets/background.jpg",
      },
    };

    const html = renderSlide(slide);

    expect(html).toContain(
      "powershow-slide-background-image",
    );

    expect(html).toContain(
      'src="/assets/background.jpg"',
    );

    expect(html).toContain(
      "object-fit:cover",
    );
  });

  it("renders a dots pattern", () => {
    const slide: Slide = {
      id: "slide-pattern",
      title: "",
      summary: "",
      speakerNotes: "",
      elements: [],
      background: {
        color: "#111",
        pattern: {
          type: "dots",
          color: "#444",
          size: 20,
        },
      },
    };

    const html = renderSlide(slide);

    expect(html).toContain(
      "powershow-slide-background-pattern",
    );

    expect(html).toContain(
      "radial-gradient",
    );

    expect(html).toContain(
      "background-size:20px 20px",
    );
  });

  it("keeps content outside the background layer", () => {
    const slide: Slide = {
      id: "slide-content",
      title: "",
      summary: "",
      speakerNotes: "",
      elements: [
        {
          type: "text",
          id: "text-1",
          hidden: false,
          variant: "body",
          content: "Independent content",
        },
      ],
      background: {
        pattern: {
          type: "grid",
        },
      },
    };

    const html = renderSlide(slide);

    const backgroundEnd =
      html.indexOf(
        "</div>",
        html.indexOf(
          'class="powershow-slide-background"',
        ),
      );

    const contentStart =
      html.indexOf(
        'class="powershow-slide-content"',
      );

    expect(backgroundEnd).toBeLessThan(
      contentStart,
    );
  });

  it.each([
    [
      "dots",
      "radial-gradient",
      "background-size:24px 24px",
    ],
    [
      "grid",
      "linear-gradient",
      "background-size:24px 24px",
    ],
    [
      "horizontal-lines",
      "linear-gradient",
      "background-size:100% 24px",
    ],
    [
      "vertical-lines",
      "linear-gradient(90deg",
      "background-size:24px 100%",
    ],
    [
      "diagonal-lines",
      "repeating-linear-gradient(45deg",
      "transparent 24px",
    ],
  ] satisfies ReadonlyArray<
    readonly [
      SlideBackgroundPatternType,
      string,
      string,
    ]
  >)(
    "renders the %s pattern with its default size",
    (type, gradient, defaultSize) => {
      const html = renderSlide(
        createSlide({
          background: {
            pattern: { type },
          },
        }),
      );

      expect(html).toContain(gradient);
      expect(html).toContain(defaultSize);
    },
  );

  it("renders a custom CSS pattern size", () => {
    const html = renderSlide(
      createSlide({
        background: {
          pattern: {
            type: "grid",
            size: "2.5rem",
          },
        },
      }),
    );

    expect(html).toContain(
      "background-size:2.5rem 2.5rem",
    );
  });

  it("renders pattern opacity and background color", () => {
    const html = renderSlide(
      createSlide({
        background: {
          pattern: {
            type: "dots",
            opacity: 0.35,
            backgroundColor: "#20242c",
          },
        },
      }),
    );

    expect(html).toContain("opacity:0.35");
    expect(html).toContain(
      "background-color:#20242c",
    );
  });

  it("renders the slide background color on the background layer", () => {
    const html = renderSlide(
      createSlide({
        background: {
          color: "#123456",
        },
      }),
    );

    const backgroundStart = html.indexOf(
      'class="powershow-slide-background"',
    );
    const contentStart = html.indexOf(
      'class="powershow-slide-content"',
    );
    const backgroundMarkup = html.slice(
      backgroundStart,
      contentStart,
    );

    expect(backgroundMarkup).toContain(
      "background-color:#123456",
    );
  });

  it("escapes the background image URL", () => {
    const html = renderSlide(
      createSlide({
        background: {
          image: '/background?theme=dark&label="hero"',
        },
      }),
    );

    expect(html).not.toContain(
      'src="/background?theme=dark&label="hero""',
    );
    expect(html).toContain(
      'src="/background?theme=dark&amp;label=&quot;hero&quot;"',
    );
  });

  it("does not generate navigation or control markup", () => {
    const html = renderSlide(
      createSlide({
        elements: [
          createTextElement({
            content: "Slide content",
          }),
        ],
      }),
    );

    expect(html).not.toMatch(/<(?:button|nav)\b/);
    expect(html).not.toContain("powershow-navigation");
    expect(html).not.toContain("powershow-controls");
    expect(html).not.toContain("aria-current");
  });
});
