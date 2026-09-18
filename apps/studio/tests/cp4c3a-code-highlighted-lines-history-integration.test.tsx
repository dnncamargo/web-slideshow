// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PresentationSchema, type CodeElement, type Presentation } from "@powershow/document-schema";

import { AuthoringHistoryContext } from "../src/features/editor/authoring-history-context";
import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { CodeInspector } from "../src/features/editor/inspector/code-inspector";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const CODE_ID = "cp4c3a-code";
const INITIAL_CODE = "one\ntwo\nthree\nfour\nfive\nsix\nseven";

function presentation(highlightedLines: number[] = [1, 3]): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "cp4c3a-code-highlighted-lines-history",
    title: "CP4C3A Code highlighted lines history",
    slides: [{
      id: "slide-1",
      title: "Slide 1",
      elements: [{
        id: CODE_ID,
        type: "code",
        hidden: false,
        code: INITIAL_CODE,
        language: "typescript",
        showLineNumbers: true,
        highlightedLines,
      }],
    }],
  });
}

function codeElement(highlightedLines: number[] = [1, 3]): CodeElement {
  return presentation(highlightedLines).slides[0]!.elements[0]! as CodeElement;
}

function key(value: string, options: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent("keydown", { key: value, bubbles: true, cancelable: true, ...options });
}

