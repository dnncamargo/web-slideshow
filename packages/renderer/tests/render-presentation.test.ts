import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  Presentation,
} from "@powershow/document-schema";

import {
  renderPresentation,
} from "../src/render-presentation";

function createPresentation(): Presentation {
  return {
    schemaVersion: 1,
    id: "presentation-1",
    title: "PowerShow Demo",
    description: "",
    aspectRatio: "16:9",

    slides: [
      {
        id: "slide-1",
        title: "",
        summary: "",
        speakerNotes: "",

        elements: [
          {
            type: "text",
            id: "text-1",
            hidden: false,
            variant: "title",
            content: "First slide",
          },
        ],
      },

      {
        id: "slide-2",
        title: "",
        summary: "",
        speakerNotes: "",

        elements: [
          {
            type: "text",
            id: "text-2",
            hidden: false,
            variant: "body",
            content: "Second slide",
          },
        ],
      },
    ],
  };
}

describe("renderPresentation", () => {
  it("renders the presentation wrapper", () => {
    const html = renderPresentation(
      createPresentation(),
    );

    expect(html).toContain(
      'class="powershow-presentation"',
    );

    expect(html).toContain(
      'data-powershow-presentation-id="presentation-1"',
    );
  });

  it("renders schema version metadata", () => {
    const html = renderPresentation(
      createPresentation(),
    );

    expect(html).toContain(
      'data-powershow-schema-version="1"',
    );
  });

  it("renders aspect ratio metadata", () => {
    const html = renderPresentation(
      createPresentation(),
    );

    expect(html).toContain(
      'data-powershow-aspect-ratio="16:9"',
    );
  });

  it("renders every slide", () => {
    const html = renderPresentation(
      createPresentation(),
    );

    expect(html).toContain(
      'data-powershow-slide-id="slide-1"',
    );

    expect(html).toContain(
      'data-powershow-slide-id="slide-2"',
    );
  });

  it("preserves slide order", () => {
    const html = renderPresentation(
      createPresentation(),
    );

    const first =
      html.indexOf(
        'data-powershow-slide-id="slide-1"',
      );

    const second =
      html.indexOf(
        'data-powershow-slide-id="slide-2"',
      );

    expect(first).toBeGreaterThan(-1);
    expect(second).toBeGreaterThan(-1);
    expect(first).toBeLessThan(second);
  });

  it("renders slide contents", () => {
    const html = renderPresentation(
      createPresentation(),
    );

    expect(html).toContain(
      "First slide",
    );

    expect(html).toContain(
      "Second slide",
    );
  });

  it("renders an empty presentation", () => {
    const presentation =
      createPresentation();

    presentation.slides = [];

    const html =
      renderPresentation(
        presentation,
      );

    expect(html).toContain(
      'class="powershow-presentation"',
    );

    expect(html).not.toContain(
      'class="powershow-slide"',
    );
  });
});