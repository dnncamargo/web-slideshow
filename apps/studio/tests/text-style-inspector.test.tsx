// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  PresentationSchema,
  TextElementSchema,
  stripLocalTextStyleProperties,
  type Presentation,
  type TextElement,
  type ContainerElement,
} from "@web-slideshow/document-schema";

import { TextInspector } from "../src/features/editor/inspector/text-inspector";
import { ElementInspector } from "../src/features/editor/element-inspector";
import type { TableAuthoringControls, TopicsAuthoringControls } from "../src/features/editor/inspector/inspector-types";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const fonts: readonly { id: string; family: string }[] = [];
const topics: TopicsAuthoringControls = { onAddTopLevelTopic: () => null, onAddChildTopic: () => null };
const tables: TableAuthoringControls = { onAddColumn: () => {}, onRemoveColumn: () => {}, onAddRow: () => {}, onRemoveRow: () => {}, onShowHeaderChange: () => {} };

function presentation(textStyles: unknown[] = [], palette?: unknown): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "presentation",
    title: "Presentation",
    slides: [{ id: "slide", elements: [] }],
    ...(textStyles.length > 0 ? { textStyles } : {}),
    ...(palette === undefined ? {} : { palette }),
  });
}

function text(overrides: Record<string, unknown> = {}): TextElement {
  return TextElementSchema.parse({
    id: "text",
    type: "text",
    hidden: false,
    variant: "body",
    content: "Text",
    ...overrides,
  });
}

