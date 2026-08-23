import { describe, expect, it } from "vitest";

import type { ContainerElement } from "@powershow/document-schema";

import { renderElement } from "../src/render-element";

import {
  createContainerElement,
  createImageElement,
  createTextElement,
  createTextboxElement,
} from "./fixtures/render-fixtures";

const HTTPS_LINK = {
  kind: "url",
  href: "https://example.com/hero",
} as const;

function containerElement(
  overrides: Partial<Omit<ContainerElement, "type">> = {},
): ContainerElement {
  return {
    type: "container",
    id: "container-link",
    hidden: false,
    children: [],
    ...overrides,
  };
}

function containerTag(html: string): string {
  // The Container keeps its semantic root, so the first closing
  // angle bracket terminates the root opening tag.
  return html.slice(0, html.indexOf(">"));
}

function surfaceTag(html: string): string {
  const start = html.indexOf("<a ");

  return html.slice(start, html.indexOf(">", start));
}

function countOccurrences(value: string, search: string): number {
  return value.split(search).length - 1;
}

describe("renderElement linked Container support", () => {
  it("keeps the semantic Container root and adds an internal surface anchor", () => {
    const html = renderElement(
      containerElement({
        link: HTTPS_LINK,
      }),
    );

    expect(html).toMatch(/^<div /);
    expect(containerTag(html)).toContain('data-powershow-id="container-link"');
    expect(containerTag(html)).toContain('data-powershow-type="container"');

    expect(surfaceTag(html)).toContain(
      'data-powershow-container-link-surface="true"',
    );
    expect(surfaceTag(html)).toContain('data-powershow-link="true"');
  });

  it("renders the surface as the last child of the Container root", () => {
    const html = renderElement(
      containerElement({
        link: HTTPS_LINK,
        children: [createTextElement({ id: "child-text" })],
      }),
    );

    expect(html.indexOf("child-text")).toBeLessThan(
      html.indexOf('data-powershow-container-link-surface="true"'),
    );

    expect(html.endsWith('</a></div>')).toBe(true);
  });

  it("keeps the main/header/footer semantic root for linked role containers", () => {
    for (const role of ["main", "header", "footer"] as const) {
      const html = renderElement(
        containerElement({
          id: `container-${role}`,
          role,
          link: HTTPS_LINK,
        }),
      );

      expect(html).toMatch(new RegExp(`^<${role} `));
      expect(html.endsWith(`</a></${role}>`)).toBe(true);
    }
  });

  it("emits the canonical href on the surface", () => {
    const html = renderElement(
      containerElement({
        link: HTTPS_LINK,
      }),
    );

    expect(surfaceTag(html)).toContain('href="https://example.com/hero"');
  });

  it("escapes the surface href", () => {
    const html = renderElement(
      containerElement({
        link: {
          kind: "url",
          href: 'https://example.com/?a=1&b="quoted"',
        },
      }),
    );

    expect(surfaceTag(html)).toContain(
      'href="https://example.com/?a=1&amp;b=&quot;quoted&quot;"',
    );
  });

  it("emits target=_blank with rel=noopener noreferrer for a _blank link", () => {
    const html = renderElement(
      containerElement({
        link: {
          kind: "url",
          href: "https://example.com/hero",
          target: "_blank",
        },
      }),
    );

    const tag = surfaceTag(html);

    expect(tag).toContain('target="_blank"');
    expect(tag).toContain('rel="noopener noreferrer"');
  });

  it("emits target=_self without rel for a _self link", () => {
    const html = renderElement(
      containerElement({
        link: {
          kind: "url",
          href: "https://example.com/hero",
          target: "_self",
        },
      }),
    );

    const tag = surfaceTag(html);

    expect(tag).toContain('target="_self"');
    expect(tag).not.toContain('rel="noopener noreferrer"');
    expect(tag).not.toContain('target="_blank"');
  });

  it("does not emit a target or rel without an explicit target", () => {
    const tag = surfaceTag(
      renderElement(
        containerElement({
          link: HTTPS_LINK,
        }),
      ),
    );

    expect(tag).not.toContain("target=");
    expect(tag).not.toContain("rel=");
  });

  it("positions the surface as an absolute overlay over the whole box", () => {
    const tag = surfaceTag(
      renderElement(
        containerElement({
          link: HTTPS_LINK,
        }),
      ),
    );

    expect(tag).toContain("style=\"position:absolute;inset:0;z-index:100\"");
  });

  it("does not wrap the Container or its children in an outer anchor", () => {
    const html = renderElement(
      containerElement({
        link: HTTPS_LINK,
        children: [
          createTextElement({ id: "child-text", content: "Child" }),
        ],
      }),
    );

    expect(countOccurrences(html, "<a ")).toBe(1);
    expect(html).not.toMatch(/^<a /);
  });
});

