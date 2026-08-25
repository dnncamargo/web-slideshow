// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PowerShowElement } from "@powershow/document-schema";

import type { CustomLibraryItemDraft } from "../src/features/custom-library/custom-library-item";
import type {
  CustomLibraryItemRecord,
  CustomLibraryRepository,
} from "../src/features/custom-library/custom-library-repository";
import { ElementPropertiesPanel } from "../src/features/editor/element-properties-panel";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function renderPanel(
  root: Root,
  element: PowerShowElement | null,
  isStructuralTopicSelection = false,
  customLibraryRepository?: CustomLibraryRepository,
): void {
  act(() => {
    root.render(
      <StudioI18nProvider>
        <ElementPropertiesPanel
          selectedElement={element}
          isStructuralTopicSelection={isStructuralTopicSelection}
          customLibraryRepository={customLibraryRepository}
        />
      </StudioI18nProvider>,
    );
  });
}

function fakeRepository(
  saveItem: (item: CustomLibraryItemDraft) => Promise<string> = async () => "item-1",
): CustomLibraryRepository {
  return {
    saveItem,
    listItems: async (): Promise<CustomLibraryItemRecord[]> => [],
    getItem: async () => null,
    deleteItem: async () => undefined,
  };
}

const textElement: PowerShowElement = {
  type: "text",
  id: "text-1",
  hidden: false,
  variant: "title",
  content: "Hello",
};

function checkboxFor(container: HTMLDivElement, path: string): HTMLInputElement {
  const checkbox = Array.from(
    container.querySelectorAll<HTMLInputElement>("input[type=checkbox]"),
  ).find((input) => input.parentElement?.textContent?.includes(path));
  if (!checkbox) throw new Error(`Missing checkbox for ${path}`);
  return checkbox;
}

