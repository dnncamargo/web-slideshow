// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ImageElementSchema, type ImageElement } from "@powershow/document-schema";

import { ImageInspector } from "../src/features/editor/inspector/image-inspector";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function imageElement(overrides: Partial<ImageElement> = {}): ImageElement {
  return {
    id: "image-1",
    type: "image",
    hidden: false,
    src: "/assets/example.png",
    alt: "Example image",
    fit: "contain",
    ...overrides,
  };
}

function changeInput(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("ImageInspector crop authoring", () => {
  let container: HTMLDivElement;
  let root: Root;
  let elementState: ImageElement;
  let updateCount: number;

  function renderInspector(): void {
    root.render(
      <StudioI18nProvider>
        <ImageInspector
          element={elementState}
          onUpdate={(update) => {
            const next = update(elementState);
            if (next.type === "image") {
              elementState = next;
              updateCount += 1;
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

  async function mount(element: ImageElement = imageElement()): Promise<void> {
    elementState = element;
    updateCount = 0;
    await act(async () => renderInspector());
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  it("shows effective full frame without writing on mount", async () => {
    await mount();

    expect(container.querySelector<HTMLInputElement>("#image-crop-x")?.value).toBe("0");
    expect(container.querySelector<HTMLInputElement>("#image-crop-y")?.value).toBe("0");
    expect(container.querySelector<HTMLInputElement>("#image-crop-width")?.value).toBe("100");
    expect(container.querySelector<HTMLInputElement>("#image-crop-height")?.value).toBe("100");
    const reset = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.includes("Reset crop"));
    expect(reset?.disabled).toBe(true);
    expect(updateCount).toBe(0);
    expect(elementState.crop).toBeUndefined();
  });

  it("writes valid canonical crop fields and preserves unrelated image state", async () => {
    const initial = imageElement({
      fit: "cover",
      focalPoint: { x: 25, y: 70 },
      layout: { position: "absolute", top: 10, left: 20, width: "50%", height: 240 },
      style: { borderRadius: 8 },
      effect: { opacity: 0.8 },
      link: { kind: "url", href: "https://example.com" },
    });
    await mount(initial);

    await act(async () => changeInput(container.querySelector<HTMLInputElement>("#image-crop-x")!, "10"));
    expect(elementState.crop).toEqual({ x: 10, y: 0, width: 90, height: 100 });
    expect(ImageElementSchema.safeParse(elementState).success).toBe(true);

    await act(async () => changeInput(container.querySelector<HTMLInputElement>("#image-crop-width")!, "60"));
    await act(async () => changeInput(container.querySelector<HTMLInputElement>("#image-crop-y")!, "20"));
    await act(async () => changeInput(container.querySelector<HTMLInputElement>("#image-crop-height")!, "50"));
    expect(elementState.crop).toEqual({ x: 10, y: 20, width: 60, height: 50 });
    expect(elementState).toMatchObject({ fit: "cover", focalPoint: { x: 25, y: 70 }, layout: initial.layout, style: initial.style, effect: initial.effect, link: initial.link });
    expect(elementState).not.toHaveProperty("style.crop");
    expect(elementState).not.toHaveProperty("layout.crop");
    expect(elementState).not.toHaveProperty("media.crop");
  });

  it("resets crop and preserves the rest of the Image element", async () => {
    const initial = imageElement({ crop: { x: 10, y: 20, width: 60, height: 50 }, fit: "cover", focalPoint: { x: 25, y: 70 } });
    await mount(initial);

    const reset = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.includes("Reset crop"));
    expect(reset?.disabled).toBe(false);

    await act(async () => reset?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(elementState.crop).toBeUndefined();
    expect(elementState).toMatchObject({ fit: "cover", focalPoint: { x: 25, y: 70 }, src: initial.src, alt: initial.alt });
  });

  it("collapses a crop returned exactly to full frame", async () => {
    await mount(imageElement({ crop: { x: 10, y: 0, width: 90, height: 100 } }));

    await act(async () => changeInput(container.querySelector<HTMLInputElement>("#image-crop-x")!, "0"));
    await act(async () => changeInput(container.querySelector<HTMLInputElement>("#image-crop-width")!, "100"));
    expect(elementState.crop).toBeUndefined();
    expect(ImageElementSchema.safeParse(elementState).success).toBe(true);
  });
});
