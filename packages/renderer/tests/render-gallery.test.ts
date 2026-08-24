import { describe, expect, it } from "vitest";

import type {
  GalleryElement,
} from "@powershow/document-schema";

import { renderElement } from "../src/render-element";
import { renderGallery } from "../src/render-gallery";

function gallery(
  overrides: Partial<GalleryElement> = {},
): GalleryElement {
  return {
    id: "gallery-1",

    type: "gallery",

    hidden: false,

    fit: "contain",

    items: [
      { src: "/first.png", alt: "First" },
      { src: "/second.png", alt: "Second" },
    ],

    ...overrides,
  };
}

describe("renderGallery", () => {
  it("renders the root powershow-gallery class", () => {
    const html = renderGallery(gallery());

    expect(html).toContain("powershow-element");

    expect(html).toContain("powershow-gallery");
  });

  it("emits data-powershow-id", () => {
    const html = renderGallery(gallery());

    expect(html).toContain('data-powershow-id="gallery-1"');
  });

  it("emits data-powershow-type=gallery", () => {
    const html = renderGallery(gallery());

    expect(html).toContain('data-powershow-type="gallery"');
  });

  it("renders items in canonical array order", () => {
    const html = renderGallery(gallery());

    const first = html.indexOf('/first.png"');
    const second = html.indexOf('/second.png"');

    expect(first).toBeGreaterThan(-1);
    expect(second).toBeGreaterThan(first);
  });

  it("renders one item wrapper per item", () => {
    const html = renderGallery(gallery());

    const wrappers =
      html.match(/powershow-gallery-item/g);

    expect(wrappers?.length).toBe(2);
  });

  it("renders item img src and alt", () => {
    const html = renderGallery(
      gallery({ items: [{ src: "/photo.png", alt: "Photo" }] }),
    );

    expect(html).toContain("powershow-gallery-image");

    expect(html).toContain('src="/photo.png"');

    expect(html).toContain('alt="Photo"');
  });

  it("uses contain fit", () => {
    const html = renderGallery(gallery({ fit: "contain" }));

    expect(html).toContain("object-fit:contain");
  });

  it("uses cover fit", () => {
    const html = renderGallery(gallery({ fit: "cover" }));

    expect(html).toContain("object-fit:cover");
  });

  it("uses fill fit", () => {
    const html = renderGallery(gallery({ fit: "fill" }));

    expect(html).toContain("object-fit:fill");
  });

  it("emits native horizontal scroll-snap behavior", () => {
    const html = renderGallery(gallery());

    expect(html).toContain("display:flex");

    expect(html).toContain("overflow-x:auto");

    expect(html).toContain("overflow-y:hidden");

    expect(html).toContain("scroll-snap-type:x mandatory");

    expect(html).toContain("overscroll-behavior-inline:contain");
  });

  it("gives each item one carousel page snap point", () => {
    const html = renderGallery(gallery());

    expect(html).toContain("scroll-snap-align:start");

    expect(html).toContain("flex:0 0 100%");

    expect(html).toContain("min-width:100%");
  });

  it("escapes item src", () => {
    const html = renderGallery(
      gallery({
        items: [
          {
            src: 'https://example.com/image.png?a=1&b="quoted"',
            alt: "image",
          },
        ],
      }),
    );

    expect(html).toContain(
      'src="https://example.com/image.png?a=1&amp;b=&quot;quoted&quot;"',
    );
  });

  it("escapes item alt", () => {
    const html = renderGallery(
      gallery({
        items: [
          {
            src: "/image.png",
            alt: '<unsafe & "quoted">',
          },
        ],
      }),
    );

    expect(html).toContain(
      'alt="&lt;unsafe &amp; &quot;quoted&quot;&gt;"',
    );
  });

  it("applies canonical surface namespaces to the Gallery root", () => {
    const html = renderGallery(
      gallery({
        layout: {
          width: "80%",
          height: 400,
        },
        style: {
          background: { color: "#0f172a" },
          borderRadius: 8,
        },
        effect: { opacity: 0.9 },
      }),
    );

    expect(html).toContain("width:80%");

    expect(html).toContain("height:400px");

    expect(html).toContain("background:#0f172a");

    expect(html).toContain("border-radius:8px");

    expect(html).toContain("opacity:0.9");
  });

  it("preserves the authored custom className", () => {
    const html = renderGallery(
      gallery({
        style: { className: "hero-gallery" },
      }),
    );

    expect(html).toContain("hero-gallery");
  });

  it("renders nothing when hidden", () => {
    expect(renderGallery(gallery({ hidden: true }))).toBe("");
  });

  it("renders a valid empty root with no img for an empty Gallery", () => {
    const html = renderGallery(gallery({ items: [] }));

    expect(html).toContain("powershow-gallery");

    expect(html).toContain('data-powershow-type="gallery"');

    expect(html).toContain("display:flex");

    expect(html).not.toContain("powershow-gallery-image");

    expect(html).not.toContain("<img");
  });

  it("emits no Gallery script or runtime code", () => {
    const html = renderGallery(gallery());

    expect(html).not.toContain("<script");

    expect(html).not.toContain("script");

    expect(html).not.toContain("onclick");

    expect(html).not.toContain("addEventListener");
  });

  it("dispatches Gallery through renderElement", () => {
    const html = renderElement(gallery());

    expect(html).toContain("powershow-gallery");

    expect(html).toContain('data-powershow-type="gallery"');
  });
});
