// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { isAuthoredPowerShowLink } from "../src/features/editor/canvas-link-interception";

function createCanvas(html: string): HTMLDivElement {
  const canvas = document.createElement("div");

  canvas.innerHTML = html;

  return canvas;
}

// Mirrors the canvas onClick wiring in EditorWorkspace: the click
// handler attached to the canvas suppresses only authored links.
function createCanvasClickHandler() {
  return (event: MouseEvent) => {
    if (isAuthoredPowerShowLink(event.target)) {
      event.preventDefault();
    }
  };
}

describe("isAuthoredPowerShowLink", () => {
  it("recognizes a rendered authored PowerShow link", () => {
    const canvas = createCanvas(
      '<a href="https://example.com" data-powershow-link="true"' +
        ' style="color:inherit;text-decoration:inherit">PowerShow Link</a>',
    );

    const anchor = canvas.querySelector("a");

    expect(anchor).not.toBeNull();
    expect(isAuthoredPowerShowLink(anchor)).toBe(true);
  });

  it("recognizes activation inside a nested child of an authored link", () => {
    const canvas = createCanvas(
      '<a href="https://example.com" data-powershow-link="true">' +
        "<strong>Bold link text</strong></a>",
    );

    const strong = canvas.querySelector("strong");

    expect(strong).not.toBeNull();
    expect(isAuthoredPowerShowLink(strong)).toBe(true);
  });

  it("ignores plain anchors without the PowerShow marker", () => {
    const canvas = createCanvas('<a href="https://example.org">Plain</a>');

    const anchor = canvas.querySelector("a");

    expect(anchor).not.toBeNull();
    expect(isAuthoredPowerShowLink(anchor)).toBe(false);
  });

  it("ignores non-link canvas content", () => {
    const canvas = createCanvas("<div><button>Select me</button></div>");

    const button = canvas.querySelector("button");
    const div = canvas.querySelector("div");

    expect(isAuthoredPowerShowLink(button)).toBe(false);
    expect(isAuthoredPowerShowLink(div)).toBe(false);
  });

  it("ignores null or undefined targets", () => {
    expect(isAuthoredPowerShowLink(null)).toBe(false);
    expect(isAuthoredPowerShowLink(undefined)).toBe(false);
  });

  it("recognizes the linked Image renderer output through its anchor marker", () => {
    const canvas = createCanvas(
      '<a href="https://example.com" data-powershow-link="true"' +
        ' class="powershow-element powershow-image"' +
        ' data-powershow-id="image-1" data-powershow-type="image"' +
        ' style="color:inherit;text-decoration:inherit">' +
        '<img class="powershow-image-media" src="/assets/example.png"' +
        ' alt="Example image"></a>',
    );

    const anchor = canvas.querySelector("a");
    const media = canvas.querySelector<HTMLImageElement>(".powershow-image-media");

    expect(anchor).not.toBeNull();
    expect(media).not.toBeNull();

    expect(isAuthoredPowerShowLink(anchor)).toBe(true);
    expect(isAuthoredPowerShowLink(media)).toBe(true);
  });

  it("ignores an unlinked Image (plain img) in the canvas", () => {
    const canvas = createCanvas(
      '<img class="powershow-element powershow-image"' +
        ' data-powershow-id="image-1" data-powershow-type="image"' +
        ' src="/assets/example.png" alt="Example">',
    );

    const media = canvas.querySelector("img");

    expect(media).not.toBeNull();
    expect(isAuthoredPowerShowLink(media)).toBe(false);
  });
});

describe("canvas click interception", () => {
  it("prevents navigation when an authored link is clicked", () => {
    const canvas = createCanvas(
      '<a href="https://example.com" data-powershow-link="true">' +
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
      '<a href="https://example.com" data-powershow-link="true">' +
        '<img class="powershow-image-media" src="/assets/example.png"' +
        ' alt="Example"></a>',
    );

    const handleClick = createCanvasClickHandler();

    const click = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });

    canvas.addEventListener("click", handleClick);
    canvas
      .querySelector(".powershow-image-media")
      ?.dispatchEvent(click);

    expect(click.defaultPrevented).toBe(true);
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