// @vitest-environment jsdom

import { act, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PowerShowElement } from "@powershow/document-schema";

import { CustomLibrarySaveForm } from "../src/features/custom-library/custom-library-save-form";
import type { CustomLibraryRepository } from "../src/features/custom-library/custom-library-repository";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const rootElement: PowerShowElement = {
  type: "text",
  id: "text-1",
  hidden: false,
  variant: "title",
  content: "Hello",
};

function repository(saveItem: CustomLibraryRepository["saveItem"]): CustomLibraryRepository {
  return {
    saveItem,
    listItems: async () => [],
    getItem: async () => null,
    deleteItem: async () => undefined,
  };
}

describe("CustomLibrarySaveForm", () => {
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

  function renderForm(
    saveItem: CustomLibraryRepository["saveItem"],
    onSaved = vi.fn(),
  ) {
    act(() => {
      root.render(
        <StudioI18nProvider>
          <StrictMode>
            <CustomLibrarySaveForm
              root={rootElement}
              selections={new Map()}
              repository={repository(saveItem)}
              onSaved={onSaved}
              onCancel={vi.fn()}
            />
          </StrictMode>
        </StudioI18nProvider>,
      );
    });
    return onSaved;
  }

  function enterName(name: string) {
    const input = container.querySelector<HTMLInputElement>("input");
    if (!input) throw new Error("Missing name input");
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(input),
        "value",
      )?.set;
      setter?.call(input, name);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  it("processes a successful save after Strict Mode effect replay without unmounting", async () => {
    let resolveSave: ((id: string) => void) | undefined;
    const onSaved = renderForm(() => new Promise<string>((resolve) => {
      resolveSave = resolve;
    }));
    enterName("Reusable title");
    const form = container.querySelector<HTMLFormElement>("form");
    act(() => form?.requestSubmit());

    expect(container.textContent).toContain("Saving…");
    await act(async () => {
      resolveSave?.("item-1");
    });

    expect(onSaved).toHaveBeenCalledOnce();
    expect(container.textContent).not.toContain("Saving…");
  });

  it("does not call onSaved after a real unmount", async () => {
    let resolveSave: ((id: string) => void) | undefined;
    const onSaved = renderForm(() => new Promise<string>((resolve) => {
      resolveSave = resolve;
    }));
    enterName("Unmounted title");
    act(() => container.querySelector<HTMLFormElement>("form")?.requestSubmit());
    act(() => root.unmount());

    await act(async () => {
      resolveSave?.("item-1");
    });

    expect(onSaved).not.toHaveBeenCalled();
  });
});
