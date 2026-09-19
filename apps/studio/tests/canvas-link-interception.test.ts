// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { isAuthoredPresentationLink } from "../src/features/editor/canvas-link-interception";

function createCanvas(html: string): HTMLDivElement {
  const canvas = document.createElement("div");

  canvas.innerHTML = html;

  return canvas;
}

// Mirrors the canvas onClick wiring in EditorWorkspace: the click
// handler attached to the canvas suppresses only authored links.
function createCanvasClickHandler() {
  return (event: MouseEvent) => {
    if (isAuthoredPresentationLink(event.target)) {
      event.preventDefault();
    }
  };
}

describe("isAuthoredPresentationLink", () => {
  it("recognizes a rendered authored presentation link", () => {
    const canvas = createCanvas(
      '<a href="https://example.com" data-presentation-link="true"' +
        ' style="color:inherit;text-decoration:inherit">Presentation Link</a>',
    );

    const anchor = canvas.querySelector("a");

    expect(anchor).not.toBeNull();
    expect(isAuthoredPresentationLink(anchor)).toBe(true);
  });

  it("recognizes activation inside a nested child of an authored link", () => {
    const canvas = createCanvas(
      '<a href="https://example.com" data-presentation-link="true">' +
        "<strong>Bold link text</strong></a>",
    );

    const strong = canvas.querySelector("strong");

    expect(strong).not.toBeNull();
    expect(isAuthoredPresentationLink(strong)).toBe(true);
  });

  it("ignores plain anchors without the presentation marker", () => {
    const canvas = createCanvas('<a href="https://example.org">Plain</a>');

    const anchor = canvas.querySelector("a");

    expect(anchor).not.toBeNull();
    expect(isAuthoredPresentationLink(anchor)).toBe(false);
  });

  it("ignores non-link canvas content", () => {
    const canvas = createCanvas("<div><button>Select me</button></div>");

    const button = canvas.querySelector("button");
    const div = canvas.querySelector("div");

    expect(isAuthoredPresentationLink(button)).toBe(false);
    expect(isAuthoredPresentationLink(div)).toBe(false);
  });

  it("ignores null or undefined targets", () => {
    expect(isAuthoredPresentationLink(null)).toBe(false);
    expect(isAuthoredPresentationLink(undefined)).toBe(false);
  });

  it("recognizes the linked Image renderer output through its anchor marker", () => {
    const canvas = createCanvas(
      '<a href="https://example.com" data-presentation-link="true"' +
        ' class="presentation-element presentation-image"' +
        ' data-presentation-id="image-1" data-presentation-type="image"' +
        ' style="color:inherit;text-decoration:inherit">' +
        '<img class="presentation-image-media" src="/assets/example.png"' +
        ' alt="Example image"></a>',
    );

    const anchor = canvas.querySelector("a");
    const media = canvas.querySelector<HTMLImageElement>(".presentation-image-media");

    expect(anchor).not.toBeNull();
    expect(media).not.toBeNull();

    expect(isAuthoredPresentationLink(anchor)).toBe(true);
    expect(isAuthoredPresentationLink(media)).toBe(true);
  });

  it("ignores an unlinked Image (plain img) in the canvas", () => {
    const canvas = createCanvas(
      '<img class="presentation-element presentation-image"' +
        ' data-presentation-id="image-1" data-presentation-type="image"' +
        ' src="/assets/example.png" alt="Example">',
    );

    const media = canvas.querySelector("img");

    expect(media).not.toBeNull();
    expect(isAuthoredPresentationLink(media)).toBe(false);
  });

  it("recognizes the linked Container surface through its renderer markers", () => {
    const canvas = createCanvas(
      '<div class="presentation-element presentation-container"' +
        ' data-presentation-id="container-1" data-presentation-type="container">' +
        '<p class="presentation-element presentation-text">Child</p>' +
        '<a href="https://example.com" data-presentation-link="true"' +
        ' data-presentation-container-link-surface="true"' +
        ' style="position:absolute;inset:0;z-index:100"></a>' +
        "</div>",
    );

    const surface = canvas.querySelector(
      '[data-presentation-container-link-surface="true"]',
    );
    const container = canvas.querySelector(
      '[data-presentation-id="container-1"]',
    );

    expect(surface).not.toBeNull();
    expect(container).not.toBeNull();

    expect(isAuthoredPresentationLink(surface)).toBe(true);

    // The surface is a sibling overlay, not a wrapper. The Container
    // root and ordinary children are not inside an authored anchor.
    expect(isAuthoredPresentationLink(container)).toBe(false);
  });

  it("ignores an unlinked Container (no overlay) in the canvas", () => {
    const canvas = createCanvas(
      '<div class="presentation-element presentation-container"' +
        ' data-presentation-id="container-1" data-presentation-type="container">' +
        "<p>Plain child</p>" +
        "</div>",
    );

    const container = canvas.querySelector(
      '[data-presentation-id="container-1"]',
    );
    const child = canvas.querySelector("p");

    expect(isAuthoredPresentationLink(container)).toBe(false);
    expect(isAuthoredPresentationLink(child)).toBe(false);
  });
});

