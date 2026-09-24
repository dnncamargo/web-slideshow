import { describe, expect, it } from "vitest";

import type { BackgroundPattern } from "@web-slideshow/document-schema";

import { renderElement } from "../src/render-element";
import { renderBackgroundPattern } from "../src/render-background-pattern";

import {
  createContainerElement,
  createTextElement,
} from "./fixtures/render-fixtures";

const PATTERN_IMAGE =
  "linear-gradient(45deg, #111 25%, transparent 25%), radial-gradient(circle at 20% 30%, #fff 0 2px, transparent 3px)";

type PatternRepeat = NonNullable<BackgroundPattern["repeat"]>;

function rootTag(html: string): string {
  return html.slice(0, html.indexOf(">"));
}

describe("Container background patterns", () => {
  it("renders the canonical pattern properties on a dedicated visual layer", () => {
    const html = renderElement(
      createContainerElement({
        style: {
          background: { pattern: { image: PATTERN_IMAGE, size: "24px 32px", position: "center top", repeat: "repeat-x" } },
        },
      }),
    );

    expect(html).toContain(`background-image:${PATTERN_IMAGE}`);
    expect(html).toContain("background-size:24px 32px");
    expect(html).toContain("background-position:center top");
    expect(html).toContain("background-repeat:repeat-x");
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("pointer-events:none");
    expect(html).toContain("border-radius:inherit");
    expect(rootTag(html)).toContain("isolation:isolate");
    expect(rootTag(html)).toContain("position:relative");
    expect(html).toContain("z-index:-1");
  });

  it("renders controlled literal and Palette Pattern color variables in order", () => {
    const styles = renderBackgroundPattern({
      image: "linear-gradient(var(--presentation-pattern-color-1), var(--presentation-pattern-color-2))",
      colors: ["#111", { kind: "palette", colorId: "accent" }],
    });

    expect(styles).toBe(
      "--presentation-pattern-color-1:#111;" +
        "--presentation-pattern-color-2:var(--ps-palette-0061006300630065006e0074);" +
        "background-image:linear-gradient(var(--presentation-pattern-color-1), var(--presentation-pattern-color-2))",
    );
  });

  it("keeps zero rotation output identical to absent rotation", () => {
    const withoutRotation = renderElement(createContainerElement({
      style: { background: { pattern: { image: PATTERN_IMAGE } } },
    }));
    const withZeroRotation = renderElement(createContainerElement({
      style: { background: { pattern: { image: PATTERN_IMAGE, rotation: 0 } } },
    }));

    expect(withZeroRotation).toBe(withoutRotation);
    expect(withZeroRotation).not.toContain("presentation-container-background-pattern-paint");
  });

  it("rotates only an oversized renderer-owned Pattern paint inside a clipping surface", () => {
    const html = renderElement(createContainerElement({
      style: {
        borderRadius: 16,
        background: {
          pattern: {
            image: "linear-gradient(var(--presentation-pattern-color-1), transparent)",
            colors: ["#111"],
            rotation: 45,
          },
        },
      },
      children: [createTextElement({ id: "content" })],
    }));

    expect(rootTag(html)).not.toContain("overflow:hidden");
    expect(html).toContain('class="presentation-container-background-pattern"');
    expect(html).toContain("overflow:hidden");
    expect(html).toContain("inset:-100vmax");
    expect(html).toContain("transform:rotate(45deg)");
    expect(html).toContain("pointer-events:none");
    expect(html).toContain("border-radius:inherit");
    expect(html).toContain('data-presentation-id="content"');
    expect(html).not.toContain('data-presentation-type="container" style="overflow:hidden');
  });

  it.each(
    ["repeat", "repeat-x", "repeat-y", "no-repeat", "space", "round"] as const,
  )(
    "renders repeat value %s",
    (repeat: PatternRepeat) => {
      const html = renderElement(
        createContainerElement({
          style: { background: { pattern: { image: PATTERN_IMAGE, repeat } } },
        }),
      );

      expect(html).toContain(`background-repeat:${repeat}`);
    },
  );

  it.each(["repeat-x", "no-repeat"] as const)(
    "keeps legacy %s Patterns on the single visual layer without rotation",
    (repeat) => {
      const html = renderElement(
        createContainerElement({
          style: { background: { pattern: { image: PATTERN_IMAGE, repeat } } },
        }),
      );

      expect(html).toContain(`background-repeat:${repeat}`);
      expect(html).not.toContain("presentation-container-background-pattern-paint");
      expect(html).not.toContain("transform:rotate");
    },
  );

  it.each([0, 1])("renders pattern opacity %s independently", (opacity) => {
    const html = renderElement(
      createContainerElement({
        style: {
          background: { pattern: { image: PATTERN_IMAGE, opacity } },
        },
        effect: { opacity: 0.75 },
      }),
    );

    expect(html).toContain(`opacity:${opacity}`);
    expect(rootTag(html)).toContain("opacity:0.75");
    expect(html.match(/opacity:/g)).toHaveLength(2);
  });

  it("does not emit pattern opacity when it is absent", () => {
    const html = renderElement(
      createContainerElement({
        style: { background: { pattern: { image: PATTERN_IMAGE } } },
      }),
    );

    expect(html).not.toContain("opacity:");
  });

  it("keeps the base background and gradient on the Container", () => {
    const html = renderElement(
      createContainerElement({
        style: {
          background: { color: "#0f172a", gradient: {
            type: "linear",
            angle: 135,
            stops: [
              { color: "#111827", position: 0 },
              { color: "#312e81", position: 100 },
            ],
          }, pattern: { image: PATTERN_IMAGE } },
        },
      }),
    );

    const tag = rootTag(html);

    expect(tag).toContain("background:#0f172a");
    expect(tag).toContain(
      "background-image:linear-gradient(135deg,#111827 0%,#312e81 100%)",
    );
    expect(html).toContain(`background-image:${PATTERN_IMAGE}`);
  });

  it("does not make the pattern a flow or grid child", () => {
    const html = renderElement(
      createContainerElement({
        layout: { children: { mode: "stack" } },
        children: [createTextElement({ id: "content" })],
        style: { background: { pattern: { image: PATTERN_IMAGE } } },
      }),
    );

    expect(rootTag(html)).toContain("display:grid");
    expect(html).toContain('data-presentation-id="content"');
    expect(html).toContain('style="position:absolute;inset:0;z-index:-1');
    expect(html).not.toContain(
      'presentation-container-background-pattern" style="grid-area:',
    );
  });

  it("preserves flow, nested, border, and linked Container behavior", () => {
    const html = renderElement(
      createContainerElement({
        id: "outer",
        layout: { children: { direction: "row" } },
        link: { kind: "url", href: "https://example.com" },
        style: {
          borderRadius: 16,
          border: { width: 2, color: "#fff" },
          background: { pattern: { image: PATTERN_IMAGE } },
        },
        children: [
          createContainerElement({
            id: "inner",
            style: { background: { pattern: { image: PATTERN_IMAGE } } },
            children: [createTextElement({ id: "content" })],
          }),
        ],
      }),
    );

    const tag = rootTag(html);

    expect(tag).toContain("display:flex");
    expect(tag).toContain("flex-direction:row");
    expect(tag).toContain("border-radius:16px");
    expect(tag).toContain("border-width:2px");
    expect(tag).toContain("z-index:0");
    expect(html).toContain('data-presentation-id="inner"');
    expect(html).toContain('data-presentation-id="content"');
    expect(html).toContain('data-presentation-container-link-surface="true"');
    expect(html).toContain("z-index:100");
    expect(html.indexOf("z-index:100")).toBeGreaterThan(
      html.indexOf("presentation-container-background-pattern"),
    );
  });

  it("preserves linked Pattern colors and rotation through resolution", () => {
    const html = renderElement(
      createContainerElement({ linkedStyleId: "pattern-style" }),
      {
        presentation: {
          schemaVersion: 1,
          id: "presentation",
          title: "Presentation",
          description: "",
          aspectRatio: "16:9",
          linkedStyles: [{
            id: "pattern-style",
            name: "Pattern style",
            style: {
              background: {
                pattern: {
                  image: "linear-gradient(var(--presentation-pattern-color-1), transparent)",
                  colors: ["#111"],
                  rotation: -30,
                },
              },
            },
          }],
          slides: [],
        },
      },
    );

    expect(html).toContain("--presentation-pattern-color-1:#111");
    expect(html).toContain("transform:rotate(-30deg)");
  });

  it("keeps unpatterned Container output unchanged", () => {
    const html = renderElement(
      createContainerElement({
        layout: { children: { direction: "row" } },
        children: [createTextElement({ content: "Content" })],
      }),
    );

    expect(html).toBe(
      '<div class="presentation-element presentation-container" data-presentation-id="container-fixture" data-presentation-type="container" style="display:flex;flex-direction:row"><p class="presentation-element presentation-text presentation-text-body" data-presentation-id="text-fixture" data-presentation-type="text">Content</p></div>',
    );
  });
});
