import { describe, expect, it } from "vitest";

import type { ImageElement } from "@powershow/document-schema";

import { renderElement } from "../src/render-element";

const HTTPS_LINK = {
  kind: "url",
  href: "https://example.com/photo",
} as const;

function imageElement(
  overrides: Partial<Omit<ImageElement, "type">> = {},
): ImageElement {
  return {
    type: "image",
    id: "image-link",
    hidden: false,
    src: "/assets/example.png",
    alt: "Example image",
    fit: "contain",
    ...overrides,
  };
}

function anchorTag(html: string): string {
  // The anchor is the PowerShow element root, so the first closing
  // angle bracket terminates its opening tag.
  const end = html.indexOf(">");

  return html.slice(0, end);
}

function mediaTag(html: string): string {
  const start = html.indexOf("<img");

  return html.slice(start, html.indexOf(">", start));
}

describe("renderElement linked Image support", () => {
  it("makes the anchor the PowerShow element root", () => {
    const html = renderElement(
      imageElement({
        link: HTTPS_LINK,
      }),
    );

    expect(html).toMatch(/^<a /);
    expect(html).toContain("</a>");
    expect(anchorTag(html)).not.toContain("<img");
  });

  it("keeps data-powershow-id and data-powershow-type on the root anchor", () => {
    const html = renderElement(
      imageElement({
        id: "image-hero",
        link: HTTPS_LINK,
      }),
    );

    expect(anchorTag(html)).toContain('data-powershow-id="image-hero"');
    expect(anchorTag(html)).toContain('data-powershow-type="image"');
  });

  it("keeps PowerShow classes and the custom class on the root anchor", () => {
    const html = renderElement(
      imageElement({
        link: HTTPS_LINK,

        style: {
          className: "hero-image",
        },
      }),
    );

    const tag = anchorTag(html);

    expect(tag).toContain(
      'class="powershow-element powershow-image hero-image"',
    );
  });

  it("nests the media img with src and alt", () => {
    const html = renderElement(
      imageElement({
        src: "/images/hero.png",
        alt: "Hero visual",
        link: HTTPS_LINK,
      }),
    );

    expect(mediaTag(html)).toContain('class="powershow-image-media"');
    expect(mediaTag(html)).toContain('src="/images/hero.png"');
    expect(mediaTag(html)).toContain('alt="Hero visual"');
  });

  it("marks the authored link with data-powershow-link=true", () => {
    const html = renderElement(
      imageElement({
        link: HTTPS_LINK,
      }),
    );

    expect(anchorTag(html)).toContain('data-powershow-link="true"');
  });

  it("emits the canonical href on the anchor", () => {
    const html = renderElement(
      imageElement({
        link: HTTPS_LINK,
      }),
    );

    expect(anchorTag(html)).toContain('href="https://example.com/photo"');
  });

  it("escapes the anchor href", () => {
    const html = renderElement(
      imageElement({
        link: {
          kind: "url",
          href: 'https://example.com/?a=1&b="quoted"',
        },
      }),
    );

    expect(anchorTag(html)).toContain(
      'href="https://example.com/?a=1&amp;b=&quot;quoted&quot;"',
    );
  });

  it("emits target=_blank with rel=noopener noreferrer for a _blank link", () => {
    const html = renderElement(
      imageElement({
        link: {
          kind: "url",
          href: "https://example.com/photo",
          target: "_blank",
        },
      }),
    );

    const tag = anchorTag(html);

    expect(tag).toContain('target="_blank"');
    expect(tag).toContain('rel="noopener noreferrer"');
  });

  it("does not emit the _blank rel for a _self link", () => {
    const html = renderElement(
      imageElement({
        link: {
          kind: "url",
          href: "https://example.com/photo",
          target: "_self",
        },
      }),
    );

    const tag = anchorTag(html);

    expect(tag).toContain('target="_self"');
    expect(tag).not.toContain('rel="noopener noreferrer"');
    expect(tag).not.toContain('target="_blank"');
  });

  it("does not emit a target or rel for a link without an explicit target", () => {
    const tag = anchorTag(
      renderElement(
        imageElement({
          link: HTTPS_LINK,
        }),
      ),
    );

    expect(tag).not.toContain("target=");
    expect(tag).not.toContain("rel=");
  });

  it("suppresses the browser link appearance on the surface anchor", () => {
    const html = renderElement(
      imageElement({
        link: HTTPS_LINK,
      }),
    );

    const anchor = anchorTag(html);

    expect(anchor).toContain("color:inherit");
    expect(anchor).toContain("text-decoration:inherit");
  });

  it("keeps object-fit and object-position media semantics on the img", () => {
    const html = renderElement(
      imageElement({
        fit: "cover",
        focalPoint: { x: 25, y: 75 },
        link: HTTPS_LINK,
      }),
    );

    expect(mediaTag(html)).toContain("object-fit:cover");
    expect(mediaTag(html)).toContain("object-position:25% 75%");
  });

  it("keeps the default focal point as 50% 50%", () => {
    const html = renderElement(
      imageElement({
        link: HTTPS_LINK,
      }),
    );

    expect(mediaTag(html)).toContain("object-position:50% 50%");
  });

  it("fills the root width when the canonical style defines width only", () => {
    const html = renderElement(
      imageElement({
        layout: {
          width: "60%",
        },
        link: HTTPS_LINK,
      }),
    );

    const media = mediaTag(html);
    const anchor = anchorTag(html);

    expect(anchor).toContain("width:60%");
    expect(media).toContain("width:100%");
    expect(media).not.toContain("height:100%");
  });

  it("fills the media height when the canonical style defines height only", () => {
    const html = renderElement(
      imageElement({
        layout: {
          height: 320,
        },
        link: HTTPS_LINK,
      }),
    );

    const media = mediaTag(html);
    const anchor = anchorTag(html);

    expect(anchor).toContain("height:320px");
    expect(media).toContain("height:100%");
    expect(media).not.toContain("width:100%");
  });

  it("fills both media dimensions when width and height are defined", () => {
    const html = renderElement(
      imageElement({
        layout: {
          width: "60%",
          height: 240,
        },
        link: HTTPS_LINK,
      }),
    );

    const media = mediaTag(html);

    expect(media).toContain("width:100%");
    expect(media).toContain("height:100%");
  });

  it("makes the linked Image root a dimension-capable inline surface", () => {
    const html = renderElement(
      imageElement({
        layout: {
          width: "60%",
          height: 240,
        },
        link: HTTPS_LINK,
      }),
    );

    const anchor = anchorTag(html);

    expect(anchor).toContain("display:inline-block");
    expect(anchor).toContain("width:60%");
    expect(anchor).toContain("height:240px");
  });

  it("preserves intrinsic media sizing when no dimensions are defined", () => {
    const html = renderElement(
      imageElement({
        link: HTTPS_LINK,
      }),
    );

    const media = mediaTag(html);

    expect(media).not.toContain("width:100%");
    expect(media).not.toContain("height:100%");
  });

  it("keeps placement properties on the PowerShow root, not the media", () => {
    const html = renderElement(
      imageElement({
        layout: {
          width: 300,
          position: "absolute",
          top: 12,
          left: 24,
        },
        link: HTTPS_LINK,
      }),
    );

    const anchor = anchorTag(html);
    const media = mediaTag(html);

    expect(anchor).toContain("position:absolute");
    expect(anchor).toContain("top:12px");
    expect(anchor).toContain("left:24px");

    expect(media).not.toContain("position:absolute");
    expect(media).not.toContain("top:");
    expect(media).not.toContain("left:");
  });

  it("keeps border, radius, shadow and opacity on the root and duplicates radius on the media", () => {
    const html = renderElement(
      imageElement({
        layout: {
          width: 300,
          height: 200,
        },
        style: {
          borderRadius: 16,
          border: {
            width: 2,
            style: "solid",
            color: "#ffffff",
          },
        },
        effect: {
          opacity: 0.8,
          shadow: {
            x: 0,
            y: 4,
            blur: 12,
            spread: 0,
            color: "rgba(0,0,0,0.5)",
          },
        },
        link: HTTPS_LINK,
      }),
    );

    const anchor = anchorTag(html);

    expect(anchor).toContain("border-radius:16px");
    expect(anchor).toContain("opacity:0.8");
    expect(anchor).toContain("border-width:2px");
    expect(anchor).toContain("border-color:#ffffff");
    expect(anchor).toContain("box-shadow:0px 4px 12px 0px rgba(0,0,0,0.5)");

    expect(mediaTag(html)).toContain("border-radius:16px");
    expect(mediaTag(html)).not.toContain("opacity:");
  });

  it("keeps the unlinked Image structure byte-compatible (no anchor)", () => {
    const html = renderElement(imageElement());

    expect(html).toMatch(/^<img /);
    expect(html).not.toContain("<a ");
    expect(html).not.toContain("data-powershow-link");
    expect(html).toContain('class="powershow-element powershow-image"');
    expect(html).toContain('data-powershow-id="image-link"');
    expect(html).toContain('data-powershow-type="image"');
    expect(html).toContain('src="/assets/example.png"');
    expect(html).toContain('alt="Example image"');
    expect(html).toContain("object-fit:contain");
  });

  it("renders hidden linked images as an empty string", () => {
    const html = renderElement(
      imageElement({
        hidden: true,
        link: HTTPS_LINK,
      }),
    );

    expect(html).toBe("");
  });
});
