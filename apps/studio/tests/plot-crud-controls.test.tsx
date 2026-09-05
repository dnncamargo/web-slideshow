// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ElementCrudControls } from "../src/features/editor/element-crud-controls";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("ElementCrudControls Plot wiring", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("exposes Plot and excludes Interactive", () => {
    act(() => {
      root.render(
        <StudioI18nProvider>
          <ElementCrudControls selectedElement={null} onAdd={() => {}} onDuplicate={() => {}} onDelete={() => {}} />
        </StudioI18nProvider>,
      );
    });

    const options = Array.from(container.querySelectorAll("option"));
    expect(options.find((option) => option.value === "chart")?.textContent).toBe("Plot");
    expect(options.find((option) => option.value === "interactive")).toBeUndefined();
  });

  it("calls onAdd with chart when Plot is selected", () => {
    const onAdd = vi.fn();
    act(() => {
      root.render(
        <StudioI18nProvider>
          <ElementCrudControls selectedElement={null} onAdd={onAdd} onDuplicate={() => {}} onDelete={() => {}} />
        </StudioI18nProvider>,
      );
    });

    const select = container.querySelector("select");
    if (!select) throw new Error("Add Element select not found");
    act(() => {
      select.value = "chart";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const addButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("+ Add"));
    if (!addButton) throw new Error("Add button not found");
    act(() => addButton.click());

    expect(onAdd).toHaveBeenCalledWith("chart");
  });
});
