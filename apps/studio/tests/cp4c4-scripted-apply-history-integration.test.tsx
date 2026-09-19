// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  PresentationSchema,
  type Presentation,
  type ScriptedElement,
} from "@web-slideshow/document-schema";

import {
  AuthoringHistoryContext,
  type AuthoringHistoryContextValue,
} from "../src/features/editor/authoring-history-context";
import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { ScriptedInspector } from "../src/features/editor/inspector/scripted-inspector";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const SCRIPTED_ID = "cp4c4-scripted";

const INITIAL_PORTS: ScriptedElement["ports"] = [
  { id: "first", label: "First", kind: "action" },
  { id: "enabled", label: "Enabled", kind: "boolean", direction: "input" },
  { id: "level", label: "Level", kind: "number", direction: "input", min: -1, max: 10, step: 0.5 },
];

const INITIAL_SCRIPTED: ScriptedElement = {
  id: SCRIPTED_ID,
  type: "scripted",
  hidden: false,
  title: "Scripted A",
  html: "<section>\n  <h1>A</h1>\n</section>\n",
  css: ".a {\n  color: red;\n}\n",
  script: "const state = {\n  value: 'A'\n};\n",
  ports: INITIAL_PORTS,
};

const APPLIED_PORTS: ScriptedElement["ports"] = [
  { id: "enabled", label: "Enabled", kind: "boolean", direction: "input" },
  { id: "level-updated", label: "Level updated", kind: "number", direction: "output", min: -2, max: 12, step: 0.25 },
  { id: "port", label: "Added", kind: "action" },
];

const APPLIED_AGGREGATE = {
  title: "Scripted B",
  html: "\n<div class=\"b\">\n  <span>Applied</span>\n</div>\n",
  css: "\n.b {\n  padding: 4px;\n  color: lime;\n}\n",
  script: "\nconst message = `B`;\nconsole.log(message);\n",
  ports: APPLIED_PORTS,
};

function scripted(overrides: Partial<Omit<ScriptedElement, "id" | "type" | "hidden">> = {}): ScriptedElement {
  return {
    ...INITIAL_SCRIPTED,
    ...overrides,
    id: SCRIPTED_ID,
    type: "scripted",
    hidden: false,
    ports: overrides.ports ?? INITIAL_PORTS,
  };
}

function presentation(element: ScriptedElement = INITIAL_SCRIPTED): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "cp4c4-presentation",
    title: "CP4C4 Scripted Apply History",
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

