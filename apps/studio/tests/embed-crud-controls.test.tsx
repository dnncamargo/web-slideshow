// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ElementCrudControls } from "../src/features/editor/element-crud-controls";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("ElementCrudControls Embed wiring", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  function renderControls(onAdd: (type: string) => void) {
    act(() => {
      root.render(
        <StudioI18nProvider>
          <ElementCrudControls
            selectedElement={null}
            onAdd={onAdd}
            onDuplicate={() => {}}
            onDelete={() => {}}
          />
        </StudioI18nProvider>,
      );
    });
  }

  it("exposes Embed in the Add Element select", () => {
    renderControls(() => {});

    const select = container.querySelector("select");
    const options = Array.from(select?.querySelectorAll("option") ?? []);

    const embedOption = options.find((option) => option.value === "embed");

    expect(embedOption).not.toBeUndefined();
    expect(embedOption?.textContent).toBe("Embed");
  });

  it("calls onAdd with embed when Embed is selected and Add is pressed", () => {
    const onAdd = vi.fn();
    renderControls(onAdd);

    const select = container.querySelector("select");
    if (!select) {
      throw new Error("Add Element select not found");
    }

    act(() => {
      select.value = "embed";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const addButton = Array.from(
      container.querySelectorAll("button"),
    ).find((button) => button.textContent?.includes("+ Add"));

    if (!addButton) {
      throw new Error("Add button not found");
    }

    act(() => {
      addButton.click();
    });

    expect(onAdd).toHaveBeenCalledWith("embed");
  });
});