import { describe, expect, it } from "vitest";

import type {
  EmbedElement,
} from "@powershow/document-schema";

import { renderElement } from "../src/render-element";
import { renderEmbed } from "../src/render-embed";

function embed(
  overrides: Partial<EmbedElement> = {},
): EmbedElement {
  return {
    id: "embed-1",

    type: "embed",

    src: "https://example.com/",

    title: "Embedded content",

    hidden: false,

    ...overrides,
  };
}

describe("renderEmbed", () => {
  it("renders an iframe root", () => {
    expect(renderEmbed(embed())).toContain("<iframe");
  });

  it("renders the powershow-element class", () => {
    expect(renderEmbed(embed())).toContain("powershow-element");
  });

  it("renders the powershow-embed class", () => {
    expect(renderEmbed(embed())).toContain("powershow-embed");
  });

  it("emits data-powershow-id", () => {
    expect(renderEmbed(embed())).toContain('data-powershow-id="embed-1"');
  });

  it("emits data-powershow-type=embed", () => {
    expect(renderEmbed(embed())).toContain('data-powershow-type="embed"');
  });

  it("emits escaped src", () => {
    const html = renderEmbed(
      embed({ src: 'https://example.com/a?q=1&x="quoted"' }),
    );

    expect(html).toContain(
      'src="https://example.com/a?q=1&amp;x=&quot;quoted&quot;"',
    );
  });

  it("emits escaped title", () => {
    const html = renderEmbed(
      embed({ title: '<unsafe & "quoted">' }),
    );

    expect(html).toContain(
      'title="&lt;unsafe &amp; &quot;quoted&quot;&gt;"',
    );
  });

  it("emits exactly sandbox allow-scripts allow-forms allow-same-origin", () => {
    const html = renderEmbed(embed());

    expect(html).toContain('sandbox="allow-scripts allow-forms allow-same-origin"');
  });

  it("emits allow-same-origin", () => {
    expect(renderEmbed(embed())).toContain("allow-same-origin");
  });

  it("does not emit top-navigation sandbox permissions", () => {
    const html = renderEmbed(embed());

    expect(html).not.toContain("allow-top-navigation");

    expect(html).not.toContain("allow-top-navigation-by-user-activation");
  });

  it("does not emit popup sandbox permissions", () => {
    const html = renderEmbed(embed());

    expect(html).not.toContain("allow-popups");

    expect(html).not.toContain("allow-popups-to-escape-sandbox");
  });

  it("does not emit downloads or storage-access sandbox permissions", () => {
    const html = renderEmbed(embed());

    expect(html).not.toContain("allow-downloads");

    expect(html).not.toContain("allow-storage-access-by-user-activation");
  });

  it("emits allow fullscreen as the Permissions Policy", () => {
    expect(renderEmbed(embed())).toContain('allow="fullscreen"');
  });

  it("emits loading lazy", () => {
    expect(renderEmbed(embed())).toContain('loading="lazy"');
  });

  it("emits referrerpolicy strict-origin-when-cross-origin", () => {
    expect(renderEmbed(embed())).toContain(
      'referrerpolicy="strict-origin-when-cross-origin"',
    );
  });

  it("does not emit provider-specific behavior", () => {
    const html = renderEmbed(
      embed({ src: "https://example.com/embed/video" }),
    );

    expect(html).not.toContain("youtube");

    expect(html).not.toContain("youtu.be");

    expect(html).not.toContain("convertEmbed");

    expect(html).not.toContain("provider");
  });

  it("applies generic ElementStyle", () => {
    const html = renderEmbed(
      embed({
        style: {
          width: "80%",

          height: 400,

          background: "#0f172a",

          borderRadius: 8,

          opacity: 0.9,

          shadow: {
            x: 1,
            y: 2,
            blur: 4,
            color: "#000000",
          },
        },
      }),
    );

    expect(html).toContain("width:80%");

    expect(html).toContain("height:400px");

    expect(html).toContain("background:#0f172a");

    expect(html).toContain("border-radius:8px");

    expect(html).toContain("opacity:0.9");

    expect(html).toContain("box-shadow:");
  });

  it("preserves the authored custom className", () => {
    const html = renderEmbed(
      embed({ style: { className: "hero-embed" } }),
    );

    expect(html).toContain("hero-embed");
  });

  it("defaults the browser iframe border to zero when no canonical border is authored", () => {
    const html = renderEmbed(embed());

    expect(html).toContain("border:0");
  });

  it("does not override an authored canonical border with renderer border zero", () => {
    const html = renderEmbed(
      embed({
        style: {
          border: {
            width: 2,
            style: "solid",
            color: "#ff0000",
          },
        },
      }),
    );

    expect(html).toContain("border-width:2px");

    expect(html).toContain("border-style:solid");

    expect(html).toContain("border-color:#ff0000");

    expect(html).not.toContain("border:0");
  });

  it("renders nothing when hidden", () => {
    expect(renderEmbed(embed({ hidden: true }))).toBe("");
  });

  it("output contains no srcdoc", () => {
    expect(renderEmbed(embed())).not.toContain("srcdoc");
  });

  it("output contains no script or runtime injection", () => {
    const html = renderEmbed(
      embed({ src: "https://example.com/" }),
    );

    expect(html).not.toContain("<script");

    expect(html).not.toContain("javascript:");

    expect(html).not.toContain("onload");

    expect(html).not.toContain("onclick");
  });

  it("emits no sensitive Permissions Policy tokens", () => {
    const html = renderEmbed(embed());

    expect(html).not.toContain("camera");

    expect(html).not.toContain("microphone");

    expect(html).not.toContain("geolocation");
  });

  it("dispatches Embed through renderElement", () => {
    const html = renderElement(embed());

    expect(html).toContain("powershow-embed");

    expect(html).toContain('data-powershow-type="embed"');
  });
});