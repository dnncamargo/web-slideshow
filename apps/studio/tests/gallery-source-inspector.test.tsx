// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { GalleryElementSchema, type GalleryElement, type PresentationFileResource } from "@web-slideshow/document-schema";

import { GalleryInspector } from "../src/features/editor/inspector/gallery-inspector";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const files: PresentationFileResource[] = [
  {
    id: "file-image",
    name: "Raster image",
    kind: "image",
    representation: "binary",
    contentType: "image/png",
    source: { type: "url", url: "https://example.test/image.png" },
  },
  {
    id: "file-svg",
    name: "SVG image",
    kind: "image",
    representation: "text",
    contentType: "image/svg+xml",
    source: { type: "text", content: "<svg />" },
  },
  {
    id: "file-text",
    name: "Notes",
    kind: "text",
    representation: "text",
    contentType: "text/plain",
    source: { type: "text", content: "notes" },
  },
];

function directGallery(): GalleryElement {
  return GalleryElementSchema.parse({
    id: "gallery-1",
    type: "gallery",
    items: [{ src: "/direct.png", alt: "Direct" }],
  });
}

describe("GalleryInspector source modes", () => {
  let container: HTMLDivElement;
  let root: Root;
  let elementState: GalleryElement;

  function renderInspector(): void {
    root.render(
      <StudioI18nProvider>
        <GalleryInspector
          element={elementState}
          presentationFiles={files}
          selectedItemIndex={0}
          onSelectedItemIndexChange={() => {}}
          onUpdate={(update) => {
            const next = update(elementState);
            if (next.type === "gallery") {
              elementState = next;
              renderInspector();
            }
          }}
        />
      </StudioI18nProvider>,
    );
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    elementState = directGallery();
  });

  afterEach(() => {
    root.unmount();
    document.body.innerHTML = "";
  });

  it("offers only raster binary Files", async () => {
    await act(async () => renderInspector());

    const options = Array.from(container.querySelectorAll<HTMLSelectElement>("#gallery-gallery-1-item-0-source-mode option"));
    expect(options.map((option) => option.value)).toEqual(["direct", "file-image"]);
  });

  it("keeps direct URL editing available", async () => {
    await act(async () => renderInspector());
    const textarea = container.querySelector<HTMLTextAreaElement>("#gallery-gallery-1-item-0-src");
    if (!textarea) throw new Error("Gallery source textarea not found");

    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    if (!setter) throw new Error("expected HTMLTextAreaElement.value setter");
    await act(async () => {
      setter.call(textarea, "/edited-direct.png");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(elementState.items[0]).toMatchObject({ src: "/edited-direct.png" });
    expect(elementState.items[0]).not.toHaveProperty("fileResourceId");
  });

  it("selects a File without copying its URL and returns to a valid direct source", async () => {
    await act(async () => renderInspector());
    const select = container.querySelector<HTMLSelectElement>("#gallery-gallery-1-item-0-source-mode");
    if (!select) throw new Error("Gallery source mode select not found");

    await act(async () => {
      select.value = "file-image";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const resourceItem = elementState.items[0];
    expect(resourceItem).toMatchObject({ fileResourceId: "file-image" });
    expect(resourceItem).not.toHaveProperty("src");
    expect(container.querySelector<HTMLTextAreaElement>("#gallery-gallery-1-item-0-src")?.disabled).toBe(true);

    const resourceSelect = container.querySelector<HTMLSelectElement>("#gallery-gallery-1-item-0-source-mode");
    if (!resourceSelect) throw new Error("Gallery resource source mode select not found");
    await act(async () => {
      resourceSelect.value = "direct";
      resourceSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(elementState.items[0]).toMatchObject({ src: "/instance-demo.svg" });
    expect(elementState.items[0]).not.toHaveProperty("fileResourceId");
  });
});
