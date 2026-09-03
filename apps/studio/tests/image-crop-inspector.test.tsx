// @vitest-environment jsdom

import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ImageElementSchema, type ImageElement } from "@powershow/document-schema";

import { ImageInspector } from "../src/features/editor/inspector/image-inspector";
import {
  StudioI18nProvider,
  useStudioI18n,
} from "../src/features/i18n/studio-i18n-context";

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

function LocaleSetter({ locale }: { locale: "en" | "pt-BR" }): null {
  const { setLocale } = useStudioI18n();

  useEffect(() => {
    setLocale(locale);
  }, [locale, setLocale]);

  return null;
}

function cropInput(container: HTMLElement, field: string): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>(`#image-crop-${field}`);

  if (!input) {
    throw new Error(`crop input ${field} not found`);
  }

  return input;
}

function cropLabel(container: HTMLElement, field: string): string {
  return cropInput(container, field).closest("label")?.querySelector("span")?.textContent ?? "";
}

function resetCropButton(container: HTMLElement): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
    (candidate) => candidate.textContent?.includes("Reset crop") || candidate.textContent?.includes("Redefinir recorte"),
  );

  if (!button) {
    throw new Error("reset crop button not found");
  }

  return button;
}

describe("ImageInspector crop authoring", () => {
  let container: HTMLDivElement;
  let root: Root;
  let elementState: ImageElement;
  let updateCount: number;

  function renderInspector(locale?: "en" | "pt-BR"): void {
    root.render(
      <StudioI18nProvider>
        {locale ? <LocaleSetter locale={locale} /> : null}
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

  async function mount(
    element: ImageElement = imageElement(),
    locale?: "en" | "pt-BR",
  ): Promise<void> {
    elementState = element;
    updateCount = 0;
    await act(async () => renderInspector(locale));
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

    expect(cropInput(container, "x").value).toBe("0");
    expect(cropInput(container, "y").value).toBe("0");
    expect(cropInput(container, "width").value).toBe("100");
    expect(cropInput(container, "height").value).toBe("100");
    expect(cropInput(container, "x").max).toBe("99");
    expect(cropInput(container, "y").max).toBe("99");
    expect(cropInput(container, "width").max).toBe("100");
    expect(cropInput(container, "height").max).toBe("100");
    expect(cropLabel(container, "x")).toBe("X");
    expect(cropLabel(container, "y")).toBe("Y");
    expect(cropLabel(container, "width")).toBe("Width");
    expect(cropLabel(container, "height")).toBe("Height");
    expect(resetCropButton(container).disabled).toBe(true);
    expect(updateCount).toBe(0);
    expect(elementState.crop).toBeUndefined();
  });

  it("keeps the Image Inspector sections in the intended order", async () => {
    await mount();

    const headings = Array.from(container.querySelectorAll("details > summary > span:first-child"))
      .map((heading) => heading.textContent);
    expect(headings).toEqual(["Source", "Size", "Appearance", "Effects", "Interaction"]);
  });

  it("keeps Preserve proportion checkbox before its visible label", async () => {
    await mount();

    const checkbox = container.querySelector<HTMLInputElement>("#image-preserve-proportion");
    expect(checkbox).not.toBeNull();
    const label = checkbox!.closest("label");
    expect(label?.firstElementChild).toBe(checkbox);
    expect(label?.lastElementChild?.textContent).toContain("Preserve proportion");
  });

  it("localizes Width and Height labels in Portuguese", async () => {
    await mount(imageElement(), "pt-BR");

    expect(cropLabel(container, "x")).toBe("X");
    expect(cropLabel(container, "y")).toBe("Y");
    expect(cropLabel(container, "width")).toBe("Largura");
    expect(cropLabel(container, "height")).toBe("Altura");
  });

  it("updates Width and Height max values from the effective origin", async () => {
    await mount(imageElement({ crop: { x: 30, y: 20, width: 60, height: 50 } }));

    expect(cropInput(container, "x").max).toBe("99");
    expect(cropInput(container, "y").max).toBe("99");
    expect(cropInput(container, "width").max).toBe("70");
    expect(cropInput(container, "height").max).toBe("80");

    await act(async () => changeInput(cropInput(container, "x"), "10"));
    expect(cropInput(container, "width").max).toBe("90");

    await act(async () => changeInput(cropInput(container, "y"), "40"));
    expect(cropInput(container, "height").max).toBe("60");
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
    const initial = imageElement({
      crop: { x: 10, y: 20, width: 60, height: 50 },
      layout: { position: "absolute", top: 10, left: 20, width: "50%", height: 240 },
      style: { borderRadius: 8 },
      effect: { opacity: 0.8 },
      link: { kind: "url", href: "https://example.com" },
      src: "/assets/reset-example.png",
      alt: "Reset example",
      fit: "cover",
      focalPoint: { x: 25, y: 70 },
    });
    await mount(initial);

    const reset = resetCropButton(container);
    expect(reset.disabled).toBe(false);

    await act(async () => reset?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(elementState.crop).toBeUndefined();
    expect(elementState).toEqual({ ...initial, crop: undefined });
  });

  it("collapses a crop returned exactly to full frame", async () => {
    await mount(imageElement({ crop: { x: 10, y: 0, width: 90, height: 100 } }));

    await act(async () => changeInput(container.querySelector<HTMLInputElement>("#image-crop-x")!, "0"));
    await act(async () => changeInput(container.querySelector<HTMLInputElement>("#image-crop-width")!, "100"));
    expect(elementState.crop).toBeUndefined();
    expect(ImageElementSchema.safeParse(elementState).success).toBe(true);
  });
});