function setTextValue(control: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (!setter) throw new Error("expected HTMLInputElement.value setter");
  setter.call(control, value);
  control.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("CP4C3A Code highlighted lines history", () => {
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

  async function selectCode(): Promise<void> {
    const canvasElement = host.querySelector<HTMLElement>(`[data-powershow-id="${CODE_ID}"]`);
    if (!canvasElement) throw new Error("code element was not rendered");
    await act(async () => canvasElement.dispatchEvent(new Event("pointerdown", { bubbles: true })));
  }

  function input(id = "code-highlighted-lines"): HTMLInputElement {
    const control = host.querySelector<HTMLInputElement>(`#${id}`);
    if (!control) throw new Error(`input ${id} was not rendered`);
    return control;
  }

  function highlightedLineNumbers(): number[] {
    return Array.from(host.querySelectorAll<HTMLElement>(".powershow-code-line-highlighted"))
      .map((line) => Number(line.dataset.line));
  }

  async function undo(): Promise<KeyboardEvent> {
    const event = key("z", { ctrlKey: true });
    await act(async () => window.dispatchEvent(event));
    return event;
  }

  async function redo(): Promise<KeyboardEvent> {
    const event = key("z", { ctrlKey: true, shiftKey: true });
    await act(async () => window.dispatchEvent(event));
    return event;
  }

  it("keeps draft typing out of the canonical presentation until blur, then supports undo and redo", async () => {
    await mount();
    await selectCode();
    const control = input();

    await act(async () => {
      control.focus();
      setTextValue(control, "2, 4, 6");
    });
    expect(control.value).toBe("2, 4, 6");
    expect(highlightedLineNumbers()).toEqual([1, 3]);

    await act(async () => control.blur());
    expect(highlightedLineNumbers()).toEqual([2, 4, 6]);

    const undoEvent = await undo();
    expect(undoEvent.defaultPrevented).toBe(true);
    expect(highlightedLineNumbers()).toEqual([1, 3]);

    const redoEvent = await redo();
    expect(redoEvent.defaultPrevented).toBe(true);
    expect(highlightedLineNumbers()).toEqual([2, 4, 6]);
  });

  it("uses blur as the single Enter commit path", async () => {
    await mount();
    await selectCode();
    const control = input();

    await act(async () => {
      control.focus();
      setTextValue(control, "2, 4, 6");
      control.dispatchEvent(key("Enter"));
    });
    expect(highlightedLineNumbers()).toEqual([2, 4, 6]);

    await undo();
    expect(highlightedLineNumbers()).toEqual([1, 3]);
    const secondUndo = await undo();
    expect(secondUndo.defaultPrevented).toBe(false);
    expect(highlightedLineNumbers()).toEqual([1, 3]);
  });

  it("normalizes a different draft representation without creating history", async () => {
    await mount(presentation([1, 3, 5]));
    await selectCode();
    const control = input();

    await act(async () => {
      control.focus();
      setTextValue(control, "5, 1, 3, 3");
    });
    await act(async () => control.blur());

    expect(control.value).toBe("1, 3, 5");
    expect(highlightedLineNumbers()).toEqual([1, 3, 5]);
    const undoEvent = await undo();
    expect(undoEvent.defaultPrevented).toBe(false);
  });

  it("normalizes invalid tokens without creating history when the canonical candidate is unchanged", async () => {
    await mount(presentation([1, 7]));
    await selectCode();
    const control = input();

    await act(async () => {
      control.focus();
      setTextValue(control, "1; nope; 4.5; -2; 7");
    });
    await act(async () => control.blur());

    expect(control.value).toBe("1, 7");
    expect(highlightedLineNumbers()).toEqual([1, 7]);
    const undoEvent = await undo();
    expect(undoEvent.defaultPrevented).toBe(false);
  });

  it("tracks clearing as a real [] action and keeps [] to [] a no-op", async () => {
    await mount(presentation([2, 4]));
    await selectCode();
    const control = input();

    await act(async () => {
      control.focus();
      setTextValue(control, "");
    });
    await act(async () => control.blur());
    expect(highlightedLineNumbers()).toEqual([]);
    await undo();
    expect(highlightedLineNumbers()).toEqual([2, 4]);
    await redo();
    expect(highlightedLineNumbers()).toEqual([]);
  });

  it("does not create history for an empty draft when the canonical value is already []", async () => {
    await mount(presentation([]));
    await selectCode();
    const control = input();
    await act(async () => {
      control.focus();
      setTextValue(control, "");
    });
    await act(async () => control.blur());
    const undoEvent = await undo();
    expect(undoEvent.defaultPrevented).toBe(false);
  });

  it("keeps highlighted-lines history separate from Code language history", async () => {
    await mount();
    await selectCode();
    const language = input("code-language");
    const highlightedLines = input();

    await act(async () => {
      language.focus();
      setTextValue(language, "python");
      language.blur();
      highlightedLines.focus();
      setTextValue(highlightedLines, "2, 4");
      highlightedLines.blur();
    });

    await undo();
    expect(highlightedLineNumbers()).toEqual([1, 3]);
    expect(language.value).toBe("python");
    await undo();
    expect(language.value).toBe("typescript");
  });

  it("uses the required discrete metadata for a real canonical change", async () => {
    let code = codeElement();
    const metas: Array<{ kind: string; labelKey: string; labelParams?: Readonly<Record<string, string | number>> }> = [];

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
          <CodeInspector element={code} onUpdate={(update) => { code = update(code) as CodeElement; }} />
        </AuthoringHistoryContext.Provider>
      </StudioI18nProvider>,
    ));

    await act(async () => {
      const control = input();
      control.focus();
      setTextValue(control, "2, 4");
    });
    await act(async () => input().blur());

    expect(metas).toEqual([{
      kind: "element.setting",
      labelKey: "history.element.setting",
      labelParams: { setting: "code.highlightedLines" },
    }]);
    expect(code.highlightedLines).toEqual([2, 4]);
  });

  it("preserves provider-absent direct-update compatibility and canonical no-ops", async () => {
    let code = codeElement();
    let updateCount = 0;

    await act(async () => root.render(
      <StudioI18nProvider>
        <CodeInspector
          element={code}
          onUpdate={(update) => {
            updateCount += 1;
            code = update(code) as CodeElement;
          }}
        />
      </StudioI18nProvider>,
    ));

    const control = input();
    await act(async () => {
      control.focus();
      setTextValue(control, "2, 4");
    });
    expect(code.highlightedLines).toEqual([1, 3]);
    expect(updateCount).toBe(0);

    await act(async () => control.blur());
    expect(code.highlightedLines).toEqual([2, 4]);
    expect(updateCount).toBe(1);

    await act(async () => root.render(
      <StudioI18nProvider>
        <CodeInspector
          element={code}
          onUpdate={(update) => {
            updateCount += 1;
            code = update(code) as CodeElement;
          }}
        />
      </StudioI18nProvider>,
    ));
    await act(async () => {
      const currentControl = input();
      currentControl.focus();
      setTextValue(currentControl, "4, 2");
    });
    await act(async () => input().blur());
    expect(code.highlightedLines).toEqual([2, 4]);
    expect(updateCount).toBe(1);
  });
});
