import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  Slide,
} from "@powershow/document-schema";

import {
  renderSlide,
} from "../src/render-slide";

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
});