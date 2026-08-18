import { describe, expect, it } from "vitest";

import type {
  ElementLink,
  TextElement,
  TextboxElement,
} from "@powershow/document-schema";

import { renderElement } from "../src/render-element";

const HTTPS_LINK: ElementLink = {
  kind: "url",
  href: "https://example.com",
};

function textElement(
  overrides: Partial<Omit<TextElement, "type" | "id" | "hidden">> = {},
): TextElement {
  return {
    type: "text",
    id: "link-text",
    hidden: false,
    variant: "body",
    content: "PowerShow Link",
    ...overrides,
  };
}

function textboxElement(
  overrides: Partial<Omit<TextboxElement, "type" | "id" | "hidden">> = {},
): TextboxElement {
  return {
    type: "textbox",
    id: "link-textbox",
    hidden: false,
    content: "PowerShow Link",
    ...overrides,
  };
}

describe("renderElement link support", () => {
  it.each([
    [
      "title",
      "<h1 ",
      "</h1>",
    ],
    [
      "subtitle",
      "<h2 ",
      "</h2>",
    ],
    [
      "body",
      "<p ",
      "</p>",
    ],
    [
      "caption",
      "<small ",
      "</small>",
    ],
  ] as const)(
    "preserves the %s semantic outer tag and nests the anchor inside it",
    (variant, openTag, closeTag) => {
      const html = renderElement(
        textElement({
          variant,
          content: "Linked title",
          link: HTTPS_LINK,
        }),
      );

      expect(html).toContain(openTag);
      expect(html).toContain(closeTag);

      const rootIndex = html.indexOf(openTag);
      const anchorIndex = html.indexOf("<a ");

      expect(rootIndex).toBeGreaterThanOrEqual(0);
      expect(anchorIndex).toBeGreaterThan(rootIndex);
      expect(html).toContain(`<a href="https://example.com"`);
    },
  );

  it("keeps the Textbox root as a div with the anchor nested inside", () => {
    const html = renderElement(
      textboxElement({
        content: "Box link",
        link: HTTPS_LINK,
      }),
    );

    const rootIndex = html.indexOf("<div ");
    const anchorIndex = html.indexOf("<a ");

    expect(rootIndex).toBeGreaterThanOrEqual(0);
    expect(anchorIndex).toBeGreaterThan(rootIndex);
    expect(html).toContain("</div>");
  });

  it("escapes the anchor href", () => {
    const html = renderElement(
      textElement({
        link: {
          kind: "url",
          href: 'https://example.com/?a=1&b="quoted"',
        },
      }),
    );

    expect(html).toContain(
      'href="https://example.com/?a=1&amp;b=&quot;quoted&quot;"',
    );

    expect(html).not.toContain('href="https://example.com/?a=1&b="quoted""');
  });

  it("emits target=_blank with rel=noopener noreferrer for a _blank link", () => {
    const html = renderElement(
      textElement({
        link: {
          kind: "url",
          href: "https://example.com",
          target: "_blank",
        },
      }),
    );

    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("does not emit the _blank rel for a _self link", () => {
    const html = renderElement(
      textboxElement({
        link: {
          kind: "url",
          href: "https://example.com",
          target: "_self",
        },
      }),
    );

    expect(html).toContain('target="_self"');

    expect(html).not.toContain('rel="noopener noreferrer"');
    expect(html).not.toContain('target="_blank"');
  });

  it("does not emit a target or rel for a link without an explicit target", () => {
    const html = renderElement(
      textElement({
        link: HTTPS_LINK,
      }),
    );

    expect(html).toContain("<a ");

    expect(html).not.toContain("target=");
    expect(html).not.toContain("rel=");
  });

  it.each([
    [
      "text",
      textElement(),
    ],
    [
      "textbox",
      textboxElement(),
    ],
  ] as const)(
    "renders %s without a link exactly as before (no anchor, no marker)",
    (_type, element) => {
      const html = renderElement(element);

      expect(html).not.toContain("<a ");
      expect(html).not.toContain("data-powershow-link");
      expect(html).toContain(">PowerShow Link</");
    },
  );

  it("keeps content escaped when wrapped in an anchor", () => {
    const html = renderElement(
      textElement({
        content: '<script>alert("PowerShow")</script>',
        link: HTTPS_LINK,
      }),
    );

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain('&lt;script&gt;alert(&quot;PowerShow&quot;)&lt;/script&gt;');
  });

  it("emits anchor appearance inheritance so links do not force browser styling", () => {
    const html = renderElement(
      textElement({
        link: HTTPS_LINK,
      }),
    );

    expect(html).toContain('style="color:inherit;text-decoration:inherit"');
  });

  it("marks authored links with data-powershow-link=true", () => {
    const html = renderElement(
      textboxElement({
        link: HTTPS_LINK,
      }),
    );

    expect(html).toContain('data-powershow-link="true"');
  });
});