describe("Text Inspector typography style attachment", () => {
  let host: HTMLDivElement;
  let root: Root;
  let current: TextElement;
  let updates: TextElement[];
  let activePresentation: Presentation;
  let activeParent: ContainerElement | null = null;

  function renderInspector(): void {
    root.render(
      <StudioI18nProvider>
        <TextInspector
          element={current}
          presentation={activePresentation}
          parent={activeParent}
          fontResources={fonts}
          onUpdate={(update) => {
            current = update(current) as TextElement;
            updates.push(current);
            renderInspector();
          }}
        />
      </StudioI18nProvider>,
    );
  }

  async function mount(element: TextElement, nextPresentation = presentation(), parent: ContainerElement | null = null): Promise<void> {
    current = element;
    activePresentation = nextPresentation;
    activeParent = parent;
    updates = [];
    await act(async () => renderInspector());
  }

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  it("shows exactly the four fundamental identities plus authored custom names", async () => {
    await mount(text(), presentation([
      { id: "quote", name: "Quote", role: "body" },
      { id: "title-2", name: "Title 2", role: "title" },
    ]));

    const options = [...host.querySelectorAll<HTMLSelectElement>("#text-variant option")];
    const labels = options.map((option) => option.textContent);
    expect(labels.filter((label) => ["Title", "Subtitle", "Body", "Caption"].includes(label ?? ""))).toHaveLength(4);
    expect(labels).toEqual(expect.arrayContaining(["Quote", "Title 2"]));
    expect(labels).not.toEqual(expect.arrayContaining(["Body Default", "Body Custom", "Body Local"]));
    expect(options.find((option) => option.textContent === "Quote")?.value).toBe("quote");
  });

  it("shows inherited Container color without materializing it as Text color", async () => {
    const source = presentation();
    source.linkedStyles = [{ id: "container-style", name: "Container", style: { color: "#ff00ff" } }];
    await mount(text(), source, {
      id: "parent",
      type: "container",
      hidden: false,
      linkedStyleId: "container-style",
      children: [],
    });

    const input = host.querySelector<HTMLInputElement>("#text-color-value");
    expect(input?.value).toBe("");
    expect(input?.placeholder).toBe("Inherited from Container");
    expect(host.querySelector<HTMLInputElement>("#text-color")?.value).toBe("#ff00ff");
    expect(current.style?.color).toBeUndefined();
    expect(host.querySelector("#text-color-value")?.closest("label")?.querySelector("button")).toBeNull();
  });

  it("labels a local Text color reset as returning to Container inheritance", async () => {
    await mount(text({ styleDetached: true, style: { color: "#0000ff" } }), presentation(), {
      id: "parent",
      type: "container",
      hidden: false,
      style: { color: "#ff00ff" },
      children: [],
    });
    const label = host.querySelector<HTMLInputElement>("#text-color-value")?.closest("label");
    expect(label?.textContent).toContain("Use inherited color");
    await act(async () => Array.from(label?.querySelectorAll("button") ?? []).find((button) => button.textContent?.trim() === "Use inherited color")?.click());
    expect(current.style?.color).toBeUndefined();
  });

  it("displays Presentation-effective values without writing on mount", async () => {
    const source = presentation([{ id: "body", typography: { fontFamily: "Inter", fontSize: 20, fontWeight: 500 } }]);
    await mount(text(), source);

    expect(host.querySelector<HTMLInputElement>("#text-font-size")?.value).toBe("1.25");
    expect(host.querySelector<HTMLInputElement>("#text-font-family")?.value).toBe("");
    expect(host.querySelector<HTMLInputElement>("#text-font-family")?.placeholder).toBe("Inter");
    expect(host.querySelector<HTMLSelectElement>("#text-font-weight")?.value).toBe("500");
    expect(updates).toHaveLength(0);
    expect(source.textStyles?.[0]).toMatchObject({ id: "body", typography: { fontSize: 20 } });
  });

  it("keeps an attached local override local while inherited values change", async () => {
    const first = presentation([{ id: "body", typography: { fontFamily: "Inter", fontWeight: 500 } }]);
    await mount(text({ typography: { fontSize: 22 } }), first);
    expect(host.querySelector<HTMLInputElement>("#text-font-size")?.value).toBe("22");
    expect(host.querySelector<HTMLInputElement>("#text-font-family")?.value).toBe("");
    expect(host.querySelector<HTMLInputElement>("#text-font-family")?.placeholder).toBe("Inter");
    expect(host.querySelector<HTMLSelectElement>("#text-font-weight")?.value).toBe("500");

    await mount(current, presentation([{ id: "body", typography: { fontFamily: "Roboto", fontWeight: 700 } }]));
    expect(host.querySelector<HTMLInputElement>("#text-font-size")?.value).toBe("22");
    expect(host.querySelector<HTMLInputElement>("#text-font-family")?.value).toBe("");
    expect(host.querySelector<HTMLInputElement>("#text-font-family")?.placeholder).toBe("Roboto");
    expect(host.querySelector<HTMLSelectElement>("#text-font-weight")?.value).toBe("700");
    expect(current).toMatchObject({ variant: "body", typography: { fontSize: 22 } });
    expect(current).not.toHaveProperty("styleDetached");
  });

  it("lets a local alignment override the linked fallback", async () => {
    const content = {
      type: "rich-text" as const,
      runs: [{ text: "Text", marks: { bold: true, color: "#123456" } }],
    };
    await mount(text({ content, typography: { textAlign: "left" } }), presentation([
      { id: "body", typography: { textAlign: "center" } },
    ]));

    const alignment = host.querySelector<HTMLSelectElement>("#text-text-align");
    if (!alignment) throw new Error("alignment control was not rendered");
    expect(alignment.value).toBe("left");
    expect(alignment.disabled).toBe(false);
    await act(async () => {
      alignment.value = "right";
      alignment.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(current.typography?.textAlign).toBe("right");
    expect(current.content).toEqual(content);
  });

  it("shows an inherited font family and allows a local override", async () => {
    const source = presentation([
      { id: "body", typography: { fontFamily: "Inter" } },
    ]);
    await mount(text(), source);
    const input = host.querySelector<HTMLInputElement>("#text-font-family");
    if (!input) throw new Error("font family control was not rendered");
    expect(input.value).toBe("");
    expect(input.placeholder).toBe("Inter");
    expect(input.disabled).toBe(false);
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (!setter) throw new Error("input value setter was not available");
    await act(async () => {
      input.focus();
      setter.call(input, "Arial Black");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      input.blur();
    });
    expect(current.typography?.fontFamily).toBe("Arial Black");
    expect(current.variant).toBe("body");
    expect(source.textStyles?.[0]).toMatchObject({ typography: { fontFamily: "Inter" } });
  });

  it("allows a local edit of a linked effective length", async () => {
    await mount(text({ typography: { fontSize: 12 } }), presentation([
      { id: "body", typography: { fontSize: 20 } },
    ]));
    const input = host.querySelector<HTMLInputElement>("#text-font-size");
    if (!input) throw new Error("font size control was not rendered");
    expect(input.disabled).toBe(false);
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (!setter) throw new Error("input value setter was not available");
    await act(async () => {
      setter.call(input, "30");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.blur();
    });
    expect(current.typography?.fontSize).toBe(30);
    expect(current.variant).toBe("body");
  });

  it("keeps omitted alignment editable and does not lock theme defaults", async () => {
    await mount(text({ typography: { textAlign: "left" } }), presentation());
    const alignment = host.querySelector<HTMLSelectElement>("#text-text-align");
    if (!alignment) throw new Error("alignment control was not rendered");
    expect(alignment.value).toBe("left");
    expect(alignment.disabled).toBe(false);
    await act(async () => {
      alignment.value = "right";
      alignment.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(current.typography?.textAlign).toBe("right");
  });

  it("allows local margin overrides while using linked margins as fallback", async () => {
    await mount(text({ layout: { marginTop: 20, marginBottom: 30 } }), presentation([
      { id: "body", layout: { marginTop: 10 } },
    ]));
    const top = host.querySelector<HTMLInputElement>("#text-margin-top");
    const bottom = host.querySelector<HTMLInputElement>("#text-margin-bottom");
    if (!top || !bottom) throw new Error("margin controls were not rendered");
    expect(top.value).toBe("20");
    expect(top.disabled).toBe(false);
    expect(bottom.value).toBe("30");
    expect(bottom.disabled).toBe(false);
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      if (!setter) throw new Error("input value setter was not available");
      setter.call(top, "40");
      top.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const editableBottom = host.querySelector<HTMLInputElement>("#text-margin-bottom");
    if (!editableBottom) throw new Error("margin bottom control was not rendered after update");
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      if (!setter) throw new Error("input value setter was not available");
      setter.call(editableBottom, "35");
      editableBottom.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(current.layout).toEqual({ marginTop: 40, marginBottom: 35 });
  });

  it("keeps all Text margin controls enabled while linked", async () => {
    await mount(text(), presentation([{
      id: "body",
      layout: { margin: 1, marginTop: 2, marginRight: 3, marginBottom: 4, marginLeft: 5 },
    }]));
    for (const selector of ["#text-margin", "#text-margin-top", "#text-margin-right", "#text-margin-bottom", "#text-margin-left"]) {
      expect(host.querySelector<HTMLInputElement>(selector)?.disabled).toBe(false);
    }
  });

  it("allows local color and stroke overrides without locking background or shadow", async () => {
    await mount(text({
      style: { color: "#ff0000", background: { color: "#eeeeee" } },
      typography: { textStroke: { width: 1, color: "#ff0000" } },
    }), presentation([{
      id: "body",
      style: { color: "#00ff00" },
      typography: { textStroke: { width: 3, color: "#0000ff" } },
    }]));
    expect(host.querySelector<HTMLInputElement>("#text-color-value")?.value).toBe("#ff0000");
    expect(host.querySelector<HTMLInputElement>("#text-color-value")?.disabled).toBe(false);
    expect(host.querySelector<HTMLInputElement>("#text-background-value")?.disabled).toBe(false);
    expect(host.querySelector<HTMLSelectElement>("#text-text-stroke-mode")?.disabled).toBe(false);
    expect(host.querySelector<HTMLInputElement>("#text-text-stroke-width")?.disabled).toBe(false);
    expect(host.querySelector<HTMLInputElement>("#text-text-stroke-color-value")?.disabled).toBe(false);
    expect(host.querySelector<HTMLSelectElement>("#text-shadow-mode")?.disabled).toBe(false);
    expect(host.querySelector<HTMLInputElement>("#text-text-stroke-width")?.value).toBe("1");
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (!setter) throw new Error("input value setter was not available");
    await act(async () => {
      const color = host.querySelector<HTMLInputElement>("#text-color-value");
      if (!color) throw new Error("text color control was not rendered");
      setter.call(color, "#123456");
      color.dispatchEvent(new Event("input", { bubbles: true }));
      const mode = host.querySelector<HTMLSelectElement>("#text-text-stroke-mode");
      if (!mode) throw new Error("text stroke mode control was not rendered");
      const width = host.querySelector<HTMLInputElement>("#text-text-stroke-width");
      if (!width) throw new Error("text stroke width control was not rendered");
      setter.call(width, "9");
      width.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(current.style?.color).toBe("#123456");
    expect(current.typography?.textStroke).toMatchObject({ width: 9, color: "#ff0000" });
  });

  it("preserves inherited stroke color when locally editing inherited width", async () => {
    const source = presentation([{ id: "body", typography: { textStroke: { width: 3, color: "#0000ff" } } }]);
    await mount(text(), source);
    expect(host.querySelector<HTMLInputElement>("#text-text-stroke-width")?.value).toBe("3");
    expect(host.querySelector<HTMLInputElement>("#text-text-stroke-color-value")?.value).toBe("#0000ff");

    const width = host.querySelector<HTMLInputElement>("#text-text-stroke-width");
    if (!width) throw new Error("text stroke width control was not rendered");
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (!setter) throw new Error("input value setter was not available");
    await act(async () => {
      setter.call(width, "9");
      width.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(current.typography?.textStroke).toEqual({ width: 9, color: "#0000ff" });
    expect(current.variant).toBe("body");
    expect(source.textStyles?.[0]).toMatchObject({ typography: { textStroke: { width: 3, color: "#0000ff" } } });
  });

  it("preserves inherited stroke width when locally editing inherited color", async () => {
    const source = presentation([{ id: "body", typography: { textStroke: { width: 3, color: "#0000ff" } } }]);
    await mount(text(), source);
    const color = host.querySelector<HTMLInputElement>("#text-text-stroke-color-value");
    if (!color) throw new Error("text stroke color control was not rendered");
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (!setter) throw new Error("input value setter was not available");
    await act(async () => {
      setter.call(color, "#ff0000");
      color.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(current.typography?.textStroke).toEqual({ width: 3, color: "#ff0000" });
    expect(current.variant).toBe("body");
    expect(source.textStyles?.[0]).toMatchObject({ typography: { textStroke: { width: 3, color: "#0000ff" } } });
  });

  it("authors local None while preserving an inherited stroke color", async () => {
    const source = presentation([{ id: "body", typography: { textStroke: { width: 3, color: "#0000ff" } } }]);
    await mount(text(), source);
    const mode = host.querySelector<HTMLSelectElement>("#text-text-stroke-mode");
    if (!mode) throw new Error("text stroke mode control was not rendered");
    await act(async () => {
      mode.value = "none";
      mode.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(current.typography?.textStroke).toEqual({ width: 0, color: "#0000ff" });
    expect(current.variant).toBe("body");
    expect(source.textStyles?.[0]).toMatchObject({ typography: { textStroke: { width: 3, color: "#0000ff" } } });
  });

  it("displays None for a local zero-width stroke", async () => {
    await mount(text({ typography: { textStroke: { width: 0, color: "#0000ff" } } }), presentation([
      { id: "body", typography: { textStroke: { width: 3, color: "#0000ff" } } },
    ]));
    expect(host.querySelector<HTMLSelectElement>("#text-text-stroke-mode")?.value).toBe("none");
  });

  it("restores the linked width when switching local None back to Stroke", async () => {
    const source = presentation([{ id: "body", typography: { textStroke: { width: 3, color: "#0000ff" } } }]);
    await mount(text({ typography: { textStroke: { width: 0, color: "#0000ff" } } }), source);
    const mode = host.querySelector<HTMLSelectElement>("#text-text-stroke-mode");
    if (!mode) throw new Error("text stroke mode control was not rendered");
    await act(async () => {
      mode.value = "stroke";
      mode.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(current.typography?.textStroke).toEqual({ width: 3, color: "#0000ff" });
    expect(current.variant).toBe("body");
    expect(source.textStyles?.[0]).toMatchObject({ typography: { textStroke: { width: 3, color: "#0000ff" } } });
  });

  it("shows None after manually authoring stroke width zero", async () => {
    await mount(text({ typography: { textStroke: { width: 1, color: "#ff0000" } } }));
    const width = host.querySelector<HTMLInputElement>("#text-text-stroke-width");
    if (!width) throw new Error("text stroke width control was not rendered");
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (!setter) throw new Error("input value setter was not available");
    await act(async () => {
      setter.call(width, "0");
      width.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(current.typography?.textStroke).toEqual({ width: 0, color: "#ff0000" });
    expect(host.querySelector<HTMLSelectElement>("#text-text-stroke-mode")?.value).toBe("none");
  });

  it("edits both omitted and owned attached fields locally", async () => {
    const source = presentation([{ id: "body", typography: { fontFamily: "Inter", fontWeight: 500 } }]);
    await mount(text(), source);
    await act(async () => {
      const select = host.querySelector<HTMLSelectElement>("#text-font-weight")!;
      select.value = "700";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(host.querySelector<HTMLSelectElement>("#text-font-weight")?.value).toBe("700");
    expect(current).toMatchObject({ variant: "body" });
    expect(current).not.toHaveProperty("styleDetached");
    expect(current.typography?.fontFamily).toBeUndefined();
    expect(current.typography?.fontWeight).toBe(700);
    const fontSize = host.querySelector<HTMLInputElement>("#text-font-size");
    if (!fontSize) throw new Error("font size control was not rendered");
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (!setter) throw new Error("input value setter was not available");
    await act(async () => {
      setter.call(fontSize, "22");
      fontSize.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(current).toMatchObject({ typography: { fontSize: "22rem" } });
    expect(current.typography?.fontWeight).toBe(700);
    expect(source.textStyles?.[0]).toMatchObject({ typography: { fontWeight: 500 } });
  });

  it("offers explicit Detach and materializes the current effective typography", async () => {
    await mount(
      text({ typography: { fontSize: 22 }, style: { color: "#ff0000" }, layout: { marginTop: 20 } }),
      presentation([{ id: "body", typography: { fontFamily: "Inter", fontWeight: 500 }, style: { color: "#00ff00" }, layout: { marginTop: 10 } }]),
    );

    expect(host.textContent).toContain("Attached to Typography Style · Body");
    const detach = [...host.querySelectorAll("button")].find((button) => button.textContent === "Detach from Body");
    expect(detach).not.toBeUndefined();

    await act(async () => detach?.dispatchEvent(new MouseEvent("click", { bubbles: true })));

    expect(current).toMatchObject({
      variant: "body",
      styleDetached: true,
      typography: { fontFamily: "Inter", fontSize: 22, fontWeight: 500 },
      style: { color: "#ff0000" },
      layout: { marginTop: 20 },
    });
    expect(host.textContent).toContain("Local · detached from Body");
    expect(host.textContent).toContain("Attach to Body");
    expect(host.querySelector<HTMLInputElement>("#text-font-family")?.disabled).toBe(false);
    expect(host.querySelector<HTMLSelectElement>("#text-font-weight")?.disabled).toBe(false);
    expect(host.querySelector<HTMLInputElement>("#text-color-value")?.disabled).toBe(false);
    expect(host.querySelector<HTMLInputElement>("#text-margin-top")?.disabled).toBe(false);
  });

  it("detaches a custom style to its fundamental role without inheriting that role's override", async () => {
    await mount(text({ variant: "quote", typography: { fontSize: 24 } }), presentation([
      { id: "body", typography: { fontFamily: "Inter", fontWeight: 700 } },
      { id: "quote", name: "Quote", role: "body", typography: { fontStyle: "italic", fontFamily: "Fira Code" } },
    ]));

    expect(host.textContent).toContain("Attached to Typography Style · Quote");
    const detach = [...host.querySelectorAll("button")].find((button) => button.textContent === "Detach from Quote");
    await act(async () => detach?.dispatchEvent(new MouseEvent("click", { bubbles: true })));

    expect(current).toMatchObject({
      variant: "body",
      styleDetached: true,
      typography: { fontFamily: "Fira Code", fontStyle: "italic", fontSize: 24, fontWeight: 400 },
    });
    expect(current.typography).not.toHaveProperty("fontWeight", 700);
    expect(host.querySelector<HTMLSelectElement>("#text-variant")?.value).toBe("body");
  });

  it("keeps detached typography stable when the Presentation Style changes", async () => {
    await mount(text({ typography: { fontSize: 22 } }), presentation([
      { id: "body", typography: { fontFamily: "Inter", fontWeight: 400 } },
    ]));
    const detach = [...host.querySelectorAll("button")].find((button) => button.textContent === "Detach from Body");
    await act(async () => detach?.dispatchEvent(new MouseEvent("click", { bubbles: true })));

    await mount(current, presentation([
      { id: "body", typography: { fontFamily: "Another Family", fontSize: 30, fontWeight: 700 } },
    ]));

    expect(current).toMatchObject({ typography: { fontFamily: "Inter", fontSize: 22, fontWeight: 400 } });
    expect(host.querySelector<HTMLInputElement>("#text-font-family")?.value).toBe("Inter");
    expect(host.querySelector<HTMLSelectElement>("#text-font-weight")?.value).toBe("400");
  });

  it("switches styles with fresh Attach semantics and preserves effects", async () => {
    await mount(text({
      typography: {
        fontSize: 22,
        fontWeight: 700,
        textDecorationColor: "#ff0000",
        textStroke: { width: 1, color: "#ffffff" },
      },
    }), presentation([{ id: "quote", name: "Quote", role: "body", typography: { fontStyle: "italic" } }]));
    await act(async () => {
      const select = host.querySelector<HTMLSelectElement>("#text-variant")!;
      select.value = "quote";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(current).toMatchObject({ variant: "quote" });
    expect(current).toMatchObject({ typography: { fontSize: 22, fontWeight: 700, textDecorationColor: "#ff0000" } });
    expect(current).not.toHaveProperty("typography.fontStyle");
    expect(current).not.toHaveProperty("styleDetached");

    await act(async () => {
      const select = host.querySelector<HTMLSelectElement>("#text-variant")!;
      select.value = "title";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(current).toMatchObject({ variant: "title" });
    expect(current).toMatchObject({ typography: { fontSize: 22, fontWeight: 700, textDecorationColor: "#ff0000" } });
    expect(current).not.toHaveProperty("styleDetached");
  });

  it("keeps Style identity separate from detached status and supports explicit Attach", async () => {
    await mount(text({ styleDetached: true, typography: { fontSize: 22 } }));
    expect(host.querySelector<HTMLSelectElement>("#text-variant")?.value).toBe("body");
    expect(host.textContent).toContain("Local · detached from Body");
    const attach = [...host.querySelectorAll("button")].find((button) => button.textContent === "Attach to Body");
    expect(attach).not.toBeUndefined();

    await act(async () => attach?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(current).toMatchObject({ variant: "body" });
    expect(current).not.toHaveProperty("styleDetached");
    expect(current).toMatchObject({ typography: { fontSize: 22 } });
    expect(host.querySelector<HTMLSelectElement>("#text-variant")?.value).toBe("body");
  });

  it("Attach preserves local properties when the target Style owns none", async () => {
    await mount(text({
      styleDetached: true,
      typography: {
        fontSize: 22,
        textStroke: { width: 1, color: "#ffffff" },
        textDecorationColor: "#ff0000",
      },
    }));

    const attach = [...host.querySelectorAll("button")].find((button) => button.textContent === "Attach to Body");
    await act(async () => attach?.dispatchEvent(new MouseEvent("click", { bubbles: true })));

    expect(current).toMatchObject({ variant: "body" });
    expect(current).toMatchObject({ typography: { fontSize: 22, textDecorationColor: "#ff0000" } });
    expect(current).toHaveProperty("typography.textStroke");
    expect(current).not.toHaveProperty("styleDetached");
  });

  it("Attach strips only properties explicitly owned by the target Style", async () => {
    await mount(text({
      styleDetached: true,
      typography: { textAlign: "left", fontSize: 26, fontWeight: 400 },
      style: { color: "#ff0000", background: { color: "#eeeeee" }, className: "local-text" },
      layout: { marginTop: 20, marginBottom: 30, position: "absolute", top: 5 },
      effect: { opacity: 0.7 },
      link: { kind: "url", href: "https://example.com", target: "_blank" },
    }), presentation([{
      id: "quote",
      name: "Quote",
      role: "body",
      typography: { textAlign: "center", fontWeight: 700 },
      style: { color: "#ff0000" },
      layout: { marginTop: 20 },
    }]));

    const select = host.querySelector<HTMLSelectElement>("#text-variant");
    if (!select) throw new Error("Text Style selector was not rendered");
    await act(async () => {
      select.value = "quote";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(current).toMatchObject({
      variant: "quote",
      typography: { fontSize: 26 },
      style: { background: { color: "#eeeeee" }, className: "local-text" },
      layout: { marginBottom: 30, position: "absolute", top: 5 },
      effect: { opacity: 0.7 },
      link: { href: "https://example.com" },
    });
    expect(current).not.toHaveProperty("typography.textAlign");
    expect(current).not.toHaveProperty("typography.fontWeight");
    expect(current).not.toHaveProperty("style.color");
    expect(current).not.toHaveProperty("layout.marginTop");
  });

  it("Attach removes layout when all local margins are owned by the target Style", async () => {
    await mount(text({
      styleDetached: true,
      layout: { marginTop: 20, marginBottom: 30 },
    }), presentation([{
      id: "quote",
      name: "Quote",
      role: "body",
      layout: { marginTop: 10, marginBottom: 15 },
    }]));

    const select = host.querySelector<HTMLSelectElement>("#text-variant");
    if (!select) throw new Error("Text Style selector was not rendered");
    await act(async () => {
      select.value = "quote";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(current).not.toHaveProperty("layout");
  });

  it("preserves Effects controls and custom role baseline semantics", async () => {
    await mount(text({ variant: "quote", typography: { fontSize: 24, textStroke: { width: 1, color: "#fff" }, textDecorationColor: "#f00" } }), presentation([
      { id: "body", typography: { fontFamily: "Inter", fontWeight: 600 } },
      { id: "quote", name: "Quote", role: "body", typography: { fontStyle: "italic" } },
    ]));

    expect(host.querySelector<HTMLSelectElement>("#text-font-style")?.value).toBe("italic");
    expect(host.querySelector<HTMLSelectElement>("#text-font-weight")?.value).toBe("400");
    expect(host.querySelector("#text-text-stroke-mode")).not.toBeNull();
    expect(host.querySelector("#text-text-decoration-line")).not.toBeNull();
  });

  it("gives text stroke color its own Inspector row", async () => {
    await mount(text({ typography: { textStroke: { width: 1, color: "#ffffff" } } }));

    const width = host.querySelector<HTMLInputElement>("#text-text-stroke-width");
    const color = host.querySelector<HTMLInputElement>("#text-text-stroke-color-value");

    expect(width?.closest("label")?.parentElement?.className).toContain("fieldGrid");
    expect(color?.closest("label")?.parentElement?.className).not.toContain("fieldGrid");
  });

  it("shows linked and local provenance for typography and resets only the selected property", async () => {
    await mount(text({ typography: { fontSize: 30, textAlign: "right" } }), presentation([
      { id: "body", typography: { fontSize: 20, textAlign: "center" } },
    ]));

    const fontSize = host.querySelector<HTMLInputElement>("#text-font-size");
    const textAlign = host.querySelector<HTMLSelectElement>("#text-text-align");
    expect(fontSize?.parentElement?.parentElement?.textContent).toContain("Local override");
    expect(fontSize?.parentElement?.parentElement?.textContent).toContain("Linked:");
    expect(textAlign?.parentElement?.textContent).toContain("Local override");
    expect(textAlign?.parentElement?.textContent).toContain("Linked:");

    const reset = fontSize?.parentElement?.parentElement?.querySelector("button");
    expect(reset?.textContent).toBe("Reset");
    await act(async () => reset?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(current.typography).toEqual({ textAlign: "right" });
    expect(current.variant).toBe("body");
    expect(host.querySelector<HTMLInputElement>("#text-font-size")?.value).toBe("1.25");
    expect(host.querySelector<HTMLInputElement>("#text-font-size")?.parentElement?.parentElement?.textContent).toContain("Linked");
  });

  it("marks equal authored values as local and resets an omitted master property to theme", async () => {
    await mount(text({ typography: { fontWeight: 500, fontSize: 30 } }), presentation([
      { id: "body", typography: { fontWeight: 500 } },
    ]));

    expect(host.querySelector("#text-font-weight")?.parentElement?.textContent).toContain("Local override");
    const reset = host.querySelector("#text-font-weight")?.parentElement?.querySelector("button");
    await act(async () => reset?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(current.typography).toEqual({ fontSize: 30 });
    expect(host.querySelector("#text-font-weight")?.parentElement?.textContent).not.toContain("Local override");
  });

  it("resets color without changing unrelated visual fields", async () => {
    await mount(text({
      style: { color: "#ff0000", background: { color: "#eeeeee" }, borderRadius: "4px", className: "keep" },
    }), presentation([{ id: "body", style: { color: "#00ff00" } }]), {
      id: "parent",
      type: "container",
      hidden: false,
      style: { color: "#ff00ff" },
      children: [],
    });

    const color = host.querySelector<HTMLInputElement>("#text-color-value");
    const meta = color?.closest("label");
    expect(meta?.textContent).toContain("Local override");
    expect(meta?.textContent).not.toContain("Use theme default");
    expect(meta?.textContent).not.toContain("Use inherited color");
    const reset = meta?.querySelector("button");
    await act(async () => reset?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(current.style).toEqual({ background: { color: "#eeeeee" }, borderRadius: "4px", className: "keep" });
    expect(host.querySelector<HTMLInputElement>("#text-color-value")?.value).toBe("#00ff00");
    expect(host.querySelector("#text-color-value")?.closest("label")?.textContent).toContain("Linked");
  });

  it("uses the property Reset for a local color when the master omits color", async () => {
    await mount(text({ style: { color: "#ff0000" } }), presentation([{ id: "body", typography: { fontSize: 20 } }]), {
      id: "parent",
      type: "container",
      hidden: false,
      style: { color: "#ff00ff" },
      children: [],
    });
    const meta = host.querySelector<HTMLInputElement>("#text-color-value")?.closest("label");
    expect(meta?.textContent).toContain("Local override");
    expect(meta?.textContent).not.toContain("Use theme default");
    expect(meta?.textContent).not.toContain("Use inherited color");
    const reset = Array.from(meta?.querySelectorAll("button") ?? []).find((button) => button.textContent?.trim() === "Reset");
    await act(async () => reset?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(current).not.toHaveProperty("style.color");
    expect(current.variant).toBe("body");
    expect(host.querySelector("#text-color-value")?.closest("label")?.textContent).not.toContain("Linked");
  });

  it("keeps Use theme default for detached Text color", async () => {
    await mount(text({ styleDetached: true, style: { color: "#ff0000" } }), presentation([
      { id: "body", style: { color: "#00ff00" } },
    ]));
    const meta = host.querySelector<HTMLInputElement>("#text-color-value")?.closest("label");
    expect(meta?.textContent).toContain("Use theme default");
    const action = Array.from(meta?.querySelectorAll("button") ?? []).find((button) => button.textContent?.trim() === "Use theme default");
    await act(async () => action?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(current.style?.color).toBeUndefined();
    expect(current).toHaveProperty("styleDetached", true);
  });

  it("keeps margin properties independent when resetting one side", async () => {
    await mount(text({ layout: { margin: 10, marginTop: 30, marginRight: 20, marginBottom: 40, marginLeft: 50 } }), presentation([
      { id: "body", layout: { marginTop: 15, marginBottom: 25 } },
    ]));
    const top = host.querySelector<HTMLInputElement>("#text-margin-top");
    const reset = top?.closest("label")?.querySelector("button");
    await act(async () => reset?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(current.layout).toEqual({ margin: 10, marginRight: 20, marginBottom: 40, marginLeft: 50 });
  });

  it("resets the whole local text stroke including width-zero None", async () => {
    await mount(text({ typography: { textStroke: { width: 0, color: "#0000ff" }, fontSize: 22 } }), presentation([
      { id: "body", typography: { textStroke: { width: 3, color: "#ff0000" } } },
    ]));
    expect(host.textContent).toContain("Local override");
    const strokeMode = host.querySelector("#text-text-stroke-mode");
    const reset = strokeMode?.closest("label")?.querySelector("button");
    await act(async () => reset?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(current.typography).toEqual({ fontSize: 22 });
  });

  it("shows decoration color provenance and resets only decoration color", async () => {
    await mount(text({ typography: { textDecorationColor: "#111111", fontWeight: 600 } }), presentation([
      { id: "body", typography: { textDecorationColor: "#222222" } },
    ]));
    const decoration = host.querySelector<HTMLInputElement>("#text-text-decoration-color-value");
    const meta = decoration?.closest("label");
    expect(meta?.textContent).toContain("Local override");
    const reset = meta?.querySelector("button");
    await act(async () => reset?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(current.typography).toEqual({ fontWeight: 600 });
  });

  it("does not show property provenance controls while detached", async () => {
    await mount(text({ styleDetached: true, typography: { fontSize: 22, textStroke: { width: 1, color: "#fff" } } }), presentation([
      { id: "body", typography: { fontSize: 20, textStroke: { width: 3, color: "#000" } } },
    ]));
    expect(host.querySelectorAll(".inheritedValueLabel")).toHaveLength(0);
    expect(host.textContent).not.toContain("Reset linked override");
  });

  it("does not stringify a palette linked color", async () => {
    await mount(text({ style: { color: "#ff0000" } }), presentation([
      { id: "body", style: { color: { kind: "palette", colorId: "primary" } } },
    ], { colors: [{ id: "primary", name: "Primary", value: "#336699" }] }));
    const meta = host.querySelector<HTMLInputElement>("#text-color-value")?.closest("label");
    expect(meta?.textContent).toContain("Local override");
    expect(meta?.textContent).not.toContain("[object Object]");
    expect(Array.from(meta?.querySelectorAll("button") ?? []).find((button) => button.textContent?.trim() === "Reset")).toBeTruthy();
  });

  it("does not stringify a structured linked text stroke", async () => {
    await mount(text({ typography: { textStroke: { width: 1, color: "#0000ff" } } }), presentation([
      { id: "body", typography: { textStroke: { width: 3, color: { kind: "palette", colorId: "outline" } } } },
    ], { colors: [{ id: "outline", name: "Outline", value: "#336699" }] }));
    const meta = host.querySelector("#text-text-stroke-mode")?.closest("label");
    expect(meta?.textContent).toContain("Local override");
    expect(meta?.textContent).not.toContain("[object Object]");
    expect(meta?.querySelector("button")?.textContent).toBe("Reset");
  });

  it("resets a real master-omitted local font size to the theme fallback", async () => {
    await mount(text({ typography: { fontSize: 30 } }), presentation());
    const field = host.querySelector<HTMLInputElement>("#text-font-size")?.parentElement?.parentElement;
    expect(field?.textContent).toContain("Local override");
    expect(field?.textContent).not.toContain("Linked:");
    const reset = Array.from(field?.querySelectorAll("button") ?? []).find((button) => button.textContent?.trim() === "Reset");
    await act(async () => reset?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(current).not.toHaveProperty("typography.fontSize");
    expect(current.variant).toBe("body");
    const updated = host.querySelector<HTMLInputElement>("#text-font-size")?.parentElement?.parentElement;
    expect(updated?.textContent).not.toContain("Local override");
    expect(updated?.textContent).not.toContain("Linked");
    expect(host.querySelector<HTMLInputElement>("#text-font-size")?.value).toBe("1.125");
  });

  it("shows provenance through attach, switch, and detach", async () => {
    await mount(text({ variant: "style-a" }), presentation([
      { id: "style-a", name: "Style A", role: "body", typography: { fontSize: 20, textAlign: "center" } },
      { id: "style-b", name: "Style B", role: "body", typography: { fontSize: 24 } },
    ]));
    expect(host.querySelector("#text-font-size")?.parentElement?.parentElement?.textContent).toContain("Linked");
    expect(host.querySelector("#text-text-align")?.parentElement?.textContent).toContain("Linked");

    const variant = host.querySelector<HTMLSelectElement>("#text-variant");
    if (!variant) throw new Error("Text Style selector was not rendered");
    await act(async () => {
      variant.value = "style-b";
      variant.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(current).toMatchObject({ variant: "style-b" });
    expect(current).not.toHaveProperty("typography.textAlign");
    expect(host.querySelector("#text-font-size")?.parentElement?.parentElement?.textContent).toContain("Linked");
    expect(host.querySelector("#text-text-align")?.parentElement?.textContent).not.toContain("Local override");

    const detach = [...host.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.trim() === "Detach from Style B");
    if (!detach) throw new Error("Detach button was not rendered");
    await act(async () => detach.click());
    expect(current).toHaveProperty("styleDetached", true);
    expect(host.querySelectorAll(".inheritedValueLabel")).toHaveLength(0);
    expect(host.textContent).toContain("Local · detached from Body");
  });

  it("threads the active Presentation through ElementInspector to TextInspector", async () => {
    const customPresentation = presentation([{ id: "quote", name: "Quote", role: "body" }]);
    current = text();
    activePresentation = customPresentation;
    await act(async () => root.render(
      <StudioI18nProvider>
        <ElementInspector
          element={current}
          presentation={activePresentation}
          onUpdate={(update) => { current = update(current) as TextElement; }}
          onContainerFitModeChange={() => true}
          fontResources={fonts}
          preserveImageProportion={false}
          onPreserveImageProportionChange={() => {}}
          focalEditingImageId={null}
          onFocalEditingImageIdChange={() => {}}
          parent={null}
          layerControls={null}
          topicsAuthoringControls={topics}
          tableAuthoringControls={tables}
        />
      </StudioI18nProvider>,
    ));

    expect(host.querySelector("#text-variant option[value='quote']")?.textContent).toBe("Quote");
  });
});