describe("canvas click interception", () => {
  it("prevents navigation when an authored link is clicked", () => {
    const canvas = createCanvas(
      '<a href="https://example.com" data-presentation-link="true">' +
        "Go</a>",
    );

    const anchor = canvas.querySelector("a");

    expect(anchor).not.toBeNull();

    const handleClick = createCanvasClickHandler();

    const click = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });

    canvas.addEventListener("click", handleClick);
    anchor?.dispatchEvent(click);

    expect(click.defaultPrevented).toBe(true);
  });

  it("prevents navigation when the linked Image canvas surface is clicked", () => {
    const canvas = createCanvas(
      '<a href="https://example.com" data-presentation-link="true">' +
        '<img class="presentation-image-media" src="/assets/example.png"' +
        ' alt="Example"></a>',
    );

    const handleClick = createCanvasClickHandler();

    const click = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });

    canvas.addEventListener("click", handleClick);
    canvas
      .querySelector(".presentation-image-media")
      ?.dispatchEvent(click);

    expect(click.defaultPrevented).toBe(true);
  });

  it("prevents navigation when the linked Container surface is clicked", () => {
    const canvas = createCanvas(
      '<div class="presentation-element presentation-container"' +
        ' data-presentation-id="container-1" data-presentation-type="container">' +
        "<p>Child</p>" +
        '<a href="https://example.com" data-presentation-link="true"' +
        ' data-presentation-container-link-surface="true"' +
        ' style="position:absolute;inset:0;z-index:100"></a>' +
        "</div>",
    );

    const surface = canvas.querySelector(
      '[data-presentation-container-link-surface="true"]',
    );

    expect(surface).not.toBeNull();

    const handleClick = createCanvasClickHandler();

    const click = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });

    canvas.addEventListener("click", handleClick);
    surface?.dispatchEvent(click);

    expect(click.defaultPrevented).toBe(true);
  });

  it("does not suppress a click on a sibling child of a linked Container", () => {
    const canvas = createCanvas(
      '<div class="presentation-element presentation-container"' +
        ' data-presentation-id="container-1" data-presentation-type="container">' +
        '<img class="presentation-image-media" src="/assets/example.png"' +
        ' alt="Example">' +
        '<a href="https://example.com" data-presentation-link="true"' +
        ' data-presentation-container-link-surface="true"' +
        ' style="position:absolute;inset:0;z-index:100"></a>' +
        "</div>",
    );

    const handleClick = createCanvasClickHandler();

    const click = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });

    canvas.addEventListener("click", handleClick);

    // In authoring the overlay is pointer-events:none (Studio CSS), so
    // clicks land on the child itself, which is not inside an authored
    // anchor. The click must not be suppressed so selection keeps
    // working on descendants.
    canvas.querySelector(".presentation-image-media")?.dispatchEvent(click);

    expect(click.defaultPrevented).toBe(false);
  });

  it("does not block non-link canvas clicks", () => {
    const canvas = createCanvas(
      '<div class="box"><span>Content</span></div>',
    );

    const handleClick = createCanvasClickHandler();

    const click = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });

    canvas.addEventListener("click", handleClick);
    canvas.querySelector("span")?.dispatchEvent(click);

    expect(click.defaultPrevented).toBe(false);
  });

  it("does not block plain anchors without the marker", () => {
    const canvas = createCanvas('<a href="#plain">Plain</a>');

    const handleClick = createCanvasClickHandler();

    const click = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });

    canvas.addEventListener("click", handleClick);
    canvas.querySelector("a")?.dispatchEvent(click);

    expect(click.defaultPrevented).toBe(false);
  });
});
