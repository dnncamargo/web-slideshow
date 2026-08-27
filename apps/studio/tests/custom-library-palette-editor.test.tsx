// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CustomLibraryPaletteDraft } from "../src/features/custom-library/custom-library-palette";
import { CustomLibraryPaletteEditor } from "../src/features/custom-library/custom-library-palette-editor";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const sourcePalette: CustomLibraryPaletteDraft = {
  name: "  Brand  ",
  description: "  Shared colors  ",
  colors: [
    { name: "Accent", value: "#facc15" },
    { name: "Ink", value: "rgba(10, 20, 30, 0.4)" },
  ],
};

describe("CustomLibraryPaletteEditor", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = "";
  });

  function render(
    mode: "create" | "edit" | "copy" = "create",
    initialPalette?: CustomLibraryPaletteDraft,
    options: { submitting?: boolean; error?: string | null; onSubmit?: ReturnType<typeof vi.fn>; onCancel?: ReturnType<typeof vi.fn> } = {},
  ) {
    const onSubmit = options.onSubmit ?? vi.fn();
    const onCancel = options.onCancel ?? vi.fn();
    act(() => root.render(
      <StudioI18nProvider>
        <CustomLibraryPaletteEditor mode={mode} initialPalette={initialPalette} submitting={options.submitting} error={options.error} onSubmit={onSubmit} onCancel={onCancel} />
      </StudioI18nProvider>,
    ));
    return { onSubmit, onCancel };
  }

  it("starts create mode empty with submit disabled", () => {
    render();
    expect(container.querySelector<HTMLInputElement>("input")?.value).toBe("");
    expect(container.querySelector("textarea")?.textContent).toBe("");
    expect(container.querySelector("#custom-library-palette-color-1-value")).toBeNull();
    expect(container.querySelector<HTMLButtonElement>("button[type=submit]")?.disabled).toBe(true);
  });

  it("adds a blank named color with the neutral fallback", () => {
    render();
    clickButton("+ Add color");
    expect(container.querySelectorAll("input[aria-label='Color name']")).toHaveLength(1);
    expect(container.querySelector<HTMLInputElement>("input[id$='-value']")?.value).toBe("#f8fafc");
    expect(container.querySelector<HTMLButtonElement>("button[type=submit]")?.disabled).toBe(true);
  });

  it("edits literal color values through LiteralColorInput", () => {
    render();
    clickButton("+ Add color");
    const name = container.querySelector<HTMLInputElement>("input[aria-label='Color name']");
    setInputValue(name, "Accent");
    dispatch(name, "input");
    const value = container.querySelector<HTMLInputElement>("input[id$='-value']");
    setInputValue(value, "#2563eb");
    dispatch(value, "input");
    setInputValue(name, "Accent");
    dispatch(name, "input");
    expect(container.querySelector<HTMLInputElement>("input[id$='-value']")?.value).toBe("#2563eb");
  });

  it("submits a trimmed valid draft and omits empty description", () => {
    const { onSubmit } = render();
    fillCreateForm("  New palette  ", "  Accent  ", "#22c55e", "   ");
    clickButton("Create");
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({ name: "New palette", colors: [{ name: "Accent", value: "#22c55e" }] });
  });

  it("preserves order and allows duplicate names and values", () => {
    const { onSubmit } = render();
    fillCreateForm("Palette", "Same", "#facc15");
    clickButton("+ Add color");
    const names = container.querySelectorAll<HTMLInputElement>("input[aria-label='Color name']");
    const values = container.querySelectorAll<HTMLInputElement>("input[id$='-value']");
    setInputValue(names[1], "Same");
    dispatch(names[1], "input");
    setInputValue(values[1], "#facc15");
    dispatch(values[1], "input");
    clickButton("Create");
    expect(onSubmit).toHaveBeenCalledWith({ name: "Palette", description: "Description", colors: [{ name: "Same", value: "#facc15" }, { name: "Same", value: "#facc15" }] });
  });

  it("removes only the selected row and disallows zero colors", () => {
    render("edit", { name: "Palette", colors: [{ name: "A", value: "#facc15" }, { name: "B", value: "#2563eb" }] });
    const removeButtons = container.querySelectorAll<HTMLButtonElement>("button");
    act(() => Array.from(removeButtons).find((button) => button.textContent === "Remove")?.click());
    expect(container.querySelectorAll("input[aria-label='Color name']")).toHaveLength(1);
    act(() => Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent === "Remove")?.click());
    expect(container.querySelector<HTMLButtonElement>("button[type=submit]")?.disabled).toBe(true);
  });

  it("prefills independent edit and copy modes", () => {
    const { onSubmit } = render("edit", sourcePalette);
    expect(container.querySelector<HTMLInputElement>("input")?.value).toBe("  Brand  ");
    expect(container.querySelectorAll("input[aria-label='Color name']")).toHaveLength(2);
    expect(container.querySelector("h2")?.textContent).toBe("Edit palette");

    const name = container.querySelector<HTMLInputElement>("input");
    setInputValue(name, "Changed");
    dispatch(name, "input");
    expect(sourcePalette.name).toBe("  Brand  ");
    expect(onSubmit).not.toHaveBeenCalled();

    render("copy", sourcePalette);
    expect(container.querySelector("h2")?.textContent).toBe("Copy palette");
    expect(container.querySelector<HTMLInputElement>("input")?.value).toBe("  Brand  ");
  });

  it("resets when the initial palette changes", () => {
    render("edit", { name: "A", colors: [{ name: "Accent", value: "#facc15" }] });
    const paletteB = { name: "B", colors: [{ name: "Blue", value: "#2563eb" }] } satisfies CustomLibraryPaletteDraft;
    act(() => root.render(<StudioI18nProvider><CustomLibraryPaletteEditor mode="edit" initialPalette={paletteB} onSubmit={vi.fn()} onCancel={vi.fn()} /></StudioI18nProvider>));
    expect(container.querySelector<HTMLInputElement>("input")?.value).toBe("B");
    expect(container.querySelector<HTMLInputElement>("input[aria-label='Color name']")?.value).toBe("Blue");
  });

  it("disables every mutation action while submitting and shows errors", () => {
    const { onCancel, onSubmit } = render("edit", sourcePalette, { submitting: true, error: "Unable to save" });
    expect(container.textContent).toContain("Unable to save");
    expect(Array.from(container.querySelectorAll("input, textarea, select, button")).every((element) => (element as HTMLInputElement).disabled)).toBe(true);
    clickButton("Cancel");
    expect(onCancel).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("fires cancel when enabled", () => {
    const { onCancel } = render();
    clickButton("Cancel");
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it.each(["", "   "])("disables submit for whitespace palette name (%j)", (name) => {
    render();
    fillCreateForm(name, "Accent", "#facc15");
    expect(container.querySelector<HTMLButtonElement>("button[type=submit]")?.disabled).toBe(true);
  });

  it("disables submit for whitespace color names", () => {
    render();
    fillCreateForm("Palette", "   ", "#facc15");
    expect(container.querySelector<HTMLButtonElement>("button[type=submit]")?.disabled).toBe(true);
  });
});

function fillCreateForm(name: string, colorName: string, value: string, description = "Description") {
  const inputs = containerInputs();
  setInputValue(inputs[0], name);
  dispatch(inputs[0], "input");
  const descriptionInput = document.querySelector<HTMLTextAreaElement>("textarea");
  if (descriptionInput) {
    setInputValue(descriptionInput, description);
    dispatch(descriptionInput, "input");
  }
  clickButton("+ Add color");
  const colorNameInput = document.querySelector<HTMLInputElement>("input[aria-label='Color name']");
  const colorValueInput = document.querySelector<HTMLInputElement>("input[id$='-value']");
  setInputValue(colorNameInput, colorName);
  dispatch(colorNameInput, "input");
  setInputValue(colorValueInput, value);
  dispatch(colorValueInput, "input");
}

function containerInputs(): HTMLInputElement[] {
  return Array.from(document.querySelectorAll<HTMLInputElement>("form > label:first-of-type input"));
}

function clickButton(label: string): void {
  act(() => {
    Array.from(document.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent === label)?.click();
  });
}

function setInputValue(input: HTMLInputElement | HTMLTextAreaElement | null | undefined, value: string): void {
  if (!input) return;
  const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(input, value);
}

function dispatch(input: HTMLInputElement | HTMLTextAreaElement | null | undefined, event: string): void {
  if (!input) return;
  act(() => input.dispatchEvent(new Event(event, { bubbles: true })));
}
