// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ContainerElement,
  ElementLink,
  ImageElement,
  PowerShowElement,
  TextElement,
} from "@powershow/document-schema";

import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";
import { ContainerInspector } from "../src/features/editor/inspector/container-inspector";
import { ImageInspector } from "../src/features/editor/inspector/image-inspector";
import { TextInspector } from "../src/features/editor/inspector/text-inspector";
import { ElementInteractionSection } from "../src/features/editor/inspector/sections/element-interaction-section";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const FONT_RESOURCES: readonly { id: string; family: string }[] = [];

type LinkableElement = Extract<
  PowerShowElement,
  { type: "text" | "image" | "container" }
>;

function textElement(
  overrides: Partial<Omit<TextElement, "type" | "hidden">> = {},
): TextElement {
  return {
    type: "text",
    id: "text-1",
    hidden: false,
    variant: "body",
    content: "PowerShow Example",
    ...overrides,
  };
}

function imageElement(
  overrides: Partial<Omit<ImageElement, "type" | "hidden">> = {},
): ImageElement {
  return {
    type: "image",
    id: "image-1",
    hidden: false,
    src: "/assets/example.png",
    alt: "Example image",
    fit: "contain",
    ...overrides,
  };
}

function containerElement(
  overrides: Partial<Omit<ContainerElement, "type" | "hidden">> = {},
): ContainerElement {
  return {
    type: "container",
    id: "container-1",
    hidden: false,
    children: [],
    ...overrides,
  };
}

function urlInput(container: HTMLElement, prefix: string): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>(
    `#${prefix}-link-url`,
  );
  if (!input) {
    throw new Error(`link url input ${prefix} not found`);
  }
  return input;
}

function targetSelect(
  container: HTMLElement,
  prefix: string,
): HTMLSelectElement {
  const select = container.querySelector<HTMLSelectElement>(
    `#${prefix}-link-target`,
  );
  if (!select) {
    throw new Error(`link target select ${prefix} not found`);
  }
  return select;
}

function changeInput(input: HTMLInputElement, value: string): void {
  // Setting the value through the prototype setter bypasses React's
  // instance-level value tracker, so the following input event is
  // treated as a real user change and reaches React's onChange.
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )?.set;

  nativeInputValueSetter?.call(input, value);

  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function blurInput(input: HTMLInputElement): void {
  input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
}

function pressKey(input: HTMLInputElement, key: string): void {
  input.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
}

