import { describe, expect, it } from "vitest";

import type { BackgroundPattern } from "@powershow/document-schema";

import { renderElement } from "../src/render-element";

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
          backgroundPattern: {
            image: PATTERN_IMAGE,
            size: "24px 32px",
            position: "center top",
            repeat: "repeat-x",
          },
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

  it.each(
    ["repeat", "repeat-x", "repeat-y", "no-repeat", "space", "round"] as const,
  )(
    "renders repeat value %s",
    (repeat: PatternRepeat) => {
      const html = renderElement(
        createContainerElement({
          style: { backgroundPattern: { image: PATTERN_IMAGE, repeat } },
        }),
      );

      expect(html).toContain(`background-repeat:${repeat}`);
    },
  );

  it.each([0, 1])("renders pattern opacity %s independently", (opacity) => {
    const html = renderElement(
      createContainerElement({
        style: {
          opacity: 0.75,
          backgroundPattern: { image: PATTERN_IMAGE, opacity },
        },
      }),
    );

    expect(html).toContain(`opacity:${opacity}`);
    expect(rootTag(html)).toContain("opacity:0.75");
    expect(html.match(/opacity:/g)).toHaveLength(2);
  });

  it("does not emit pattern opacity when it is absent", () => {
    const html = renderElement(
      createContainerElement({
        style: { backgroundPattern: { image: PATTERN_IMAGE } },
      }),
    );

    expect(html).not.toContain("opacity:");
  });

  it("keeps the base background and gradient on the Container", () => {
    const html = renderElement(
      createContainerElement({
        style: {
          background: "#0f172a",
          backgroundGradient: {
            type: "linear",
            angle: 135,
            stops: [
              { color: "#111827", position: 0 },
              { color: "#312e81", position: 100 },
            ],
          },
          backgroundPattern: { image: PATTERN_IMAGE },
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
        layoutMode: "stack",
        children: [createTextElement({ id: "content" })],
        style: { backgroundPattern: { image: PATTERN_IMAGE } },
      }),
    );

    expect(rootTag(html)).toContain("display:grid");
    expect(html).toContain('data-powershow-id="content"');
    expect(html).toContain('style="position:absolute;inset:0;z-index:-1');
    expect(html).not.toContain(
      'powershow-container-background-pattern" style="grid-area:',
    );
  });

  it("preserves flow, nested, border, and linked Container behavior", () => {
    const html = renderElement(
      createContainerElement({
        id: "outer",
        direction: "row",
        link: { kind: "url", href: "https://example.com" },
        style: {
          borderRadius: 16,
          border: { width: 2, color: "#fff" },
          backgroundPattern: { image: PATTERN_IMAGE },
        },
        children: [
          createContainerElement({
            id: "inner",
            style: { backgroundPattern: { image: PATTERN_IMAGE } },
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
    expect(html).toContain('data-powershow-id="inner"');
    expect(html).toContain('data-powershow-id="content"');
    expect(html).toContain('data-powershow-container-link-surface="true"');
    expect(html).toContain("z-index:100");
    expect(html.indexOf("z-index:100")).toBeGreaterThan(
      html.indexOf("powershow-container-background-pattern"),
    );
  });

  it("keeps unpatterned Container output unchanged", () => {
    const html = renderElement(
      createContainerElement({
        direction: "row",
        children: [createTextElement({ content: "Content" })],
      }),
    );

    expect(html).toBe(
      '<div class="powershow-element powershow-container" data-powershow-id="container-fixture" data-powershow-type="container" style="display:flex;flex-direction:row"><p class="powershow-element powershow-text powershow-text-body" data-powershow-id="text-fixture" data-powershow-type="text">Content</p></div>',
    );
  });
});
