// @vitest-environment jsdom

import { readFileSync } from "node:fs";

import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { renderElement } from "@powershow/renderer";

// Vitest runs with the Studio package directory as the working
// directory. jsdom overrides import.meta.url to a non-file scheme,
// so resolve the CSS contract source from the package root instead.
const editorWorkspaceCss = readFileSync(
  join(process.cwd(), "src/features/editor/editor-workspace.module.css"),
  "utf8",
);

const LINKED_CONTAINER_ATTRIBUTE =
  'data-powershow-container-link-surface="true"';

const LINKED_CONTAINER_SELECTOR =
  '[data-powershow-container-link-surface="true"]';

const SURFACE_STYLE = "position:absolute;inset:0;z-index:100";

function linkedContainerHtml(): string {
  return renderElement({
    type: "container",
    id: "container-1",
    hidden: false,
    direction: "column",
    children: [
      {
        type: "text",
        id: "child-text",
        hidden: false,
        variant: "body",
        content: "Child",
      },
    ],
    link: {
      kind: "url",
      href: "https://example.com",
    },
  });
}

describe("Studio authoring neutralization of the Container link surface", () => {
  it("renders the linked Container surface through the shared renderer", () => {
    const html = linkedContainerHtml();

    expect(html).toContain(LINKED_CONTAINER_ATTRIBUTE);
    expect(html).toContain(SURFACE_STYLE);
  });

  it("keeps the shared renderer surface pointer-capable by default", () => {
    const html = linkedContainerHtml();

    // The fixture has no other anchors, so the first <a> is the
    // Container link surface itself.
    const surfaceStart = html.indexOf("<a ");
    const surfaceEnd = html.indexOf("</a>", surfaceStart);
    const surfaceTag = html.slice(surfaceStart, surfaceEnd);

    // The renderer must not neutralize the surface inline: Player and
    // Watch rely on native anchor interaction with no pointer-events
    // suppression.
    expect(surfaceTag).toContain(LINKED_CONTAINER_ATTRIBUTE);
    expect(surfaceTag).not.toContain("pointer-events");
    expect(surfaceTag).toContain('href="https://example.com"');
  });

  it("neutralizes the surface only inside the Studio canvas via CSS", () => {
    const slideCanvasIndex = editorWorkspaceCss.indexOf(".slideCanvas");
    const markerIndex = editorWorkspaceCss.indexOf(LINKED_CONTAINER_SELECTOR);

    expect(slideCanvasIndex).toBeGreaterThanOrEqual(0);
    expect(markerIndex).toBeGreaterThan(slideCanvasIndex);

    const rule = editorWorkspaceCss.slice(markerIndex);

    expect(rule).toMatch(/pointer-events\s*:\s*none/);
  });
});