describe("linked Container containing block strategy", () => {
  it("adds position:relative to a normal flow linked Container", () => {
    const html = renderElement(
      containerElement({
        link: HTTPS_LINK,
      }),
    );

    expect(containerTag(html)).toContain("position:relative");
    expect(containerTag(html)).toContain("z-index:0");
  });

  it("preserves canonical absolute placement as the containing block", () => {
    const html = renderElement(
      containerElement({
        link: HTTPS_LINK,
        layout: { position: "absolute" },
      }),
    );

    const tag = containerTag(html);

    expect(tag).toContain("position:absolute");
    expect(tag).not.toContain("position:relative");
    expect(tag).toContain("z-index:0");
  });

  it("preserves an explicit canonical position:absolute style", () => {
    const html = renderElement(
      containerElement({
        link: HTTPS_LINK,
        layout: { position: "absolute", top: 12, left: 24 },
      }),
    );

    const tag = containerTag(html);

    expect(tag).toContain("position:absolute");
    expect(tag).not.toContain("position:relative");
  });

  it("does not duplicate position:relative when the Container already hosts an absolute child", () => {
    const html = renderElement(
      containerElement({
        link: HTTPS_LINK,
        children: [
          createTextElement({
            id: "floating-text",
            style: {
              placement: { mode: "absolute" },
            },
          }),
        ],
      }),
    );

    const tag = containerTag(html);

    expect(countOccurrences(tag, "position:relative")).toBe(1);
    expect(tag).toContain("z-index:0");
  });

  it("keeps the absolute child's own placement inside the linked Container", () => {
    const html = renderElement(
      containerElement({
        link: HTTPS_LINK,
        children: [
          createTextElement({
            id: "floating-text",
            style: {
              placement: { mode: "absolute", anchor: "top-left" },
            },
          }),
        ],
      }),
    );

    expect(html).toContain('data-powershow-id="floating-text"');
    expect(html).toContain("position:absolute");
  });

  it("renders a linked stack Container as grid with the overlay outside the grid", () => {
    const html = renderElement(
      containerElement({
        layout: { children: { mode: "stack" } },
        link: HTTPS_LINK,
        children: [createTextElement({ id: "stack-child" })],
      }),
    );

    const tag = containerTag(html);

    expect(tag).toContain("display:grid");
    expect(tag).toContain("position:relative");
    expect(tag).toContain("z-index:0");

    // The surface is absolute, so it must not consume a grid cell.
    expect(html).toContain('style="grid-area:1 / 1"');
  });

  it("renders a linked row flow Container with flex layout intact", () => {
    const html = renderElement(
      containerElement({
        layout: { children: { direction: "row" } },
        link: HTTPS_LINK,
        children: [createTextElement({ id: "row-child" })],
      }),
    );

    const tag = containerTag(html);

    expect(tag).toContain("display:flex");
    expect(tag).toContain("flex-direction:row");
    expect(tag).toContain("position:relative");
    expect(tag).toContain("z-index:0");
  });
});

describe("unlinked Container byte compatibility", () => {
  it("emits no surface, marker or link attributes for an unlinked Container", () => {
    const html = renderElement(
      containerElement({
        children: [createTextElement({ id: "plain-child" })],
      }),
    );

    expect(html).not.toContain("<a ");
    expect(html).not.toContain("data-powershow-link");
    expect(html).not.toContain("data-powershow-container-link-surface");
    expect(html).not.toContain("z-index:");
    expect(html).not.toContain("position:relative");
  });

  it("keeps the unlinked Container root attributes and children unchanged", () => {
    const html = renderElement(
      containerElement({
        id: "plain-container",
        role: "main",
        layout: { children: { direction: "row" } },
        children: [createTextElement({ id: "plain-child", content: "Hi" })],
      }),
    );

    expect(html).toMatch(/^<main /);
    expect(html).toContain(
      'class="powershow-element powershow-container powershow-container-main"',
    );
    expect(html).toContain('data-powershow-id="plain-container"');
    expect(html).toContain('data-powershow-type="container"');
    expect(html).toContain('data-powershow-role="main"');
    expect(html).toContain("display:flex");
    expect(html).toContain("flex-direction:row");
    expect(html).toContain('data-powershow-id="plain-child"');
    expect(html).toContain("Hi");
  });
});

