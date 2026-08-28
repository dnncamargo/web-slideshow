// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CustomLibraryItemRecord } from "../src/features/custom-library/custom-library-repository";
import {
  CustomLibraryApplyPicker,
  type CustomLibraryApplyOutcome,
} from "../src/features/custom-library/custom-library-apply-picker";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const item: CustomLibraryItemRecord = {
  id: "firestore-only-id",
  item: {
    name: "Title style",
    description: "A reusable title",
    root: {
      type: "text",
      properties: [{ path: "content", value: "Secret recipe value" }],
    },
    dependencies: {
      fonts: [{
        family: "Fira Code",
        faces: [{
          weight: 400,
          style: "normal",
          subset: "latin",
          source: { type: "url", url: "https://example.com/fira.woff2", format: "woff2" },
        }],
      }],
    },
  },
};

function repository(listItems: () => Promise<CustomLibraryItemRecord[]>) {
  return {
    saveItem: async () => "saved",
    listItems,
    getItem: async () => null,
    deleteItem: async () => undefined,
  };
}

describe("CustomLibraryApplyPicker", () => {
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
    listItems: () => Promise<CustomLibraryItemRecord[]>,
    onApply: ReturnType<typeof vi.fn<() => CustomLibraryApplyOutcome>> = vi.fn(() => ({ ok: true as const })),
  ) {
    act(() => {
      root.render(
        <StudioI18nProvider>
          <CustomLibraryApplyPicker
            repository={repository(listItems)}
            onApply={onApply}
          />
        </StudioI18nProvider>,
      );
    });
    return onApply;
  }

  function open() {
    act(() => {
      container.querySelector<HTMLButtonElement>("button")?.click();
    });
  }

  it("does not list on mount and shows loading while opening", async () => {
    const listItems = vi.fn(() => new Promise<CustomLibraryItemRecord[]>(() => undefined));
    render(listItems);
    expect(listItems).not.toHaveBeenCalled();
    open();
    expect(listItems).toHaveBeenCalledOnce();
    expect(container.textContent).toContain("Loading Custom Library");
  });

  it("renders records in repository order without ids or raw recipe values", async () => {
    const listItems = vi.fn(async () => [item, { ...item, id: "second", item: { ...item.item, name: "Second" } }]);
    render(listItems);
    open();
    await act(async () => undefined);

    expect(container.textContent).toContain("Title style");
    expect(container.textContent).toContain("A reusable title");
    expect(container.textContent).toContain("Text");
    expect(container.textContent).not.toContain("firestore-only-id");
    expect(container.textContent).not.toContain("Secret recipe value");
    expect(container.textContent?.indexOf("Title style")).toBeLessThan(container.textContent?.indexOf("Second") ?? -1);
    expect(container.querySelector("button")?.textContent).not.toContain("Delete");
  });

  it("shows an empty state", async () => {
    render(async () => []);
    open();
    await act(async () => undefined);
    expect(container.textContent).toContain("No Custom Library items yet.");
  });

  it("shows failure and retries listing", async () => {
    const listItems = vi.fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce([item]);
    render(listItems);
    open();
    await act(async () => undefined);
    expect(container.textContent).toContain("Could not load Custom Library.");
    act(() => {
      Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Retry")?.click();
    });
    await act(async () => undefined);
    expect(listItems).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain("Title style");
  });

  it("emits exactly the selected item when Apply is pressed", async () => {
    const onApply = render(async () => [item]);
    open();
    await act(async () => undefined);
    const itemButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Title style"));
    act(() => itemButton?.click());
    act(() => {
      Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Apply")?.click();
    });
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith(item.item);
  });

  it("shows generic failure feedback for font dependency conflicts", async () => {
    const onApply = vi.fn(() => ({
      ok: false as const,
      reason: "font-dependency-conflict" as const,
    }));
    render(async () => [item], onApply);
    open();
    await act(async () => undefined);
    act(() => Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent?.includes("Title style"))?.click());
    act(() => Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent === "Apply")?.click());

    expect(onApply).toHaveBeenCalledOnce();
    expect(container.textContent).toContain("Could not apply Custom Library item.");
    expect(container.textContent).not.toContain("cannot be created in the Editor yet");
  });
});