function setFieldValue(
  field: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): void {
  const setter = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(field),
    "value",
  )?.set;
  setter?.call(field, value);
  field.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("ElementPropertiesPanel", () => {
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

  it("shows a neutral empty state when no element is selected", () => {
    renderPanel(root, null);

    expect(container.textContent).toContain("Properties");
    expect(container.textContent).toContain("No element selected.");
  });

  it("shows identity and authored canonical values for text and image elements", () => {
    renderPanel(root, {
      type: "text",
      id: "hero-title",
      hidden: false,
      variant: "title",
      content: "Introduction to PWM",
      layout: { position: "absolute", top: "8%" },
    });

    expect(container.textContent).toContain("Text · hero-title");
    expect(container.textContent).toContain("contentIntroduction to PWM");
    expect(container.textContent).toContain("layout.positionabsolute");

    renderPanel(root, {
      type: "image",
      id: "company-logo",
      hidden: false,
      src: "https://example.com/logo.svg",
      alt: "PowerShow",
      fit: "contain",
    });

    expect(container.textContent).toContain("Image · company-logo");
    expect(container.textContent).toContain("srchttps://example.com/logo.svg");
  });

  it("does not expose a Topics element as the selected ContentSlot", () => {
    renderPanel(
      root,
      {
        type: "topics",
        id: "topics-1",
        hidden: false,
        kind: "unordered",
        items: [],
      },
      true,
    );

    expect(container.textContent).toContain("Content slot");
    expect(container.textContent).toContain("Structural authoring context");
    expect(container.textContent).not.toContain("Topics · topics-1");
    expect(container.textContent).not.toContain("items0 items");
  });

  it("keeps checkbox choices in UI state and initializes a new element separately", () => {
    const before = JSON.stringify(textElement);

    renderPanel(root, textElement);
    const contentCheckbox = Array.from(
      container.querySelectorAll<HTMLInputElement>("input[type=checkbox]"),
    ).find((checkbox) => checkbox.parentElement?.textContent?.includes("content"));

    expect(contentCheckbox?.checked).toBe(false);
    expect(contentCheckbox).toBeDefined();

    act(() => {
      contentCheckbox?.click();
    });

    expect(contentCheckbox?.checked).toBe(true);
    expect(JSON.stringify(textElement)).toBe(before);

    renderPanel(root, {
      type: "image",
      id: "image-1",
      hidden: false,
      src: "logo.svg",
      alt: "Logo",
      fit: "contain",
    });

    const srcCheckbox = Array.from(
      container.querySelectorAll<HTMLInputElement>("input[type=checkbox]"),
    ).find((checkbox) => checkbox.parentElement?.textContent?.includes("src"));
    const fitCheckbox = Array.from(
      container.querySelectorAll<HTMLInputElement>("input[type=checkbox]"),
    ).find((checkbox) => checkbox.parentElement?.textContent?.includes("fit"));

    expect(srcCheckbox?.checked).toBe(false);
    expect(fitCheckbox?.checked).toBe(true);
  });

  it("does not offer save for no selection or a structural content slot", () => {
    renderPanel(root, null);
    expect(container.querySelector("button")).toBeNull();

    renderPanel(root, textElement, true);
    expect(container.querySelector("button")).toBeNull();
  });

  it("opens, cancels, and resets the save form without saving", () => {
    const saveItem = async () => "item-1";
    renderPanel(root, textElement, false, fakeRepository(saveItem));

    act(() => {
      container.querySelector<HTMLButtonElement>("button")?.click();
    });
    expect(container.querySelector("form")).not.toBeNull();

    act(() => {
      container.querySelector<HTMLButtonElement>('button[type="button"]')?.click();
    });
    expect(container.querySelector("form")).toBeNull();
  });

  it("saves normalized metadata and selected properties through the repository", async () => {
    let saved: CustomLibraryItemDraft | undefined;
    const repository = fakeRepository(async (item) => {
      saved = item;
      return "item-1";
    });
    renderPanel(root, textElement, false, repository);

    act(() => {
      container.querySelector<HTMLButtonElement>("button")?.click();
    });
    const form = container.querySelector<HTMLFormElement>("form");
    const name = container.querySelector<HTMLInputElement>("input:not([type=checkbox])");
    const description = container.querySelector<HTMLTextAreaElement>("textarea");
    expect(form).not.toBeNull();
    expect(name).not.toBeNull();

    act(() => {
      if (name) setFieldValue(name, "  Reusable title  ");
      if (description) setFieldValue(description, "  Optional note  ");
      checkboxFor(container, "content").click();
    });

    await act(async () => {
      form?.requestSubmit();
    });

    expect(saved?.name).toBe("Reusable title");
    expect(saved?.description).toBe("Optional note");
    expect(saved?.root.properties).toContainEqual({
      path: "content",
      value: "Hello",
    });
    expect(container.textContent).toContain("Saved to Custom Library.");
    expect(container.querySelector("form")).toBeNull();
  });

  it("keeps the form and metadata after a repository failure", async () => {
    renderPanel(
      root,
      textElement,
      false,
      fakeRepository(async () => {
        throw new Error("offline");
      }),
    );
    act(() => container.querySelector<HTMLButtonElement>("button")?.click());
    const form = container.querySelector<HTMLFormElement>("form");
    const name = container.querySelector<HTMLInputElement>("input:not([type=checkbox])");
    act(() => {
      if (name) setFieldValue(name, "Keep me");
    });
    await act(async () => form?.requestSubmit());

    expect(container.querySelector("form")).not.toBeNull();
    expect(container.textContent).toContain("Could not save to Custom Library.");
    expect(name?.value).toBe("Keep me");
  });

  it("resets an open form when the selected root changes", () => {
    renderPanel(root, textElement, false, fakeRepository());
    act(() => container.querySelector<HTMLButtonElement>("button")?.click());
    expect(container.querySelector("form")).not.toBeNull();

    renderPanel(root, {
      type: "image",
      id: "image-1",
      hidden: false,
      src: "logo.svg",
      alt: "Logo",
      fit: "contain",
    }, false, fakeRepository());

    expect(container.querySelector("form")).toBeNull();
    expect(container.textContent).toContain("Image · image-1");
  });
});
