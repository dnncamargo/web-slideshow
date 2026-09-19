// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  PresentationSchema,
  type EmbedElement,
  type Presentation,
} from "@powershow/document-schema";

import { AuthoringHistoryContext } from "../src/features/editor/authoring-history-context";
import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { EmbedInspector } from "../src/features/editor/inspector/embed-inspector";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const EMBED_ID = "cp4c3b-embed";

function embedElement(
  overrides: Partial<Omit<EmbedElement, "type">> = {},
): EmbedElement {
  return {
    id: EMBED_ID,
    type: "embed",
    hidden: false,
    src: "https://example.com/",
    title: "Embedded content",
    ...overrides,
  };
}

function presentation(element = embedElement()): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "cp4c3b-embed-content-history",
    title: "CP4C3B Embed content history",
    slides: [{
      id: "slide-1",
      title: "Slide 1",
      elements: [element],
    }],
  });
}

function key(value: string, options: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent("keydown", {
    key: value,
    bubbles: true,
    cancelable: true,
    ...options,
  });
}

function setInputValue(control: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  if (!setter) throw new Error("expected HTMLInputElement.value setter");
  setter.call(control, value);
  control.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("CP4C3B Embed src/title history", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  async function mount(initial = presentation()): Promise<void> {
    await act(async () => root.render(
      <StudioI18nProvider>
        <EditorWorkspace initialPresentation={initial} />
      </StudioI18nProvider>,
    ));
  }

  async function selectEmbed(id = EMBED_ID): Promise<void> {
    const element = host.querySelector<HTMLElement>(
      `[data-powershow-id="${id}"]`,
    );
    if (!element) throw new Error(`Embed ${id} was not rendered`);
    await act(async () => {
      element.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
  }

  function input(id: "src" | "title"): HTMLInputElement {
    const control = host.querySelector<HTMLInputElement>(`#embed-${id}`);
    if (!control) throw new Error(`Embed ${id} input was not rendered`);
    return control;
  }

  async function undo(options: KeyboardEventInit = {}): Promise<KeyboardEvent> {
    const event = key("z", { ctrlKey: true, ...options });
    await act(async () => window.dispatchEvent(event));
    return event;
  }

  async function redo(): Promise<KeyboardEvent> {
    return undo({ shiftKey: true });
  }

  async function editAndBlur(
    id: "src" | "title",
    value: string,
  ): Promise<void> {
    const control = input(id);
    await act(async () => {
      control.focus();
      setInputValue(control, value);
      control.blur();
    });
  }

  it("keeps src draft typing local until blur", async () => {
    await mount();
    await selectEmbed();

    await act(async () => {
      input("src").focus();
      setInputValue(input("src"), "https://draft.example.com/");
    });

    expect(input("src").value).toBe("https://draft.example.com/");
    const undoEvent = await undo();
    expect(undoEvent.defaultPrevented).toBe(false);
    expect(input("src").value).toBe("https://draft.example.com/");
  });

  it("tracks a changed src as one text edit and replays Undo/Redo", async () => {
    await mount();
    await selectEmbed();

    await editAndBlur("src", "https://player.example.com/demo");
    expect(input("src").value).toBe("https://player.example.com/demo");

    const undoEvent = await undo();
    expect(undoEvent.defaultPrevented).toBe(true);
    expect(input("src").value).toBe("https://example.com/");

    const redoEvent = await redo();
    expect(redoEvent.defaultPrevented).toBe(true);
    expect(input("src").value).toBe("https://player.example.com/demo");
  });

  it("uses Enter as the single src blur commit path", async () => {
    await mount();
    await selectEmbed();
    const control = input("src");

    await act(async () => {
      control.focus();
      setInputValue(control, "https://player.example.com/demo");
      control.dispatchEvent(key("Enter"));
    });

    expect(control.value).toBe("https://player.example.com/demo");
    expect((await undo()).defaultPrevented).toBe(true);
    expect(control.value).toBe("https://example.com/");
    expect((await undo()).defaultPrevented).toBe(false);
  });

  it("does not create history for a same-value src draft", async () => {
    await mount();
    await selectEmbed();

    await editAndBlur("src", "https://example.com/");
    const undoEvent = await undo();
    expect(undoEvent.defaultPrevented).toBe(false);
    expect(input("src").value).toBe("https://example.com/");
  });

  it.each([
    "javascript:alert(1)",
    " https://example.com/",
    "https://example.com/ ",
  ])("rejects invalid src %j without history", async (value) => {
    await mount();
    await selectEmbed();

    await editAndBlur("src", value);
    expect(input("src").value).toBe("https://example.com/");
    expect(host.textContent).toContain("Enter a valid absolute HTTP or HTTPS URL.");
    expect((await undo()).defaultPrevented).toBe(false);
  });

  it("keeps Escape local for src, including a later blur", async () => {
    await mount();
    await selectEmbed();
    const control = input("src");

    await act(async () => {
      control.focus();
      setInputValue(control, "https://draft.example.com/");
      control.dispatchEvent(key("Escape"));
    });
    expect(control.value).toBe("https://example.com/");

    await act(async () => control.blur());
    expect((await undo()).defaultPrevented).toBe(false);
  });

  it("keeps title draft typing local until blur", async () => {
    await mount();
    await selectEmbed();

    await act(async () => {
      input("title").focus();
      setInputValue(input("title"), "Quarterly results");
    });

    expect(input("title").value).toBe("Quarterly results");
    expect((await undo()).defaultPrevented).toBe(false);
    expect(input("title").value).toBe("Quarterly results");
  });

  it("tracks a changed title as one text edit and replays Undo/Redo", async () => {
    await mount();
    await selectEmbed();

    await editAndBlur("title", "Quarterly results");
    expect((await undo()).defaultPrevented).toBe(true);
    expect(input("title").value).toBe("Embedded content");
    expect((await redo()).defaultPrevented).toBe(true);
    expect(input("title").value).toBe("Quarterly results");
  });

  it("uses Enter as the single title blur commit path", async () => {
    await mount();
    await selectEmbed();
    const control = input("title");

    await act(async () => {
      control.focus();
      setInputValue(control, "Quarterly results");
      control.dispatchEvent(key("Enter"));
    });

    expect((await undo()).defaultPrevented).toBe(true);
    expect(control.value).toBe("Embedded content");
    expect((await undo()).defaultPrevented).toBe(false);
  });

  it("does not create history for a same-value title draft", async () => {
    await mount();
    await selectEmbed();

    await editAndBlur("title", "Embedded content");
    expect((await undo()).defaultPrevented).toBe(false);
  });

  it("rejects an empty title without history and restores the draft", async () => {
    await mount();
    await selectEmbed();

    await editAndBlur("title", "");
    expect(input("title").value).toBe("Embedded content");
    expect(host.textContent).toContain("Enter a title.");
    expect((await undo()).defaultPrevented).toBe(false);
  });

  it("accepts a whitespace-only title as an exact text edit", async () => {
    await mount();
    await selectEmbed();

    await editAndBlur("title", "   ");
    expect(input("title").value).toBe("   ");
    expect((await undo()).defaultPrevented).toBe(true);
    expect(input("title").value).toBe("Embedded content");
  });

  it("keeps Escape local for title, including a later blur", async () => {
    await mount();
    await selectEmbed();
    const control = input("title");

    await act(async () => {
      control.focus();
      setInputValue(control, "Quarterly results");
      control.dispatchEvent(key("Escape"));
    });
    expect(control.value).toBe("Embedded content");

    await act(async () => control.blur());
    expect((await undo()).defaultPrevented).toBe(false);
  });

  it("keeps src and title commits as separate actions and leaves viewport history independent", async () => {
    await mount(presentation(embedElement({ viewport: { top: 20 } })));
    await selectEmbed();

    const viewport = host.querySelector<HTMLInputElement>("#embed-viewport-top");
    if (!viewport) throw new Error("Embed viewport input was not rendered");
    await act(async () => {
      viewport.focus();
      setInputValue(viewport, "30");
      viewport.blur();
    });
    await editAndBlur("src", "https://player.example.com/demo");
    await editAndBlur("title", "Quarterly results");

    await undo();
    expect(input("title").value).toBe("Embedded content");
    expect(input("src").value).toBe("https://player.example.com/demo");
    expect(viewport.value).toBe("30");

    await undo();
    expect(input("src").value).toBe("https://example.com/");
    expect(viewport.value).toBe("30");

    await undo();
    expect(viewport.value).toBe("20");
  });

  it("hydrates src, title, and messages when selection changes without history", async () => {
    const second = embedElement({
      id: "cp4c3b-embed-2",
      src: "https://second.example.com/",
      title: "Second embed",
    });
    await mount(PresentationSchema.parse({
      schemaVersion: 1,
      id: "cp4c3b-selection-hydration",
      title: "Selection hydration",
      slides: [{
        id: "slide-1",
        title: "Slide 1",
        elements: [embedElement(), second],
      }],
    }));
    await selectEmbed(EMBED_ID);

    await act(async () => {
      input("src").focus();
      setInputValue(input("src"), "javascript:alert(1)");
      input("title").focus();
      setInputValue(input("title"), "Dirty draft");
    });
    expect(input("title").value).toBe("Dirty draft");

    await selectEmbed("cp4c3b-embed-2");
    expect(input("src").value).toBe("https://second.example.com/");
    expect(input("title").value).toBe("Second embed");
    expect(host.textContent).not.toContain("Enter a valid absolute HTTP or HTTPS URL.");
    expect((await undo()).defaultPrevented).toBe(false);
  });

  it("uses the required text-edit metadata and preserves provider-absent updates", async () => {
    let element = embedElement();
    let updateCount = 0;
    const metas: Array<{ kind: string; labelKey: string }> = [];

    await act(async () => root.render(
      <StudioI18nProvider>
        <AuthoringHistoryContext.Provider value={{
          begin: () => undefined,
          update: (_key, callback) => callback(),
          finish: () => undefined,
          discrete: (meta, callback) => {
            metas.push(meta);
            callback();
          },
        }}>
          <EmbedInspector
            element={element}
            onUpdate={(update) => {
              updateCount += 1;
              const next = update(element);
              if (next.type === "embed") element = next;
            }}
          />
        </AuthoringHistoryContext.Provider>
      </StudioI18nProvider>,
    ));

    await act(async () => {
      host.querySelector<HTMLInputElement>("#embed-src")!.focus();
      setInputValue(host.querySelector<HTMLInputElement>("#embed-src")!, "https://player.example.com/demo");
      host.querySelector<HTMLInputElement>("#embed-src")!.blur();
    });
    expect(element.src).toBe("https://player.example.com/demo");
    expect(metas).toEqual([{ kind: "text.edit", labelKey: "history.text.edit" }]);

    await act(async () => root.render(
      <StudioI18nProvider>
        <AuthoringHistoryContext.Provider value={{
          begin: () => undefined,
          update: (_key, callback) => callback(),
          finish: () => undefined,
          discrete: (meta, callback) => {
            metas.push(meta);
            callback();
          },
        }}>
          <EmbedInspector
            element={element}
            onUpdate={(update) => {
              updateCount += 1;
              const next = update(element);
              if (next.type === "embed") element = next;
            }}
          />
        </AuthoringHistoryContext.Provider>
      </StudioI18nProvider>,
    ));
    await act(async () => {
      const control = host.querySelector<HTMLInputElement>("#embed-title")!;
      control.focus();
      setInputValue(control, "Quarterly results");
      control.blur();
    });
    expect(element.title).toBe("Quarterly results");
    expect(metas).toEqual([
      { kind: "text.edit", labelKey: "history.text.edit" },
      { kind: "text.edit", labelKey: "history.text.edit" },
    ]);
    expect(updateCount).toBe(2);
  });

  it("supports changed commits without a History provider and keeps no-ops local", async () => {
    let element = embedElement();
    let updateCount = 0;

    await act(async () => root.render(
      <StudioI18nProvider>
        <EmbedInspector
          element={element}
          onUpdate={(update) => {
            updateCount += 1;
            const next = update(element);
            if (next.type === "embed") element = next;
          }}
        />
      </StudioI18nProvider>,
    ));

    const src = host.querySelector<HTMLInputElement>("#embed-src")!;
    await act(async () => {
      src.focus();
      setInputValue(src, "https://player.example.com/demo");
      src.blur();
    });
    expect(element.src).toBe("https://player.example.com/demo");

    await act(async () => root.render(
      <StudioI18nProvider>
        <EmbedInspector
          element={element}
          onUpdate={(update) => {
            updateCount += 1;
            const next = update(element);
            if (next.type === "embed") element = next;
          }}
        />
      </StudioI18nProvider>,
    ));
    const title = host.querySelector<HTMLInputElement>("#embed-title")!;
    await act(async () => {
      title.focus();
      setInputValue(title, "Quarterly results");
      title.blur();
    });
    expect(element.title).toBe("Quarterly results");
    expect(updateCount).toBe(2);
  });
});
