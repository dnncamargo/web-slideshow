// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ImageElementSchema, type ImageElement, type PresentationFileResource } from "@web-slideshow/document-schema";

import { ImageInspector } from "../src/features/editor/inspector/image-inspector";
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

function directImage(): Extract<ImageElement, { src: string }> {
  return ImageElementSchema.parse({
    id: "image-1",
    type: "image",
    src: "/assets/example.png",
  }) as Extract<ImageElement, { src: string }>;
}

describe("ImageInspector source modes", () => {
  let container: HTMLDivElement;
  let root: Root;
  let elementState: ImageElement;

  function renderInspector(): void {
    root.render(
      <StudioI18nProvider>
        <ImageInspector
          element={elementState}
          presentationFiles={files}
          onUpdate={(update) => {
            const next = update(elementState);
            if (next.type === "image") {
              elementState = next;
              renderInspector();
            }
          }}
          preserveImageProportion={false}
          onPreserveImageProportionChange={() => {}}
          focalEditing={false}
          onFocalEditingChange={() => {}}
        />
      </StudioI18nProvider>,
    );
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    elementState = directImage();
  });

  afterEach(() => {
    root.unmount();
    document.body.innerHTML = "";
  });

  it("offers only raster binary Presentation Files", async () => {
    await act(async () => renderInspector());

    const options = Array.from(container.querySelectorAll<HTMLSelectElement>("#image-source-mode option"));
    expect(options.map((option) => option.value)).toEqual(["direct", "file-image"]);
  });

  it("selects a File without copying its URL into Image state", async () => {
    await act(async () => renderInspector());
    const select = container.querySelector<HTMLSelectElement>("#image-source-mode");
    if (!select) throw new Error("image source mode select not found");

    await act(async () => {
      select.value = "file-image";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(elementState).toMatchObject({ type: "image", fileResourceId: "file-image" });
    expect(elementState).not.toHaveProperty("src");
    expect(elementState).not.toHaveProperty("fileResourceUrl");
    expect(container.textContent).toContain("Raster image");
  });

  it("keeps direct URL editing and can return from File mode", async () => {
    await act(async () => renderInspector());
    const source = container.querySelector<HTMLTextAreaElement>("#image-src");
    if (!source) throw new Error("image source textarea not found");

    const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
    valueSetter?.call(source, "/assets/edited.png");
    await act(async () => source.dispatchEvent(new Event("input", { bubbles: true })));
    expect(elementState).toMatchObject({ src: "/assets/edited.png" });
    expect(ImageElementSchema.safeParse(elementState).success).toBe(true);

    const select = container.querySelector<HTMLSelectElement>("#image-source-mode");
    if (!select) throw new Error("image source mode select not found");
    await act(async () => {
      select.value = "file-image";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const resourceSelect = container.querySelector<HTMLSelectElement>("#image-source-mode");
    if (!resourceSelect) throw new Error("resource source mode select not found");
    await act(async () => {
      resourceSelect.value = "direct";
      resourceSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(elementState).toHaveProperty("src", "/instance-demo.svg");
    expect(elementState).not.toHaveProperty("fileResourceId");
    expect(ImageElementSchema.safeParse(elementState).success).toBe(true);
  });
});
