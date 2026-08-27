// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ColorValue } from "@powershow/document-schema";

import { ColorControl } from "../src/features/editor/inspector/sections/color-control";
import { PresentationColorPaletteProvider } from "../src/features/editor/inspector/sections/presentation-color-palette";
import { PickedColorsProvider } from "../src/features/editor/inspector/sections/picked-colors-provider";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("ColorControl linked palette UX", () => {
  let container: HTMLDivElement;
  let root: Root;
  let pickedSpy: ReturnType<typeof vi.fn>;
  let removePickedSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = "";
  });

  function renderControl(value: ColorValue | undefined, onChange = vi.fn(), pickedColors: readonly string[] = [], disabled = false, paletteColors = [
    { id: "accent", name: "Accent", value: "#ffffff" },
    { id: "border", name: "Border", value: "#ffffff" },
  ], secondaryAction?: { label: string; onClick: () => void; disabled?: boolean }) {
    pickedSpy = vi.fn();
    removePickedSpy = vi.fn();
    act(() => root.render(
      <StudioI18nProvider>
        <PickedColorsProvider colors={pickedColors} onPickColor={pickedSpy} onRemoveColor={removePickedSpy}>
          <PresentationColorPaletteProvider colors={paletteColors}>
            <ColorControl id="color" name="Color" value={value} onChange={onChange} disabled={disabled} secondaryAction={secondaryAction} />
          </PresentationColorPaletteProvider>
        </PickedColorsProvider>
      </StudioI18nProvider>,
    ));
    return onChange;
  }

  it("renders literals without authoring on mount", () => {
    const onChange = renderControl("#ffffff");
    expect(onChange).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("Theme");
    expect(container.querySelector("[aria-label='Add current color']")).toBeNull();
    expect(container.querySelector("button[aria-expanded]")?.textContent).toBe("Use palette");
    expect(container.querySelectorAll("button[aria-pressed]")).toHaveLength(0);
  });

  it("renders and invokes an explicit secondary action without authoring a color", () => {
    const secondary = vi.fn();
    const onChange = renderControl("#ffffff", vi.fn(), [], false, undefined, { label: "Remove", onClick: secondary });
    const button = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((candidate) => candidate.textContent === "Remove");
    expect(button).toBeDefined();
    act(() => button?.click());
    expect(secondary).toHaveBeenCalledOnce();
    expect(onChange).not.toHaveBeenCalled();
    expect(pickedSpy).not.toHaveBeenCalled();
  });

  it("disables both compact actions when ColorControl is disabled", () => {
    const secondary = vi.fn();
    renderControl("#ffffff", vi.fn(), [], true, undefined, { label: "Remove", onClick: secondary });
    expect(Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .filter((button) => ["Use palette", "Remove"].includes(button.textContent ?? ""))
      .every((button) => button.disabled)).toBe(true);
  });

  it("opens the chooser on demand and selects a palette reference", () => {
    const onChange = renderControl("#ffffff");
    const usePalette = container.querySelector<HTMLButtonElement>("button[aria-expanded]");
    expect(usePalette?.getAttribute("aria-expanded")).toBe("false");
    act(() => usePalette?.click());
    expect(usePalette?.getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelector("#color-palette-chooser")).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
    const accent = Array.from(container.querySelectorAll<HTMLButtonElement>("button[aria-pressed]"))
      .find((button) => button.getAttribute("aria-label")?.includes("Accent"));
    act(() => accent?.click());
    expect(onChange).toHaveBeenCalledWith({ kind: "palette", colorId: "accent" });
    expect(container.querySelector("#color-palette-chooser")).toBeNull();
  });

  it("shows the linked entry name without opening the chooser and detaches safely", () => {
    const onChange = renderControl({ kind: "palette", colorId: "border" });
    expect(container.textContent).toContain("Linked to presentation palette · Border");
    expect(container.querySelector("#color-palette-chooser")).toBeNull();
    const change = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent === "Use palette");
    expect(change?.getAttribute("aria-expanded")).toBe("false");
    expect(onChange).not.toHaveBeenCalled();

    const detach = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent === "Detach");
    act(() => detach?.click());
    expect(onChange).toHaveBeenCalledWith("#ffffff");
  });

  it("uses strict color ids when duplicate visual values are present", () => {
    const onChange = renderControl({ kind: "palette", colorId: "border" });
    const change = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent === "Use palette");
    act(() => change?.click());
    const selected = container.querySelectorAll<HTMLButtonElement>("button[aria-pressed='true']");
    expect(selected).toHaveLength(1);
    expect(selected[0]?.getAttribute("aria-label")).toContain("Border");
    expect(Array.from(container.querySelectorAll<HTMLButtonElement>("button[aria-pressed='false']"))).toHaveLength(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps an equal literal value unlinked", () => {
    const onChange = renderControl("#ffffff");
    act(() => container.querySelector<HTMLButtonElement>("button[aria-expanded]")?.click());
    expect(container.querySelectorAll("button[aria-pressed='true']")).toHaveLength(0);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not use the picker fallback for an unresolved detach", () => {
    const onChange = renderControl({ kind: "palette", colorId: "missing" });
    const detach = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent === "Detach");
    expect(detach?.disabled).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("renders and emits Picked Colors as literals without duplicating them", () => {
    renderControl("#000000", vi.fn(), ["#facc15"]);
    act(() => container.querySelector<HTMLButtonElement>("button[aria-expanded]")?.click());
    const pickedButton = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.getAttribute("aria-label") === "Apply palette color #facc15");
    expect(pickedButton).toBeDefined();
    const remove = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.getAttribute("aria-label")?.includes("Remove picked color"));
    act(() => remove?.click());
    expect(pickedSpy).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("Clear");
    expect(container.querySelectorAll(".colorPaletteMove")).toHaveLength(0);
    expect(removePickedSpy).toHaveBeenCalledWith("#facc15");

    const secondChange = vi.fn();
    renderControl("#000000", secondChange, ["#facc15"]);
    const picked = container.querySelector<HTMLButtonElement>("button[aria-label='Apply palette color #facc15']");
    expect(picked).toBeDefined();
    act(() => picked?.click());
    expect(secondChange).toHaveBeenCalledWith("#facc15");
  });

  it("closes the chooser when literal text or picker edits are authored", () => {
    const onChange = renderControl("#000000");
    act(() => container.querySelector<HTMLButtonElement>("button[aria-expanded]")?.click());
    const input = container.querySelector<HTMLInputElement>("#color-value");
    act(() => { if (input) { setInputValue(input, "#123456"); input.dispatchEvent(new Event("input", { bubbles: true })); } });
    expect(onChange).toHaveBeenCalledWith("#123456");
    expect(container.querySelector("#color-palette-chooser")).toBeNull();
  });

  it("emits a literal Color for native picker edits", () => {
    const onChange = renderControl("#facc15");
    const picker = container.querySelector<HTMLInputElement>("input[type=color]");
    act(() => {
      if (picker) {
        setInputValue(picker, "#2563eb");
        picker.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    expect(onChange).toHaveBeenCalledWith("#2563eb");
    expect(pickedSpy).toHaveBeenCalledWith("#2563eb");
  });

  it("applies typed literals without adding picked shortcuts", () => {
    const onChange = renderControl("#000000");
    const input = container.querySelector<HTMLInputElement>("#color-value");
    act(() => {
      if (input) {
        setInputValue(input, "#123456");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    expect(onChange).toHaveBeenCalledWith("#123456");
    expect(pickedSpy).not.toHaveBeenCalled();
  });

  it("does not add palette selection or detach results to picked shortcuts", () => {
    const onChange = renderControl({ kind: "palette", colorId: "border" });
    act(() => container.querySelector<HTMLButtonElement>("button[aria-expanded]")?.click());
    const accent = Array.from(container.querySelectorAll<HTMLButtonElement>("button[aria-pressed]"))
      .find((button) => button.getAttribute("aria-label")?.includes("Accent"));
    act(() => accent?.click());
    expect(onChange).toHaveBeenCalledWith({ kind: "palette", colorId: "accent" });
    expect(pickedSpy).not.toHaveBeenCalled();

    const linkedChange = vi.fn();
    renderControl({ kind: "palette", colorId: "border" }, linkedChange);
    act(() => Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent === "Detach")?.click());
    expect(linkedChange).toHaveBeenCalledWith("#ffffff");
    expect(pickedSpy).not.toHaveBeenCalled();
  });

  it("does not author a format-only change when the value is undefined", () => {
    const onChange = renderControl(undefined);
    const format = container.querySelector<HTMLSelectElement>("#color-format");
    act(() => {
      if (format) {
        format.value = "rgba";
        format.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    expect(onChange).not.toHaveBeenCalled();
    expect(pickedSpy).not.toHaveBeenCalled();
    expect(container.querySelector<HTMLInputElement>("#color-value")?.value).toBe("rgba(248, 250, 252, 1)");
  });

  it("does not offer a chooser for an empty palette and disables authored actions", () => {
    const onChange = renderControl({ kind: "palette", colorId: "missing" }, vi.fn(), [], true, []);
    expect(container.querySelector("button[aria-expanded]")).toBeNull();
    expect(container.querySelector<HTMLButtonElement>("button")?.disabled).toBe(true);
    const detach = Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent === "Detach");
    expect(detach?.disabled).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });
});

function setInputValue(input: HTMLInputElement, value: string): void {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
}
