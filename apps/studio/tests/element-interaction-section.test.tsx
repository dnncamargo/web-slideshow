// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ElementLink,
  PowerShowElement,
  TextboxElement,
  TextElement,
} from "@powershow/document-schema";

import type { FontResourceControls } from "../src/features/editor/inspector/inspector-types";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";
import { TextInspector } from "../src/features/editor/inspector/text-inspector";
import { TextboxInspector } from "../src/features/editor/inspector/textbox-inspector";
import { ElementInteractionSection } from "../src/features/editor/inspector/sections/element-interaction-section";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const FONT_RESOURCES: FontResourceControls = {
  fontResources: [],
  onAddFontFace: vi.fn(),
  onRemoveFontFace: vi.fn(),
  isFontFamilyInUse: () => false,
};

type LinkableElement = Extract<PowerShowElement, { type: "text" | "textbox" }>;

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

function textboxElement(
  overrides: Partial<Omit<TextboxElement, "type" | "hidden">> = {},
): TextboxElement {
  return {
    type: "textbox",
    id: "textbox-1",
    hidden: false,
    content: "A highlighted explanation",
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
          controlPrefix={elementState.type === "text" ? "text" : "textbox"}
          onUpdate={(update) => {
            const next = update(elementState);

            if (next.type !== "text" && next.type !== "textbox") {
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

  it("commits a valid http URL for a Textbox element", async () => {
    await act(async () => {
      mount(textboxElement());
    });

    await act(async () => {
      changeInput(urlInput(container, "textbox"), "http://example.com");
    });

    await act(async () => {
      blurInput(urlInput(container, "textbox"));
    });

    expect(elementState).toMatchObject({
      type: "textbox",
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
            fontResourceControls={FONT_RESOURCES}
          />
        </StudioI18nProvider>,
      );
    });

    expect(urlInput(container, "text")).toBeDefined();
    expect(targetSelect(container, "text")).toBeDefined();
  });

  it("TextboxInspector renders the same Interaction section", async () => {
    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <TextboxInspector
            element={textboxElement()}
            onUpdate={() => {}}
            fontResourceControls={FONT_RESOURCES}
          />
        </StudioI18nProvider>,
      );
    });

    expect(urlInput(container, "textbox")).toBeDefined();
    expect(targetSelect(container, "textbox")).toBeDefined();
  });
});
