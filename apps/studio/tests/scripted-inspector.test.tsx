// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PowerShowElement, ScriptedElement, Slide } from "@powershow/document-schema";

import { ElementInspector } from "../src/features/editor/element-inspector";
import { ScriptedInspector } from "../src/features/editor/inspector/scripted-inspector";
import type {
  BlocksAuthoringControls,
  TableAuthoringControls,
  TopicsAuthoringControls,
} from "../src/features/editor/inspector/inspector-types";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";
import {
  createElement,
  insertElementAfterId,
  resolveAddElementDestination,
} from "../src/features/editor/element-operations";
import { findElementById } from "../src/features/editor/element-tree";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const FONT_RESOURCES: readonly { id: string; family: string }[] = [];

const TOPICS_AUTHORING_CONTROLS: TopicsAuthoringControls = {
  onAddTopLevelTopic: () => null,
  onAddChildTopic: () => null,
};

const BLOCKS_AUTHORING_CONTROLS: BlocksAuthoringControls = {
  onAddRootBlock: () => null,
  onAddScopeChild: () => null,
  onAddTextPart: () => null,
  onAddSocketPart: () => null,
  onCreateSocketValue: () => null,
};

const TABLE_AUTHORING_CONTROLS: TableAuthoringControls = {
  onAddColumn: () => {},
  onRemoveColumn: () => {},
  onAddRow: () => {},
  onRemoveRow: () => {},
  onShowHeaderChange: () => {},
};

function scripted(
  overrides: Partial<Omit<ScriptedElement, "type">> = {},
): ScriptedElement {
  return {
    id: "scripted-1",
    type: "scripted",
    title: "Scripted content",
    html: "",
    css: "",
    script: "",
    hidden: false,
    ...overrides,
  };
}

function slide(elements: Slide["elements"] = []): Slide {
  return {
    id: "slide-1",
    title: "",
    summary: "",
    speakerNotes: "",
    elements,
  };
}