function setValue(
  control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string,
): void {
  const prototype = control instanceof HTMLSelectElement
    ? HTMLSelectElement.prototype
    : control instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (!setter) throw new Error("expected a value setter");
  setter.call(control, value);
  control.dispatchEvent(new Event(control instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
}

function click(host: HTMLElement, selector: string): void {
  const control = host.querySelector<HTMLElement>(selector);
  if (!control) throw new Error(`control ${selector} was not rendered`);
  control.click();
}

describe("CP4C4 Scripted Apply / Run aggregate history", () => {
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

  async function mountWorkspace(initial = presentation()): Promise<void> {
    await act(async () => root.render(
      <StudioI18nProvider>
        <EditorWorkspace initialPresentation={initial} />
      </StudioI18nProvider>,
    ));
  }

  async function selectScripted(): Promise<void> {
    const element = host.querySelector<HTMLElement>(`[data-powershow-id="${SCRIPTED_ID}"]`);
    if (!element) throw new Error("Scripted element was not rendered");
    await act(async () => element.dispatchEvent(new Event("pointerdown", { bubbles: true })));
  }

  function input(id: string): HTMLInputElement {
    const selector = id.startsWith("scripted-port-")
      ? `[data-powershow-${id}]`
      : `#${id}`;
    const control = host.querySelector<HTMLInputElement>(selector);
    if (!control) throw new Error(`input #${id} was not rendered`);
    return control;
  }

  function textarea(id: string): HTMLTextAreaElement {
    const control = host.querySelector<HTMLTextAreaElement>(`#${id}`);
    if (!control) throw new Error(`textarea #${id} was not rendered`);
    return control;
  }

  function select(id: string): HTMLSelectElement {
    const selector = id.startsWith("scripted-port-")
      ? `[data-powershow-${id}]`
      : `#${id}`;
    const control = host.querySelector<HTMLSelectElement>(selector);
    if (!control) throw new Error(`select #${id} was not rendered`);
    return control;
  }

  function portButtons(): HTMLButtonElement[] {
    return Array.from(host.querySelectorAll<HTMLButtonElement>("[data-powershow-scripted-port-select]"));
  }

  async function selectPort(index: number): Promise<void> {
    const button = portButtons()[index];
    if (!button) throw new Error(`port ${index} was not rendered`);
    await act(async () => button.click());
  }

  async function undo(options: KeyboardEventInit = {}): Promise<KeyboardEvent> {
    const event = key("z", { ctrlKey: true, ...options });
    await act(async () => window.dispatchEvent(event));
    return event;
  }

  async function redo(): Promise<KeyboardEvent> {
    return undo({ shiftKey: true });
  }

  it("keeps every draft local, then applies the exact aggregate as one undoable action", async () => {
    await mountWorkspace();
    await selectScripted();

    await act(async () => {
      setValue(input("scripted-title"), APPLIED_AGGREGATE.title);
      setValue(textarea("scripted-html"), APPLIED_AGGREGATE.html);
      setValue(textarea("scripted-css"), APPLIED_AGGREGATE.css);
      setValue(textarea("scripted-script"), APPLIED_AGGREGATE.script);
    });

    await act(async () => click(host, "[data-powershow-scripted-port-add]"));
    await selectPort(0);
    await act(async () => click(host, "[data-powershow-scripted-port-remove]"));
    await selectPort(1);
    await act(async () => {
      setValue(input("scripted-port-label"), "Level updated");
      setValue(input("scripted-port-id"), "level-updated");
      setValue(select("scripted-port-direction"), "output");
      setValue(input("scripted-port-min"), "-2");
      setValue(input("scripted-port-max"), "12");
      setValue(input("scripted-port-step"), "0.25");
    });
    await selectPort(2);
    await act(async () => setValue(input("scripted-port-label"), "Added"));

    expect(input("scripted-title").value).toBe(APPLIED_AGGREGATE.title);
    expect(textarea("scripted-html").value).toBe(APPLIED_AGGREGATE.html);
    expect(textarea("scripted-css").value).toBe(APPLIED_AGGREGATE.css);
    expect(textarea("scripted-script").value).toBe(APPLIED_AGGREGATE.script);
    expect(portButtons().map((button) => button.textContent?.trim())).toEqual(["Enabled", "Level updated", "Added"]);

    const beforeApplyUndo = await undo();
    expect(beforeApplyUndo.defaultPrevented).toBe(false);

    await act(async () => click(host, "#scripted-apply-run"));
    expect(input("scripted-title").value).toBe(APPLIED_AGGREGATE.title);
    expect(textarea("scripted-html").value).toBe(APPLIED_AGGREGATE.html);
    expect(textarea("scripted-css").value).toBe(APPLIED_AGGREGATE.css);
    expect(textarea("scripted-script").value).toBe(APPLIED_AGGREGATE.script);

    await selectPort(0);
    expect(select("scripted-port-type").value).toBe("boolean");
    expect(select("scripted-port-direction").value).toBe("input");
    expect(input("scripted-port-id").value).toBe("enabled");

    await selectPort(1);
    expect(select("scripted-port-type").value).toBe("number");
    expect(select("scripted-port-direction").value).toBe("output");
    expect(input("scripted-port-id").value).toBe("level-updated");
    expect(input("scripted-port-min").value).toBe("-2");
    expect(input("scripted-port-max").value).toBe("12");
    expect(input("scripted-port-step").value).toBe("0.25");

    await selectPort(2);
    expect(select("scripted-port-type").value).toBe("action");
    expect(input("scripted-port-id").value).toBe("port");
    expect(portButtons().map((button) => button.textContent?.trim())).toEqual(["Enabled", "Level updated", "Added"]);

    const firstUndo = await undo();
    expect(firstUndo.defaultPrevented).toBe(true);
    expect(input("scripted-title").value).toBe(INITIAL_SCRIPTED.title);
    expect(textarea("scripted-html").value).toBe(INITIAL_SCRIPTED.html);
    expect(textarea("scripted-css").value).toBe(INITIAL_SCRIPTED.css);
    expect(textarea("scripted-script").value).toBe(INITIAL_SCRIPTED.script);
    expect(portButtons().map((button) => button.textContent?.trim())).toEqual(["First", "Enabled", "Level"]);

    const secondUndo = await undo();
    expect(secondUndo.defaultPrevented).toBe(false);

    const firstRedo = await redo();
    expect(firstRedo.defaultPrevented).toBe(true);
    expect(input("scripted-title").value).toBe(APPLIED_AGGREGATE.title);
    expect(textarea("scripted-html").value).toBe(APPLIED_AGGREGATE.html);
    expect(textarea("scripted-css").value).toBe(APPLIED_AGGREGATE.css);
    expect(textarea("scripted-script").value).toBe(APPLIED_AGGREGATE.script);
    expect(portButtons().map((button) => button.textContent?.trim())).toEqual(["Enabled", "Level updated", "Added"]);
  });

  it("keeps a prior Appearance action separate from the aggregate Apply action", async () => {
    await mountWorkspace(presentation(scripted({ style: { background: { color: "#ffffff" } } })));
    await selectScripted();

    await act(async () => setValue(input("scripted-background-value"), "#ff0000"));
    expect(input("scripted-background-value").value).toBe("#ff0000");

    await act(async () => setValue(input("scripted-title"), "Applied after appearance"));
    await act(async () => click(host, "#scripted-apply-run"));

    await undo();
    expect(input("scripted-title").value).toBe(INITIAL_SCRIPTED.title);
    expect(input("scripted-background-value").value).toBe("#ff0000");

    await undo();
    expect(input("scripted-background-value").value).toBe("#ffffff");
  });

  describe("direct Scripted Inspector contracts", () => {
    let current: ScriptedElement;
    let updateCount: number;
    let metas: Array<{ kind: string; labelKey: string; labelParams?: Readonly<Record<string, string | number>> }>;
    let history: AuthoringHistoryContextValue | null;

    function renderDirect(): void {
      const inspector = (
        <ScriptedInspector
          element={current}
          onUpdate={(update) => {
            updateCount += 1;
            const next = update(current);
            if (next.type !== "scripted") throw new Error("expected Scripted element");
            current = next;
            renderDirect();
          }}
        />
      );
      root.render(
        <StudioI18nProvider>
          {history === null ? inspector : (
            <AuthoringHistoryContext.Provider value={history}>
              {inspector}
            </AuthoringHistoryContext.Provider>
          )}
        </StudioI18nProvider>,
      );
    }

    async function mountDirect(initial = INITIAL_SCRIPTED, withHistory = true): Promise<void> {
      current = initial;
      updateCount = 0;
      metas = [];
      history = withHistory
        ? {
          begin: () => undefined,
          update: (_key, callback) => callback(),
          finish: () => undefined,
          discrete: (meta, callback) => {
            metas.push(meta);
            callback();
          },
        }
        : null;
      await act(async () => renderDirect());
    }

    function directInput(id: string): HTMLInputElement {
      const selector = id.startsWith("scripted-port-")
        ? `[data-powershow-${id}]`
        : `#${id}`;
      const control = host.querySelector<HTMLInputElement>(selector);
      if (!control) throw new Error(`input #${id} was not rendered`);
      return control;
    }

    function directTextarea(id: string): HTMLTextAreaElement {
      const control = host.querySelector<HTMLTextAreaElement>(`#${id}`);
      if (!control) throw new Error(`textarea #${id} was not rendered`);
      return control;
    }

    it("uses the required metadata and no other action for a real aggregate Apply", async () => {
      await mountDirect();

      await act(async () => {
        setValue(directInput("scripted-title"), "Applied");
        setValue(directTextarea("scripted-html"), "<p>Applied</p>");
      });
      await act(async () => click(host, "#scripted-apply-run"));

      expect(updateCount).toBe(1);
      expect(metas).toEqual([{
        kind: "element.setting",
        labelKey: "history.element.setting",
        labelParams: { setting: "scripted.applyRun" },
      }]);
      expect(current.title).toBe("Applied");
      expect(current.html).toBe("<p>Applied</p>");
    });

    it("keeps add/remove and all port edits local until one aggregate Apply", async () => {
      await mountDirect();

      await act(async () => click(host, '[data-powershow-scripted-port-add]'));
      await act(async () => click(host, '[data-powershow-scripted-port-select][data-powershow-scripted-port-index="0"]'));
      await act(async () => click(host, '[data-powershow-scripted-port-remove]'));
      await act(async () => click(host, '[data-powershow-scripted-port-select][data-powershow-scripted-port-index="1"]'));
      await act(async () => setValue(directInput("scripted-port-label"), "Level changed"));

      expect(current.ports).toEqual(INITIAL_PORTS);
      expect(updateCount).toBe(0);
      expect(metas).toEqual([]);

      await act(async () => click(host, "#scripted-apply-run"));
      expect(current.ports).toEqual([
        { id: "enabled", label: "Enabled", kind: "boolean", direction: "input" },
        { id: "level", label: "Level changed", kind: "number", direction: "input", min: -1, max: 10, step: 0.5 },
        { id: "port", label: "Port", kind: "action" },
      ]);
      expect(updateCount).toBe(1);
      expect(metas).toHaveLength(1);
    });

    it("rejects empty titles and invalid ports with drafts preserved and zero history", async () => {
      await mountDirect();

      await act(async () => {
        setValue(directInput("scripted-title"), "");
        setValue(directTextarea("scripted-html"), "draft html");
      });
      await act(async () => click(host, "#scripted-apply-run"));
      expect(updateCount).toBe(0);
      expect(metas).toEqual([]);
      expect(directInput("scripted-title").value).toBe("");
      expect(directTextarea("scripted-html").value).toBe("draft html");
      expect(host.textContent).toContain("Enter a title");

      await act(async () => setValue(directInput("scripted-title"), "fixed"));
      await act(async () => click(host, '[data-powershow-scripted-port-add]'));
      await act(async () => setValue(directInput("scripted-port-id"), "first"));
      await act(async () => click(host, "#scripted-apply-run"));
      expect(updateCount).toBe(0);
      expect(metas).toEqual([]);
      expect(host.textContent).toContain("Correct the selected port");

      await act(async () => setValue(directInput("scripted-port-id"), "numeric"));
      await act(async () => setValue(host.querySelector<HTMLSelectElement>("[data-powershow-scripted-port-type]")!, "number"));
      await act(async () => setValue(directInput("scripted-port-step"), "0"));
      await act(async () => click(host, "#scripted-apply-run"));
      expect(updateCount).toBe(0);
      expect(metas).toEqual([]);
      expect(current).toEqual(INITIAL_SCRIPTED);
    });

    it("accepts a whitespace-only title without trimming it", async () => {
      await mountDirect();

      await act(async () => setValue(directInput("scripted-title"), "   "));
      await act(async () => setValue(directTextarea("scripted-html"), "changed"));
      await act(async () => click(host, "#scripted-apply-run"));

      expect(current.title).toBe("   ");
      expect(updateCount).toBe(1);
      expect(metas).toHaveLength(1);
    });

    it("does not create history for a representation-only numeric no-op", async () => {
      await mountDirect(scripted({ ports: [{ id: "number", label: "Number", kind: "number", direction: "input", min: 1 }] }));

      await act(async () => setValue(directInput("scripted-port-min"), "1.0"));
      expect(host.querySelector<HTMLButtonElement>("#scripted-apply-run")?.disabled).toBe(false);
      await act(async () => click(host, "#scripted-apply-run"));

      expect(current.ports).toEqual([{ id: "number", label: "Number", kind: "number", direction: "input", min: 1 }]);
      expect(updateCount).toBe(0);
      expect(metas).toEqual([]);
      expect(directInput("scripted-port-min").value).toBe("1.0");
    });

    it("keeps Reset and hydration local with zero history", async () => {
      await mountDirect();

      await act(async () => {
        setValue(directInput("scripted-title"), "draft");
        setValue(directTextarea("scripted-html"), "draft html");
        setValue(directTextarea("scripted-css"), "draft css");
        setValue(directTextarea("scripted-script"), "draft script");
        click(host, '[data-powershow-scripted-port-add]');
      });
      await act(async () => click(host, "#scripted-reset"));
      expect(current).toEqual(INITIAL_SCRIPTED);
      expect(updateCount).toBe(0);
      expect(metas).toEqual([]);
      expect(directInput("scripted-title").value).toBe(INITIAL_SCRIPTED.title);

      await act(async () => setValue(directTextarea("scripted-html"), "uncommitted"));
      current = scripted({ title: "Hydrated", html: "canonical html", ports: [{ id: "hydrated", label: "Hydrated", kind: "action" }] });
      await act(async () => renderDirect());
      expect(directInput("scripted-title").value).toBe("Hydrated");
      expect(directTextarea("scripted-html").value).toBe("canonical html");
      expect(updateCount).toBe(0);
      expect(metas).toEqual([]);
    });

    it("supports valid Apply, no-op, invalid Apply, and Reset without a History provider", async () => {
      await mountDirect(INITIAL_SCRIPTED, false);

      await act(async () => setValue(directTextarea("scripted-html"), "provider absent"));
      await act(async () => click(host, "#scripted-apply-run"));
      expect(current.html).toBe("provider absent");
      expect(updateCount).toBe(1);

      await act(async () => setValue(directInput("scripted-port-id"), " "));
      await act(async () => click(host, "#scripted-apply-run"));
      expect(updateCount).toBe(1);

      await act(async () => click(host, "#scripted-reset"));
      expect(directInput("scripted-port-id").value).toBe("first");
      expect(updateCount).toBe(1);
    });
  });
});
