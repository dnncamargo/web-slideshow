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

import {
  createPresentation as createPresentationFixture,
  createSlide,
  createTextElement,
} from "./fixtures/render-fixtures";

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

  it("scopes palette variables to each presentation root", () => {
    const first = renderPresentation({
      ...createPresentation(),
      palette: {
        colors: [{ id: "accent", name: "Accent", value: "#facc15" }],
      },
    });
    const second = renderPresentation({
      ...createPresentation(),
      id: "presentation-2",
      palette: {
        colors: [{ id: "accent", name: "Accent", value: "#ef4444" }],
      },
    });

    expect(first).toContain('style="--ps-palette-0061006300630065006e0074:#facc15"');
    expect(second).toContain('style="--ps-palette-0061006300630065006e0074:#ef4444"');
    expect(first).not.toContain("#ef4444");
    expect(second).not.toContain("#facc15");
  });

  it("does not add palette output when palette is absent or empty", () => {
    expect(renderPresentation(createPresentation()).startsWith(
      '<div class="powershow-presentation"',
    )).toBe(true);
    expect(renderPresentation(createPresentation()).slice(0, 100)).not.toContain(
      "--ps-palette-",
    );
    expect(
      renderPresentation({
        ...createPresentation(),
        palette: { colors: [] },
      }),
    ).not.toContain("--ps-palette-");
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

  it("emits presentation font resources once regardless of element usage", () => {
    const presentation = createPresentation();

    presentation.resources = {
      fonts: [
        {
          id: "inter",
          family: "Inter",
          source: {
            type: "url",
            url: "https://cdn.example.com/inter.woff2",
            format: "woff2",
          },
        },
      ],
    };
    presentation.slides[0]?.elements.push({
      type: "text",
      id: "text-extra",
      hidden: false,
      variant: "body",
      content: "Also Inter",
      typography: { fontFamily: "Inter" },
    });
    const firstElement = presentation.slides[0]?.elements[0];
    if (firstElement) {
      if (firstElement.type === "text") {
        firstElement.typography = { fontFamily: "Inter" };
      }
    }

    const html = renderPresentation(presentation);

    expect(html.split("@font-face").length - 1).toBe(1);
    expect(html.split("data-powershow-font-resources").length - 1).toBe(1);
    expect(html.split('font-family:"Inter"').length - 1).toBe(1);
    expect(html.split("font-family:&quot;Inter&quot;").length - 1).toBe(2);
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

  it("renders exactly one slide for a one-slide presentation", () => {
    const html = renderPresentation(
      createPresentationFixture({
        slides: [
          createSlide({ id: "only-slide" }),
        ],
      }),
    );

    expect(
      html.split("data-powershow-slide-id=").length - 1,
    ).toBe(1);
    expect(html).toContain(
      'data-powershow-slide-id="only-slide"',
    );
  });

  it("escapes presentation and slide metadata attributes", () => {
    const html = renderPresentation(
      createPresentationFixture({
        id: 'presentation"><script>',
        slides: [
          createSlide({
            id: 'slide"><img src=x>',
          }),
        ],
      }),
    );

    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x>");
    expect(html).toContain(
      'data-powershow-presentation-id="presentation&quot;&gt;&lt;script&gt;"',
    );
    expect(html).toContain(
      'data-powershow-slide-id="slide&quot;&gt;&lt;img src=x&gt;"',
    );
  });

  it("does not select an active slide", () => {
    const html = renderPresentation(
      createPresentationFixture({
        slides: [
          createSlide({ id: "first" }),
          createSlide({ id: "second" }),
        ],
      }),
    );

    expect(html).not.toContain("powershow-slide-active");
    expect(html).not.toContain("data-powershow-active");
    expect(html).not.toContain("aria-current");
  });

  it("does not generate presentation navigation controls", () => {
    const html = renderPresentation(
      createPresentationFixture({
        slides: [
          createSlide({
            elements: [
              createTextElement({
                content: "Presentation content",
              }),
            ],
          }),
        ],
      }),
    );

    expect(html).not.toMatch(/<(?:button|nav)\b/);
    expect(html).not.toContain("powershow-navigation");
    expect(html).not.toContain("powershow-controls");
  });
});
