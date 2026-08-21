// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ElementCrudControls } from "../src/features/editor/element-crud-controls";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("ElementCrudControls Gallery wiring", () => {
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
  });

  it("exposes Gallery in the Add Element select", async () => {
    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <ElementCrudControls
            selectedElement={null}
            onAdd={() => {}}
            onDuplicate={() => {}}
            onDelete={() => {}}
          />
        </StudioI18nProvider>,
      );
    });

    const select = container.querySelector("select");
    const options = Array.from(select?.querySelectorAll("option") ?? []);

    const galleryOption = options.find(
      (option) => option.value === "gallery",
    );

    expect(galleryOption).not.toBeUndefined();
    expect(galleryOption?.textContent).toBe("Gallery");
  });
});