describe("nested linked Containers", () => {
  it("renders one outer surface for an outer linked Container with an unlinked inner Container", () => {
    const html = renderElement(
      containerElement({
        id: "outer",
        link: HTTPS_LINK,
        children: [
          createContainerElement({
            id: "inner-unlinked",
            children: [createTextElement({ id: "deep-text" })],
          }),
        ],
      }),
    );

    expect(countOccurrences(html, "data-powershow-container-link-surface")).toBe(
      1,
    );
    expect(countOccurrences(html, "data-powershow-link")).toBe(1);
    expect(html).toContain('data-powershow-id="inner-unlinked"');
    expect(html).toContain('data-powershow-id="deep-text"');
  });

  it("renders both surfaces for nested linked Containers without removing either", () => {
    const html = renderElement(
      containerElement({
        id: "outer",
        link: {
          kind: "url",
          href: "https://example.com/outer",
        },
        children: [
          createContainerElement({
            id: "inner-linked",
            link: {
              kind: "url",
              href: "https://example.com/inner",
            },
            children: [createTextElement({ id: "deep-text" })],
          }),
        ],
      }),
    );

    expect(countOccurrences(html, "data-powershow-container-link-surface")).toBe(
      2,
    );
    expect(countOccurrences(html, 'href="https://example.com/outer"')).toBe(1);
    expect(countOccurrences(html, 'href="https://example.com/inner"')).toBe(1);

    const outerTag = containerTag(html);

    expect(outerTag).toContain("z-index:0");

    // Outer wins pointer input: the outer root traps descendant layers
    // in its stacking context, and its own surface carries the
    // renderer-owned overlay z-index above everything nested inside.
    const outerSurfaceStart = html.indexOf(
      'data-powershow-container-link-surface="true"',
    );

    expect(outerSurfaceStart).toBeGreaterThan(
      html.indexOf('data-powershow-id="inner-linked"'),
    );
  });

  it("keeps descendant linked Image and Text anchors inside a linked Container", () => {
    const html = renderElement(
      containerElement({
        id: "outer",
        link: HTTPS_LINK,
        children: [
          createImageElement({
            id: "child-image",
            link: {
              kind: "url",
              href: "https://example.com/image",
            },
          }),
          createTextElement({
            id: "child-text",
            content: "Linked text",
            link: {
              kind: "url",
              href: "https://example.com/text",
            },
          }),
        ],
      }),
    );

    // Descendant native anchors stay present with their own hrefs.
    expect(countOccurrences(html, 'href="https://example.com/image"')).toBe(1);
    expect(countOccurrences(html, 'href="https://example.com/text"')).toBe(1);

    expect(html).toContain('class="powershow-element powershow-image"');
    expect(html).toContain('data-powershow-link="true"');

    // The outer surface is rendered after the descendants, so it stays
    // the top pointer surface for the whole outer box.
    const outerSurfaceStart = html.indexOf(
      'data-powershow-container-link-surface="true"',
    );

    expect(outerSurfaceStart).toBeGreaterThan(
      html.indexOf('data-powershow-id="child-image"'),
    );

    expect(outerSurfaceStart).toBeGreaterThan(
      html.indexOf('data-powershow-id="child-text"'),
    );
  });

  it("renders a linked Textbox descendant with its own anchor preserved", () => {
    const html = renderElement(
      containerElement({
        id: "outer",
        link: HTTPS_LINK,
        children: [
          createTextboxElement({
            id: "child-textbox",
            content: "Boxed",
            link: {
              kind: "url",
              href: "http://example.com/textbox",
            },
          }),
        ],
      }),
    );

    expect(countOccurrences(html, 'href="http://example.com/textbox"')).toBe(1);
    expect(html).toContain('data-powershow-id="child-textbox"');
  });
});

describe("linked Container edge cases", () => {
  it("renders hidden linked Containers as an empty string", () => {
    const html = renderElement(
      containerElement({
        hidden: true,
        link: HTTPS_LINK,
      }),
    );

    expect(html).toBe("");
  });

  it("keeps the custom class on the linked Container root", () => {
    const html = renderElement(
      containerElement({
        link: HTTPS_LINK,
        style: {
          className: "hero-surface",
        },
      }),
    );

    expect(containerTag(html)).toContain("hero-surface");
  });
});
