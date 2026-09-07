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

  it("preserves ordinary iframe rendering when viewport is absent", () => {
    const html = renderEmbed(embed());

    expect(html.startsWith("<iframe")).toBe(true);
    expect(html).not.toContain("overflow:hidden");
    expect(html).toContain('data-powershow-id="embed-1"');
  });

  it("renders a PowerShow-owned clipped viewport when authored", () => {
    const html = renderEmbed(embed({ viewport: { zoom: 0.75 } }));

    expect(html.startsWith('<div class="powershow-element powershow-embed"')).toBe(true);
    expect(html).toContain("overflow:hidden");
    expect(html).toContain('data-powershow-id="embed-1"');
    expect(html).toContain('<iframe src="https://example.com/"');
    expect(html).not.toContain('data-powershow-id="embed-1" src=');
  });

  it("uses reciprocal internal dimensions for zoom below one", () => {
    const html = renderEmbed(embed({ viewport: { zoom: 0.75 } }));

    expect(html).toContain("width:calc(133.333333% + 0px)");
    expect(html).toContain("height:calc(133.333333% + 0px)");
    expect(html).toContain("transform:scale(0.75)");
    expect(html).toContain("transform-origin:top left");
  });

  it("offsets the internal page by top and left insets", () => {
    const html = renderEmbed(embed({ viewport: { top: 12, left: 24, zoom: 0.75 } }));

    expect(html).toContain("left:-18px");
    expect(html).toContain("top:-9px");
  });

  it("keeps direct offsets at zoom one", () => {
    const html = renderEmbed(embed({ viewport: { top: 12, left: 24, zoom: 1 } }));

    expect(html).toContain("left:-24px");
    expect(html).toContain("top:-12px");
  });

  it("scales offsets up when zoom is greater than one", () => {
    const html = renderEmbed(embed({ viewport: { top: 10, left: 40, zoom: 1.5 } }));

    expect(html).toContain("left:-60px");
    expect(html).toContain("top:-15px");
  });

  it("extends internal dimensions for right and bottom insets", () => {
    const html = renderEmbed(embed({ viewport: { right: 30, bottom: 40 } }));

    expect(html).toContain("width:calc(100% + 30px)");
    expect(html).toContain("height:calc(100% + 40px)");
  });

  it("composes all viewport values deterministically", () => {
    const html = renderEmbed(embed({ viewport: {
      zoom: 1.5,
      top: 10,
      right: 20,
      bottom: 30,
      left: 40,
    } }));

    expect(html).toContain("width:calc(66.666667% + 60px)");
    expect(html).toContain("height:calc(66.666667% + 40px)");
    expect(html).toContain("left:-60px");
    expect(html).toContain("top:-15px");
    expect(html).toContain("transform:scale(1.5)");
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

  it("emits the renderer-owned script and form sandbox permissions", () => {
    const html = renderEmbed(embed());

    expect(html).toContain('sandbox="allow-scripts allow-forms"');
  });

  it("does not grant same-origin capability", () => {
    expect(renderEmbed(embed())).not.toContain("allow-same-origin");
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

  it.each([
    "https://www.youtube.com/watch?v=video-id",
    "https://m.youtube.com/watch?v=video-id",
    "https://youtube.com/watch?v=video-id",
  ])("normalizes YouTube watch URL %s", (src) => {
    expect(renderEmbed(embed({ src }))).toContain(
      'src="https://www.youtube.com/embed/video-id"',
    );
  });

  it("normalizes a youtu.be short URL", () => {
    expect(renderEmbed(embed({ src: "https://youtu.be/video-id" }))).toContain(
      'src="https://www.youtube.com/embed/video-id"',
    );
  });

  it("leaves an existing YouTube embed URL unchanged", () => {
    const src = "https://www.youtube.com/embed/video-id";

    expect(renderEmbed(embed({ src }))).toContain(`src="${src}"`);
  });

  it("moves v into the embed path and preserves other query parameters", () => {
    const html = renderEmbed(
      embed({ src: "https://www.youtube.com/watch?v=video-id&start=30&rel=0" }),
    );

    expect(html).toContain(
      'src="https://www.youtube.com/embed/video-id?start=30&amp;rel=0"',
    );
    expect(html).not.toContain("v=video-id");
  });

  it("preserves youtu.be query parameters", () => {
    expect(
      renderEmbed(embed({ src: "https://youtu.be/video-id?start=30" })),
    ).toContain(
      'src="https://www.youtube.com/embed/video-id?start=30"',
    );
  });

  it.each([
    "https://example.com/embed/video",
    "https://www.youtube.com/watch",
    "https://www.youtube.com/watch?v=",
    "https://youtu.be/video-id/extra",
  ])("leaves unsupported or incomplete URL %s unchanged", (src) => {
    expect(renderEmbed(embed({ src }))).toContain(`src="${src}"`);
  });

  it("does not mutate the authored src", () => {
    const element = embed({
      src: "https://www.youtube.com/watch?v=video-id&start=30",
    });

    renderEmbed(element);

    expect(element.src).toBe("https://www.youtube.com/watch?v=video-id&start=30");
  });

  it("does not mutate the authored viewport", () => {
    const viewport = { zoom: 0.75, top: 12, right: 20, bottom: 8, left: 24 };
    const element = embed({ viewport });

    renderEmbed(element);

    expect(element.viewport).toEqual(viewport);
  });

  it("applies canonical surface namespaces", () => {
    const html = renderEmbed(
      embed({
        layout: {
          width: "80%",
          height: 400,
        },
        style: {
          background: { color: "#0f172a" },
          borderRadius: 8,
        },
        effect: {
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

  it("keeps canonical layout and effects on the outer viewport box", () => {
    const html = renderEmbed(embed({
      viewport: { zoom: 0.75 },
      layout: { width: 640, height: 360, position: "absolute", top: 10, right: 20, bottom: 30, left: 40 },
      style: { background: { color: "#0f172a" }, borderRadius: 8 },
      effect: { opacity: 0.9 },
    }));

    const outerEnd = html.indexOf(">", html.indexOf("<div"));
    const outerStyle = html.slice(html.indexOf('style="') + 7, html.indexOf('"', html.indexOf('style="') + 7));
    const iframeStyle = html.slice(html.indexOf('style="', outerEnd) + 7, html.indexOf('"', html.indexOf('style="', outerEnd) + 7));

    expect(outerStyle).toContain("width:640px");
    expect(outerStyle).toContain("position:absolute");
    expect(outerStyle).toContain("top:10px");
    expect(outerStyle).toContain("right:20px");
    expect(outerStyle).toContain("bottom:30px");
    expect(outerStyle).toContain("left:40px");
    expect(outerStyle).toContain("background:#0f172a");
    expect(outerStyle).toContain("border-radius:8px");
    expect(outerStyle).toContain("opacity:0.9");
    expect(iframeStyle).not.toContain("width:640px");
    expect(iframeStyle).toContain("border:0");
    expect(iframeStyle).toContain("transform:scale(0.75)");
  });

  it("keeps an authored outer border while removing the inner iframe border", () => {
    const html = renderEmbed(embed({
      viewport: { zoom: 0.75 },
      style: {
        border: {
          width: 2,
          style: "solid",
          color: "#ff0000",
        },
      },
    }));

    const outerEnd = html.indexOf(">", html.indexOf("<div"));
    const outerStyle = html.slice(html.indexOf('style="') + 7, html.indexOf('"', html.indexOf('style="') + 7));
    const iframeStyle = html.slice(html.indexOf('style="', outerEnd) + 7, html.indexOf('"', html.indexOf('style="', outerEnd) + 7));

    expect(outerStyle).toContain("border-width:2px");
    expect(outerStyle).toContain("border-style:solid");
    expect(outerStyle).toContain("border-color:#ff0000");
    expect(iframeStyle).toContain("border:0");
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