function changeSelect(select: HTMLSelectElement, value: string): void {
  select.value = value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("ElementInteractionSection", () => {
  let container: HTMLDivElement;
  let root: Root;
  let elementState: LinkableElement;
  let updates: LinkableElement[];

  function renderSection() {
    root.render(
      <StudioI18nProvider>
        <ElementInteractionSection
          element={elementState}
          controlPrefix={
            elementState.type === "text"
              ? "text"
              : elementState.type === "image"
                ? "image"
                : "container"
          }
          onUpdate={(update) => {
            const next = update(elementState);

            if (!isLinkableElementType(next)) {
              return;
            }

            elementState = next;
            updates.push(elementState);
            renderSection();
          }}
        />
      </StudioI18nProvider>,
    );
  }

  function mount(initial: LinkableElement) {
    elementState = initial;
    updates = [];
    renderSection();
  }

  function isLinkableElementType(
    element: PowerShowElement,
  ): element is LinkableElement {
    return (
      element.type === "text" ||
      element.type === "image" ||
      element.type === "container"
    );
  }

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

  it("mounting the section writes no canonical link and no target", async () => {
    await act(async () => {
      mount(textElement());
    });

    expect(updates).toHaveLength(0);
    expect(elementState).not.toHaveProperty("link");
  });

  it("typing a URL without committing writes nothing", async () => {
    await act(async () => {
      mount(textElement());
    });

    await act(async () => {
      changeInput(urlInput(container, "text"), "https://example.com");
    });

    expect(updates).toHaveLength(0);
    expect(elementState).not.toHaveProperty("link");
  });

  it("commits a valid https URL as a canonical link on blur", async () => {
    await act(async () => {
      mount(textElement());
    });

    await act(async () => {
      changeInput(
        urlInput(container, "text"),
        "https://example.com/guide?page=1#start",
      );
    });

    await act(async () => {
      blurInput(urlInput(container, "text"));
    });

    expect(updates).toHaveLength(1);
    expect(elementState).toMatchObject({
      link: {
        kind: "url",
        href: "https://example.com/guide?page=1#start",
      },
    });
  });

  it("rejects a URL with surrounding whitespace without changing canonical state", async () => {
    await act(async () => {
      mount(textElement());
    });

    await act(async () => {
      changeInput(urlInput(container, "text"), "  https://example.com  ");
    });

    await act(async () => {
      blurInput(urlInput(container, "text"));
    });

    expect(elementState).not.toHaveProperty("link");

    expect(urlInput(container, "text").value).toBe("");

    const message = container.querySelector("small");

    expect(message).not.toBeNull();
    expect(message?.textContent).toContain("HTTP or HTTPS");
  });

  it("commits a valid http URL for an Image element", async () => {
    await act(async () => {
      mount(imageElement());
    });

    await act(async () => {
      changeInput(urlInput(container, "image"), "http://example.com");
    });

    await act(async () => {
      blurInput(urlInput(container, "image"));
    });

    expect(elementState).toMatchObject({
      type: "image",
      link: {
        kind: "url",
        href: "http://example.com",
      },
    });
  });

  it("commits target _blank when New tab is selected", async () => {
    await act(async () => {
      mount(textElement());
    });

    await act(async () => {
      changeSelect(targetSelect(container, "text"), "new");
    });

    // Selecting a target alone never creates a link.
    expect(updates).toHaveLength(0);

    await act(async () => {
      changeInput(urlInput(container, "text"), "https://example.com");
    });

    await act(async () => {
      blurInput(urlInput(container, "text"));
    });

    expect(elementState).toMatchObject({
      link: {
        kind: "url",
        href: "https://example.com",
        target: "_blank",
      },
    });
  });

  it("does not alter the canonical link when an invalid URL is typed", async () => {
    const existingLink: ElementLink = {
      kind: "url",
      href: "https://example.com",
    };

    await act(async () => {
      mount(textElement({ link: existingLink }));
    });

    await act(async () => {
      changeInput(urlInput(container, "text"), "javascript:alert(1)");
    });

    await act(async () => {
      blurInput(urlInput(container, "text"));
    });

    expect(updates).toHaveLength(0);
    expect(elementState).toMatchObject({
      link: existingLink,
    });

    // The draft reverts to the previous canonical URL.
    expect(urlInput(container, "text").value).toBe("https://example.com");
  });

  it("shows a localized validation message for an invalid URL", async () => {
    await act(async () => {
      mount(textElement());
    });

    await act(async () => {
      changeInput(urlInput(container, "text"), "example.com");
    });

    await act(async () => {
      blurInput(urlInput(container, "text"));
    });

    const message = container.querySelector("small");

    expect(message).not.toBeNull();
    expect(message?.textContent).toContain("HTTP or HTTPS");
    expect(elementState).not.toHaveProperty("link");
  });

  it("Escape restores the URL draft from the canonical link", async () => {
    await act(async () => {
      mount(
        textElement({
          link: { kind: "url", href: "https://example.com/a" },
        }),
      );
    });

    await act(async () => {
      changeInput(urlInput(container, "text"), "https://stale.example.com");
    });

    await act(async () => {
      pressKey(urlInput(container, "text"), "Escape");
    });

    expect(urlInput(container, "text").value).toBe("https://example.com/a");
    expect(elementState).toMatchObject({
      link: { kind: "url", href: "https://example.com/a" },
    });
  });

  it("Enter commits the URL draft via blur", async () => {
    await act(async () => {
      mount(textElement());
    });

    await act(async () => {
      const input = urlInput(container, "text");

      changeInput(input, "https://example.com/enter");
    });

    await act(async () => {
      const input = urlInput(container, "text");

      input.focus();
      pressKey(input, "Enter");
    });

    expect(elementState).toMatchObject({
      link: { kind: "url", href: "https://example.com/enter" },
    });
  });

  it("Remove link deletes the canonical link and clears the draft", async () => {
    await act(async () => {
      mount(
        textElement({
          link: { kind: "url", href: "https://example.com", target: "_blank" },
        }),
      );
    });

    const removeButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Remove link"),
    );

    expect(removeButton).toBeDefined();

    await act(async () => {
      removeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(elementState).not.toHaveProperty("link");
    expect(urlInput(container, "text").value).toBe("");
    expect(targetSelect(container, "text").value).toBe("same");
  });

  it("updates the target of an existing canonical link to New tab", async () => {
    await act(async () => {
      mount(
        textElement({
          link: { kind: "url", href: "https://example.com" },
        }),
      );
    });

    await act(async () => {
      changeSelect(targetSelect(container, "text"), "new");
    });

    expect(elementState).toMatchObject({
      link: {
        kind: "url",
        href: "https://example.com",
        target: "_blank",
      },
    });
  });

  it("updates the target of an existing canonical link to Same tab", async () => {
    await act(async () => {
      mount(
        textElement({
          link: {
            kind: "url",
            href: "https://example.com",
            target: "_blank",
          },
        }),
      );
    });

    await act(async () => {
      changeSelect(targetSelect(container, "text"), "same");
    });

    expect(elementState).toMatchObject({
      link: {
        kind: "url",
        href: "https://example.com",
      },
    });

    expect(elementState.link).not.toHaveProperty("target");
  });

  it("hydrates the form from an existing canonical link", async () => {
    await act(async () => {
      mount(
        textElement({
          link: {
            kind: "url",
            href: "https://example.com/hydrated",
            target: "_blank",
          },
        }),
      );
    });

    expect(urlInput(container, "text").value).toBe(
      "https://example.com/hydrated",
    );

    expect(targetSelect(container, "text").value).toBe("new");
  });

  it("does not leak a URL draft when the selected element changes", async () => {
    await act(async () => {
      mount(
        textElement({
          link: { kind: "url", href: "https://example.com/a" },
        }),
      );
    });

    await act(async () => {
      changeInput(urlInput(container, "text"), "https://stale.example.com");
    });

    expect(urlInput(container, "text").value).toBe("https://stale.example.com");

    // Simulate ElementInspector switching to a different selected
    // element without remounting the section.
    await act(async () => {
      mount(
        textElement({
          id: "text-2",
        }),
      );
    });

    expect(urlInput(container, "text").value).toBe("");
    expect(targetSelect(container, "text").value).toBe("same");
  });

  it("removes the canonical link when the URL field is cleared", async () => {
    await act(async () => {
      mount(
        textElement({
          link: {
            kind: "url",
            href: "https://example.com",
            target: "_blank",
          },
        }),
      );
    });

    await act(async () => {
      changeInput(urlInput(container, "text"), "");
    });

    await act(async () => {
      blurInput(urlInput(container, "text"));
    });

    expect(elementState).not.toHaveProperty("link");
    expect(urlInput(container, "text").value).toBe("");
    expect(targetSelect(container, "text").value).toBe("same");

    expect(container.querySelector("small")).toBeNull();
  });

  it("preserves the local draft when the canonical link object is recreated with equal values", async () => {
    await act(async () => {
      mount(
        textElement({
          link: {
            kind: "url",
            href: "https://example.com",
            target: "_blank",
          },
        }),
      );
    });

    await act(async () => {
      changeInput(urlInput(container, "text"), "https://draft.example.com");
    });

    expect(urlInput(container, "text").value).toBe("https://draft.example.com");

    await act(async () => {
      mount(
        textElement({
          link: {
            kind: "url",
            href: "https://example.com",
            target: "_blank",
          },
        }),
      );
    });

    expect(urlInput(container, "text").value).toBe("https://draft.example.com");
  });

  it("rehydrates the form when the canonical href actually changes", async () => {
    await act(async () => {
      mount(
        textElement({
          link: {
            kind: "url",
            href: "https://example.com/old",
          },
        }),
      );
    });

    await act(async () => {
      changeInput(urlInput(container, "text"), "https://draft.example.com");
    });

    await act(async () => {
      mount(
        textElement({
          link: {
            kind: "url",
            href: "https://example.com/new",
          },
        }),
      );
    });

    expect(urlInput(container, "text").value).toBe("https://example.com/new");
  });

  it("mounting the section for an Image writes no canonical link", async () => {
    await act(async () => {
      mount(imageElement());
    });

    expect(updates).toHaveLength(0);
    expect(elementState).not.toHaveProperty("link");
  });

  it("commits a valid Image URL as a canonical link on blur", async () => {
    await act(async () => {
      mount(imageElement());
    });

    await act(async () => {
      changeInput(
        urlInput(container, "image"),
        "https://example.com/photo?size=large",
      );
    });

    await act(async () => {
      blurInput(urlInput(container, "image"));
    });

    expect(updates).toHaveLength(1);
    expect(elementState).toMatchObject({
      type: "image",
      link: {
        kind: "url",
        href: "https://example.com/photo?size=large",
      },
    });
  });

  it("does not write an invalid URL to the canonical Image element", async () => {
    await act(async () => {
      mount(imageElement());
    });

    await act(async () => {
      changeInput(urlInput(container, "image"), "javascript:alert(1)");
    });

    await act(async () => {
      blurInput(urlInput(container, "image"));
    });

    expect(elementState).not.toHaveProperty("link");
    expect(urlInput(container, "image").value).toBe("");
  });

  it("commits an Image link with target _blank when New tab is selected", async () => {
    await act(async () => {
      mount(imageElement());
    });

    await act(async () => {
      changeSelect(targetSelect(container, "image"), "new");
    });

    // Selecting a target alone never creates a link.
    expect(updates).toHaveLength(0);

    await act(async () => {
      changeInput(urlInput(container, "image"), "https://example.com");
    });

    await act(async () => {
      blurInput(urlInput(container, "image"));
    });

    expect(elementState).toMatchObject({
      type: "image",
      link: {
        kind: "url",
        href: "https://example.com",
        target: "_blank",
      },
    });
  });

  it("removes the canonical link from an Image element via the remove action", async () => {
    await act(async () => {
      mount(
        imageElement({
          link: {
            kind: "url",
            href: "https://example.com",
            target: "_blank",
          },
        }),
      );
    });

    const removeButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Remove link"),
    );

    expect(removeButton).toBeDefined();

    await act(async () => {
      removeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(elementState).not.toHaveProperty("link");
    expect(urlInput(container, "image").value).toBe("");
    expect(targetSelect(container, "image").value).toBe("same");
  });

  it("clears the Image canonical link when the URL field is cleared", async () => {
    await act(async () => {
      mount(
        imageElement({
          link: {
            kind: "url",
            href: "https://example.com",
          },
        }),
      );
    });

    await act(async () => {
      changeInput(urlInput(container, "image"), "");
    });

    await act(async () => {
      blurInput(urlInput(container, "image"));
    });

    expect(elementState).not.toHaveProperty("link");
    expect(urlInput(container, "image").value).toBe("");
  });

  it("updates the target of an existing Image canonical link", async () => {
    await act(async () => {
      mount(
        imageElement({
          link: {
            kind: "url",
            href: "https://example.com",
          },
        }),
      );
    });

    await act(async () => {
      changeSelect(targetSelect(container, "image"), "new");
    });

    expect(elementState).toMatchObject({
      type: "image",
      link: {
        kind: "url",
        href: "https://example.com",
        target: "_blank",
      },
    });
  });

  it("hydrates the Image form from an existing canonical link", async () => {
    await act(async () => {
      mount(
        imageElement({
          link: {
            kind: "url",
            href: "https://example.com/hydrated",
            target: "_blank",
          },
        }),
      );
    });

    expect(urlInput(container, "image").value).toBe(
      "https://example.com/hydrated",
    );

    expect(targetSelect(container, "image").value).toBe("new");
  });

  it("mounting the section for a Container writes no canonical link", async () => {
    await act(async () => {
      mount(containerElement());
    });

    expect(updates).toHaveLength(0);
    expect(elementState).not.toHaveProperty("link");
  });

  it("commits a valid Container URL as a canonical link on blur", async () => {
    await act(async () => {
      mount(containerElement());
    });

    await act(async () => {
      changeInput(
        urlInput(container, "container"),
        "https://example.com/hero-section",
      );
    });

    await act(async () => {
      blurInput(urlInput(container, "container"));
    });

    expect(updates).toHaveLength(1);
    expect(elementState).toMatchObject({
      type: "container",
      link: {
        kind: "url",
        href: "https://example.com/hero-section",
      },
    });
  });

  it("rejects a whitespace-padded Container URL without changing canonical state", async () => {
    await act(async () => {
      mount(containerElement());
    });

    await act(async () => {
      changeInput(
        urlInput(container, "container"),
        "  https://example.com  ",
      );
    });

    await act(async () => {
      blurInput(urlInput(container, "container"));
    });

    expect(elementState).not.toHaveProperty("link");
    expect(urlInput(container, "container").value).toBe("");
  });

  it("does not write an invalid URL to the canonical Container element", async () => {
    await act(async () => {
      mount(containerElement());
    });

    await act(async () => {
      changeInput(urlInput(container, "container"), "javascript:alert(1)");
    });

    await act(async () => {
      blurInput(urlInput(container, "container"));
    });

    expect(elementState).not.toHaveProperty("link");
    expect(urlInput(container, "container").value).toBe("");
  });

  it("does not create a Container link from target selection alone", async () => {
    await act(async () => {
      mount(containerElement());
    });

    await act(async () => {
      changeSelect(targetSelect(container, "container"), "new");
    });

    expect(updates).toHaveLength(0);
    expect(elementState).not.toHaveProperty("link");

    await act(async () => {
      changeInput(urlInput(container, "container"), "https://example.com");
    });

    await act(async () => {
      blurInput(urlInput(container, "container"));
    });

    expect(elementState).toMatchObject({
      type: "container",
      link: {
        kind: "url",
        href: "https://example.com",
        target: "_blank",
      },
    });
  });

  it("removes the canonical link from a Container via the remove action", async () => {
    await act(async () => {
      mount(
        containerElement({
          link: {
            kind: "url",
            href: "https://example.com",
            target: "_blank",
          },
        }),
      );
    });

    const removeButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Remove link"),
    );

    expect(removeButton).toBeDefined();

    await act(async () => {
      removeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(elementState).not.toHaveProperty("link");
    expect(urlInput(container, "container").value).toBe("");
    expect(targetSelect(container, "container").value).toBe("same");
  });

  it("clears the Container canonical link when the URL field is cleared", async () => {
    await act(async () => {
      mount(
        containerElement({
          link: {
            kind: "url",
            href: "https://example.com",
          },
        }),
      );
    });

    await act(async () => {
      changeInput(urlInput(container, "container"), "");
    });

    await act(async () => {
      blurInput(urlInput(container, "container"));
    });

    expect(elementState).not.toHaveProperty("link");
    expect(urlInput(container, "container").value).toBe("");
  });

  it("updates the target of an existing Container canonical link", async () => {
    await act(async () => {
      mount(
        containerElement({
          link: {
            kind: "url",
            href: "https://example.com",
          },
        }),
      );
    });

    await act(async () => {
      changeSelect(targetSelect(container, "container"), "new");
    });

    expect(elementState).toMatchObject({
      type: "container",
      link: {
        kind: "url",
        href: "https://example.com",
        target: "_blank",
      },
    });
  });

  it("hydrates the Container form from an existing canonical link", async () => {
    await act(async () => {
      mount(
        containerElement({
          link: {
            kind: "url",
            href: "https://example.com/hydrated",
            target: "_blank",
          },
        }),
      );
    });

    expect(urlInput(container, "container").value).toBe(
      "https://example.com/hydrated",
    );

    expect(targetSelect(container, "container").value).toBe("new");
  });

  it("preserves the local draft when the Container link is recreated with equal values", async () => {
    await act(async () => {
      mount(
        containerElement({
          link: {
            kind: "url",
            href: "https://example.com",
            target: "_blank",
          },
        }),
      );
    });

    await act(async () => {
      changeInput(
        urlInput(container, "container"),
        "https://draft.example.com",
      );
    });

    expect(urlInput(container, "container").value).toBe(
      "https://draft.example.com",
    );

    await act(async () => {
      mount(
        containerElement({
          link: {
            kind: "url",
            href: "https://example.com",
            target: "_blank",
          },
        }),
      );
    });

    expect(urlInput(container, "container").value).toBe(
      "https://draft.example.com",
    );
  });

  it("rehydrates the Container form when the canonical href actually changes", async () => {
    await act(async () => {
      mount(
        containerElement({
          link: {
            kind: "url",
            href: "https://example.com/old",
          },
        }),
      );
    });

    await act(async () => {
      changeInput(
        urlInput(container, "container"),
        "https://draft.example.com",
      );
    });

    await act(async () => {
      mount(
        containerElement({
          link: {
            kind: "url",
            href: "https://example.com/new",
          },
        }),
      );
    });

    expect(urlInput(container, "container").value).toBe(
      "https://example.com/new",
    );
  });
});

describe("shared Interaction control in inspectors", () => {
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

  it("TextInspector renders the Interaction section", async () => {
    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <TextInspector
            element={textElement()}
            onUpdate={() => {}}
            fontResources={FONT_RESOURCES}
          />
        </StudioI18nProvider>,
      );
    });

    expect(urlInput(container, "text")).toBeDefined();
    expect(targetSelect(container, "text")).toBeDefined();
  });

  it("ImageInspector renders the same Interaction section", async () => {
    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <ImageInspector
            element={imageElement()}
            onUpdate={() => {}}
            preserveImageProportion={false}
            onPreserveImageProportionChange={() => {}}
            focalEditing={false}
            onFocalEditingChange={() => {}}
          />
        </StudioI18nProvider>,
      );
    });

    expect(urlInput(container, "image")).toBeDefined();
    expect(targetSelect(container, "image")).toBeDefined();
  });

  it("ImageInspector writes canonical style, layout, and effect responsibilities", async () => {
    const initial = imageElement();
    let updated: ImageElement = initial;

    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <ImageInspector
            element={initial}
            onUpdate={(update) => {
              const next = update(initial);
              if (next.type === "image") updated = next;
            }}
            preserveImageProportion={false}
            onPreserveImageProportionChange={() => {}}
            focalEditing={false}
            onFocalEditingChange={() => {}}
          />
        </StudioI18nProvider>,
      );
    });

    await act(async () => {
      changeInput(container.querySelector<HTMLInputElement>("#image-width")!, "60");
    });
    expect(updated.layout?.width).toBe("60%");
    expect(updated.style ?? {}).not.toHaveProperty("width");

    await act(async () => {
      changeInput(container.querySelector<HTMLInputElement>("#image-height")!, "240");
    });
    expect(updated.layout?.height).toBe(240);
    expect(updated.style ?? {}).not.toHaveProperty("height");

    await act(async () => {
      changeInput(container.querySelector<HTMLInputElement>("#image-border-radius")!, "8");
    });
    expect(updated.style?.borderRadius).toBe(8);
    expect(updated.style ?? {}).not.toHaveProperty("opacity");

    await act(async () => {
      changeSelect(container.querySelector<HTMLSelectElement>("#image-border-style")!, "solid");
    });
    expect(updated.style?.border).toBeDefined();
    expect(updated.style).not.toHaveProperty("width");

    await act(async () => {
      changeInput(container.querySelector<HTMLInputElement>("#image-opacity")!, "80");
    });
    expect(updated.effect?.opacity).toBe(0.8);
    expect(updated.style ?? {}).not.toHaveProperty("opacity");

    await act(async () => {
      changeSelect(container.querySelector<HTMLSelectElement>("#image-shadow-mode")!, "outer");
    });
    expect(updated.effect?.shadow).toBeDefined();
    expect(updated.style ?? {}).not.toHaveProperty("shadow");
  });

  it("ContainerInspector renders the same Interaction section", async () => {
    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <ContainerInspector
            element={containerElement()}
            onUpdate={() => {}}
            onContainerFitModeChange={() => true}
          />
        </StudioI18nProvider>,
      );
    });

    expect(urlInput(container, "container")).toBeDefined();
    expect(targetSelect(container, "container")).toBeDefined();
  });
});