describe("ScriptedInspector", () => {
  let container: HTMLDivElement;
  let root: Root;
  let elementState: ScriptedElement;
  let updates: ScriptedElement[];

  function renderInspector() {
    root.render(
      <StudioI18nProvider>
        <ScriptedInspector
          element={elementState}
          onUpdate={(update) => {
            const next = update(elementState);
            if (next.type !== "scripted") {
              return;
            }
            elementState = next;
            updates.push(elementState);
            renderInspector();
          }}
        />
      </StudioI18nProvider>,
    );
  }

  function mount(initial: ScriptedElement) {
    elementState = initial;
    updates = [];
    renderInspector();
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

  function titleInput(): HTMLInputElement {
    const input = container.querySelector<HTMLInputElement>("#scripted-title");
    if (!input) {
      throw new Error("scripted-title input not found");
    }
    return input;
  }

  function htmlTextarea(): HTMLTextAreaElement {
    const textarea = container.querySelector<HTMLTextAreaElement>(
      "#scripted-html",
    );
    if (!textarea) {
      throw new Error("scripted-html textarea not found");
    }
    return textarea;
  }

  function cssTextarea(): HTMLTextAreaElement {
    const textarea = container.querySelector<HTMLTextAreaElement>(
      "#scripted-css",
    );
    if (!textarea) {
      throw new Error("scripted-css textarea not found");
    }
    return textarea;
  }

  function scriptTextarea(): HTMLTextAreaElement {
    const textarea = container.querySelector<HTMLTextAreaElement>(
      "#scripted-script",
    );
    if (!textarea) {
      throw new Error("scripted-script textarea not found");
    }
    return textarea;
  }

  function applyButton(): HTMLButtonElement {
    const button = container.querySelector<HTMLButtonElement>(
      "#scripted-apply-run",
    );
    if (!button) {
      throw new Error("Apply / Run button not found");
    }
    return button;
  }

  function changeInput(input: HTMLInputElement, value: string): void {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )?.set;

    nativeInputValueSetter?.call(input, value);

    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function changeTextarea(
    textarea: HTMLTextAreaElement,
    value: string,
  ): void {
    const nativeTextareaValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value",
    )?.set;

    nativeTextareaValueSetter?.call(textarea, value);

    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }

  it("renders the ScriptedInspector with all source fields", async () => {
    await act(async () => {
      mount(scripted());
    });

    expect(titleInput()).not.toBeNull();
    expect(htmlTextarea()).not.toBeNull();
    expect(cssTextarea()).not.toBeNull();
    expect(scriptTextarea()).not.toBeNull();
  });

  it("initializes the title draft from the canonical title", async () => {
    await act(async () => {
      mount(scripted({ title: "Plot demo" }));
    });

    expect(titleInput().value).toBe("Plot demo");
  });

  it("initializes the HTML draft exactly", async () => {
    const html = "<h1>Hello</h1>\n<p>World</p>";

    await act(async () => {
      mount(scripted({ html }));
    });

    expect(htmlTextarea().value).toBe(html);
  });

  it("initializes the CSS draft exactly", async () => {
    const css = "h1 { color: #0ea5e9; }";

    await act(async () => {
      mount(scripted({ css }));
    });

    expect(cssTextarea().value).toBe(css);
  });

  it("initializes the JavaScript draft exactly", async () => {
    const script = "console.log('ready');";

    await act(async () => {
      mount(scripted({ script }));
    });

    expect(scriptTextarea().value).toBe(script);
  });

  it("mounts without writing canonical state", async () => {
    await act(async () => {
      mount(scripted());
    });

    expect(updates).toHaveLength(0);
  });

  it("changing the title draft does NOT call onUpdate", async () => {
    await act(async () => {
      mount(scripted());
    });

    await act(async () => {
      changeInput(titleInput(), "New title");
    });

    expect(updates).toHaveLength(0);
    expect(elementState.title).toBe("Scripted content");
  });

  it("changing the HTML draft does NOT call onUpdate", async () => {
    await act(async () => {
      mount(scripted());
    });

    await act(async () => {
      changeTextarea(htmlTextarea(), "<h1>Draft</h1>");
    });

    expect(updates).toHaveLength(0);
    expect(elementState.html).toBe("");
  });

  it("changing the CSS draft does NOT call onUpdate", async () => {
    await act(async () => {
      mount(scripted());
    });

    await act(async () => {
      changeTextarea(cssTextarea(), "body { background: black; }");
    });

    expect(updates).toHaveLength(0);
    expect(elementState.css).toBe("");
  });

  it("changing the JavaScript draft does NOT call onUpdate", async () => {
    await act(async () => {
      mount(scripted());
    });

    await act(async () => {
      changeTextarea(scriptTextarea(), "console.log('draft');");
    });

    expect(updates).toHaveLength(0);
    expect(elementState.script).toBe("");
  });

  it("Apply / Run is disabled when drafts equal canonical state", async () => {
    await act(async () => {
      mount(scripted());
    });

    expect(applyButton().disabled).toBe(true);
  });

  it("changing any draft makes Apply / Run available", async () => {
    await act(async () => {
      mount(scripted());
    });

    await act(async () => {
      changeTextarea(htmlTextarea(), "<p>Hello</p>");
    });

    expect(applyButton().disabled).toBe(false);

    await act(async () => {
      changeTextarea(cssTextarea(), "p { color: red; }");
    });

    expect(applyButton().disabled).toBe(false);
  });

  it("Apply / Run calls onUpdate exactly once through the normal path", async () => {
    await act(async () => {
      mount(scripted());
    });

    await act(async () => {
      changeTextarea(htmlTextarea(), "<p>Hello</p>");
    });

    await act(async () => {
      applyButton().click();
    });

    expect(updates).toHaveLength(1);
    expect(elementState.html).toBe("<p>Hello</p>");
  });

  it("writes title, html, css and script together in one update", async () => {
    await act(async () => {
      mount(scripted());
    });

    await act(async () => {
      changeInput(titleInput(), "Demo");
      changeTextarea(htmlTextarea(), "<div id=\"app\"></div>");
      changeTextarea(cssTextarea(), "#app { color: lime; }");
      changeTextarea(scriptTextarea(), "app.textContent = 'hi';");
    });

    await act(async () => {
      applyButton().click();
    });

    expect(updates).toHaveLength(1);

    expect(elementState.title).toBe("Demo");

    expect(elementState.html).toBe("<div id=\"app\"></div>");

    expect(elementState.css).toBe("#app { color: lime; }");

    expect(elementState.script).toBe("app.textContent = 'hi';");
  });

  it("preserves unrelated element fields and style on Apply", async () => {
    await act(async () => {
      mount(
        scripted({
          layout: {
            width: "70%",
            height: "40%",
          },
          style: {
            borderRadius: 8,
          },
        }),
      );
    });

    await act(async () => {
      changeTextarea(htmlTextarea(), "<p>Styled</p>");
    });

    await act(async () => {
      applyButton().click();
    });

    expect(updates).toHaveLength(1);

    expect(elementState.id).toBe("scripted-1");

    expect(elementState.hidden).toBe(false);

    expect(elementState.layout).toEqual({ width: "70%", height: "40%" });
    expect(elementState.style).toEqual({ borderRadius: 8 });
  });

  it("preserves the authored HTML exactly on Apply", async () => {
    const html = "\n  <h1>  Spaced  </h1>\n  <p>Trailing text   </p>\n";

    await act(async () => {
      mount(scripted());
    });

    await act(async () => {
      changeTextarea(htmlTextarea(), html);
    });

    await act(async () => {
      applyButton().click();
    });

    expect(updates).toHaveLength(1);
    expect(elementState.html).toBe(html);
  });

  it("preserves the authored CSS exactly on Apply", async () => {
    const css = "  h1 { color: #ff0000; }  \n  p { margin: 0; }  ";

    await act(async () => {
      mount(scripted());
    });

    await act(async () => {
      changeTextarea(cssTextarea(), css);
    });

    await act(async () => {
      applyButton().click();
    });

    expect(updates).toHaveLength(1);
    expect(elementState.css).toBe(css);
  });

  it("preserves the authored JavaScript exactly on Apply", async () => {
    const script = "\n  const x = \"a\";\n  console.log(x);\n";

    await act(async () => {
      mount(scripted());
    });

    await act(async () => {
      changeTextarea(scriptTextarea(), script);
    });

    await act(async () => {
      applyButton().click();
    });

    expect(updates).toHaveLength(1);
    expect(elementState.script).toBe(script);
  });

  it("Apply / Run is disabled again once the canonical state reflects the drafts", async () => {
    await act(async () => {
      mount(scripted());
    });

    await act(async () => {
      changeTextarea(htmlTextarea(), "<p>Hello</p>");
    });

    await act(async () => {
      applyButton().click();
    });

    expect(updates).toHaveLength(1);
    expect(applyButton().disabled).toBe(true);
  });

  it("empty title prevents the canonical update", async () => {
    await act(async () => {
      mount(scripted());
    });

    await act(async () => {
      changeInput(titleInput(), "");
      changeTextarea(htmlTextarea(), "<p>Would be lost</p>");
    });

    await act(async () => {
      applyButton().click();
    });

    expect(updates).toHaveLength(0);
    expect(elementState.html).toBe("");
  });

  it("shows a title validation message and keeps the draft visible", async () => {
    await act(async () => {
      mount(scripted());
    });

    await act(async () => {
      changeInput(titleInput(), "");
    });

    await act(async () => {
      applyButton().click();
    });

    const message = Array.from(container.querySelectorAll("small")).find(
      (small) => small.textContent?.includes("Enter a title"),
    );

    expect(message).not.toBeUndefined();
    expect(titleInput().value).toBe("");
  });

  it("correcting the title afterwards allows Apply / Run", async () => {
    await act(async () => {
      mount(scripted());
    });

    await act(async () => {
      changeInput(titleInput(), "");
      changeTextarea(htmlTextarea(), "<p>Hello</p>");
    });

    await act(async () => {
      applyButton().click();
    });

    expect(updates).toHaveLength(0);

    await act(async () => {
      changeInput(titleInput(), "Fixed title");
    });

    await act(async () => {
      applyButton().click();
    });

    expect(updates).toHaveLength(1);
    expect(elementState.title).toBe("Fixed title");
    expect(elementState.html).toBe("<p>Hello</p>");
  });

  it("switching to another Scripted element does not leak drafts", async () => {
    await act(async () => {
      mount(scripted());
    });

    await act(async () => {
      changeInput(titleInput(), "Leaked title");
      changeTextarea(htmlTextarea(), "<p>Leaked html</p>");
    });

    await act(async () => {
      mount(
        scripted({
          id: "scripted-2",
          title: "Second",
          html: "<p>Second html</p>",
          css: "p { color: blue; }",
          script: "console.log('second');",
        }),
      );
    });

    expect(updates).toHaveLength(0);
    expect(titleInput().value).toBe("Second");
    expect(htmlTextarea().value).toBe("<p>Second html</p>");
    expect(cssTextarea().value).toBe("p { color: blue; }");
    expect(scriptTextarea().value).toBe("console.log('second');");
  });

  it("external canonical value changes rehydrate drafts", async () => {
    await act(async () => {
      mount(scripted());
    });

    await act(async () => {
      changeTextarea(htmlTextarea(), "<p>Local draft</p>");
    });

    expect(updates).toHaveLength(0);

    await act(async () => {
      elementState = { ...elementState, html: "<p>External</p>" };
      renderInspector();
    });

    expect(htmlTextarea().value).toBe("<p>External</p>");
    expect(updates).toHaveLength(0);
  });

  it("hydration performs ZERO canonical writes", async () => {
    await act(async () => {
      mount(scripted({ title: "A", html: "h1", css: "c", script: "s" }));
    });

    await act(async () => {
      elementState = { ...elementState, title: "B" };
      renderInspector();
    });

    expect(updates).toHaveLength(0);
    expect(titleInput().value).toBe("B");
  });

  it("Reset restores the canonical drafts with zero writes", async () => {
    await act(async () => {
      mount(scripted({ html: "<p>Canonical</p>" }));
    });

    await act(async () => {
      changeTextarea(htmlTextarea(), "<p>Changed</p>");
    });

    expect(applyButton().disabled).toBe(false);

    await act(async () => {
      const reset = container.querySelector<HTMLButtonElement>(
        "#scripted-reset",
      );
      if (!reset) {
        throw new Error("Reset button not found");
      }
      reset.click();
    });

    expect(updates).toHaveLength(0);
    expect(htmlTextarea().value).toBe("<p>Canonical</p>");
    expect(applyButton().disabled).toBe(true);
  });

  it("exposes no sandbox control", () => {
    expect(container.querySelector('[id*="sandbox"]')).toBeNull();
    expect(container.innerHTML).not.toContain("allow-scripts");
  });

  it("exposes no CSP control", () => {
    expect(container.querySelector('[id*="csp"], [id*="CSP"]')).toBeNull();
    expect(container.innerHTML).not.toContain("Content-Security-Policy");
  });

  it("exposes no same-origin permission", () => {
    expect(container.innerHTML).not.toContain("allow-same-origin");
    expect(container.innerHTML).not.toContain("sameOrigin");
  });

  it("exposes no network permission", () => {
    expect(container.innerHTML).not.toContain("allowNetwork");
    expect(container.innerHTML).not.toContain("network");
  });

  it("exposes no postMessage or runtime API control", () => {
    expect(container.innerHTML).not.toContain("postMessage");
    expect(container.innerHTML).not.toContain("runtime");
    expect(container.innerHTML).not.toContain("executionMode");
  });

  it("renders the shared Appearance controls", async () => {
    await act(async () => {
      mount(scripted());
    });

    const backgroundInput = container.querySelector<HTMLInputElement>(
      "#scripted-background-value",
    );

    expect(backgroundInput).not.toBeNull();
  });

  it("renders the shared Effects controls", async () => {
    await act(async () => {
      mount(scripted());
    });

    const shadowMode = container.querySelector<HTMLSelectElement>(
      "#scripted-shadow-mode",
    );

    expect(shadowMode).not.toBeNull();
  });

  it("writes appearance updates to the canonical surface style path", async () => {
    await act(async () => {
      mount(scripted());
    });

    await act(async () => {
      changeInput(
        container.querySelector<HTMLInputElement>("#scripted-background-value")!,
        "#ff0000",
      );
    });

    expect(updates).toHaveLength(1);
    expect(elementState.style?.background?.color).toBe("#ff0000");
  });

  it("keeps opacity in Appearance while persisting effect.opacity", async () => {
    await act(async () => { mount(scripted()); });
    await act(async () => { changeInput(container.querySelector<HTMLInputElement>("#scripted-opacity")!, "65"); });
    expect(elementState.effect?.opacity).toBe(0.65);
    expect("opacity" in (elementState.style ?? {})).toBe(false);
  });

  it("clears the authored opacity override when the input is emptied", async () => {
    await act(async () => { mount(scripted({ effect: { opacity: 0.65 } })); });
    await act(async () => { changeInput(container.querySelector<HTMLInputElement>("#scripted-opacity")!, ""); });
    expect(elementState.effect?.opacity).toBeUndefined();
    expect("opacity" in (elementState.style ?? {})).toBe(false);
  });

  it("supports gradient borders but does not expose background gradients", async () => {
    await act(async () => { mount(scripted()); });
    expect(container.querySelector("#scripted-background-gradient")).toBeNull();
    const borderStyle = container.querySelector<HTMLSelectElement>("#scripted-border-style")!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")?.set;
      setter?.call(borderStyle, "solid");
      borderStyle.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const paint = container.querySelector<HTMLSelectElement>("#scripted-border-paint");
    expect(paint).not.toBeNull();
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")?.set;
      setter?.call(paint, "gradient");
      paint?.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect("gradient" in (elementState.style?.background ?? {})).toBe(false);
    expect(elementState.style?.border?.gradient).toBeDefined();
  });

  it("preserves authored shadow values across outer and inset mode changes", async () => {
    await act(async () => {
      mount(scripted({ effect: { shadow: { x: 1, y: 2, blur: 3, spread: 4, color: "#123456" } } }));
    });
    const mode = container.querySelector<HTMLSelectElement>("#scripted-shadow-mode")!;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value")?.set;
    await act(async () => {
      setter?.call(mode, "inset");
      mode.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(elementState.effect?.shadow).toEqual({ x: 1, y: 2, blur: 3, spread: 4, color: "#123456", inset: true });
    await act(async () => {
      setter?.call(mode, "outer");
      mode.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(elementState.effect?.shadow).toEqual({ x: 1, y: 2, blur: 3, spread: 4, color: "#123456", inset: undefined });
  });

  it("writes shadow spread to effect.shadow.spread", async () => {
    await act(async () => { mount(scripted({ effect: { shadow: { x: 0, y: 1, blur: 2, color: "#000000" } } })); });
    await act(async () => { changeInput(container.querySelector<HTMLInputElement>("#scripted-shadow-spread")!, "7"); });
    expect(elementState.effect?.shadow?.spread).toBe(7);
    expect("shadow" in (elementState.style ?? {})).toBe(false);
  });

  it("restores legacy shadow clearing defaults", async () => {
    await act(async () => { mount(scripted({ effect: { shadow: { x: 8, y: 9, blur: 10, spread: 11, color: "#000000" } } })); });
    expect(container.querySelector<HTMLInputElement>("#scripted-shadow-blur")?.min).toBe("0");
    await act(async () => { changeInput(container.querySelector<HTMLInputElement>("#scripted-shadow-x")!, ""); });
    expect(elementState.effect?.shadow?.x).toBe(0);
    await act(async () => { changeInput(container.querySelector<HTMLInputElement>("#scripted-shadow-y")!, ""); });
    expect(elementState.effect?.shadow?.y).toBe(4);
    await act(async () => { changeInput(container.querySelector<HTMLInputElement>("#scripted-shadow-blur")!, ""); });
    expect(elementState.effect?.shadow?.blur).toBe(12);
    await act(async () => { changeInput(container.querySelector<HTMLInputElement>("#scripted-shadow-spread")!, ""); });
    expect(elementState.effect?.shadow?.spread).toBeUndefined();
  });
});

describe("ElementInspector dispatcher for Scripted", () => {
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

  it("dispatches the ScriptedInspector for a selected Scripted element", async () => {
    const element: PowerShowElement = scripted({
      html: "<h1>Hello</h1>",
    });

    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <ElementInspector
            element={element}
            onUpdate={() => undefined}
            fontResources={FONT_RESOURCES}
            preserveImageProportion={false}
            onPreserveImageProportionChange={() => {}}
            focalEditingImageId={null}
            onFocalEditingImageIdChange={() => {}}
            parent={null}
            layerControls={null}
            topicsAuthoringControls={TOPICS_AUTHORING_CONTROLS}
            blocksAuthoringControls={BLOCKS_AUTHORING_CONTROLS}
            tableAuthoringControls={TABLE_AUTHORING_CONTROLS}
          />
        </StudioI18nProvider>,
      );
    });

    const html = container.querySelector<HTMLTextAreaElement>(
      "#scripted-html",
    );
    const apply = container.querySelector<HTMLButtonElement>(
      "#scripted-apply-run",
    );

    expect(html).not.toBeNull();
    expect(apply).not.toBeNull();
    expect(html?.value).toBe("<h1>Hello</h1>");
  });

  it("does not show the unsupported-element hint for Scripted", async () => {
    const element: PowerShowElement = scripted();

    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <ElementInspector
            element={element}
            onUpdate={() => undefined}
            fontResources={FONT_RESOURCES}
            preserveImageProportion={false}
            onPreserveImageProportionChange={() => {}}
            focalEditingImageId={null}
            onFocalEditingImageIdChange={() => {}}
            parent={null}
            layerControls={null}
            topicsAuthoringControls={TOPICS_AUTHORING_CONTROLS}
            blocksAuthoringControls={BLOCKS_AUTHORING_CONTROLS}
            tableAuthoringControls={TABLE_AUTHORING_CONTROLS}
          />
        </StudioI18nProvider>,
      );
    });

    expect(container.innerHTML).not.toContain("will be added in");
  });

  it("shows the Scripted type label correctly", async () => {
    const element: PowerShowElement = scripted();

    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <ElementInspector
            element={element}
            onUpdate={() => undefined}
            fontResources={FONT_RESOURCES}
            preserveImageProportion={false}
            onPreserveImageProportionChange={() => {}}
            focalEditingImageId={null}
            onFocalEditingImageIdChange={() => {}}
            parent={null}
            layerControls={null}
            topicsAuthoringControls={TOPICS_AUTHORING_CONTROLS}
            blocksAuthoringControls={BLOCKS_AUTHORING_CONTROLS}
            tableAuthoringControls={TABLE_AUTHORING_CONTROLS}
          />
        </StudioI18nProvider>,
      );
    });

    expect(container.innerHTML).toContain("Scripted");
  });
});

describe("Add Element -> Scripted flow", () => {
  it("creates a selectable canonical element through the generic flow", () => {
    const base = {
      id: "text-sibling",
      type: "text" as const,
      hidden: false,
      variant: "body" as const,
      content: "Sibling",
    };

    const elements = [base];

    const created = createElement("scripted", [slide(elements)]);

    const destination = resolveAddElementDestination(
      elements,
      "text-sibling",
      created,
    );

    expect(destination).toEqual({
      kind: "insert-after",
      targetId: "text-sibling",
    });

    const next = insertElementAfterId(elements, "text-sibling", created);

    const selected = findElementById(next, created.id);

    expect(selected).not.toBeUndefined();
    expect(selected?.type).toBe("scripted");
    expect(selected?.id).toBe("scripted-element");
  });
});
