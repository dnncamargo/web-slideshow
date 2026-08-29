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
} from "@powershow/document-schema";

import { TextInspector } from "../src/features/editor/inspector/text-inspector";
import { ElementInspector } from "../src/features/editor/element-inspector";
import type { BlocksAuthoringControls, TableAuthoringControls, TopicsAuthoringControls } from "../src/features/editor/inspector/inspector-types";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const fonts: readonly { id: string; family: string }[] = [];
const topics: TopicsAuthoringControls = { onAddTopLevelTopic: () => null, onAddChildTopic: () => null };
const blocks: BlocksAuthoringControls = { onAddRootBlock: () => null, onAddScopeChild: () => null, onAddTextPart: () => null, onAddSocketPart: () => null, onCreateSocketValue: () => null };
const tables: TableAuthoringControls = { onAddColumn: () => {}, onRemoveColumn: () => {}, onAddRow: () => {}, onRemoveRow: () => {}, onShowHeaderChange: () => {} };

function presentation(textStyles: unknown[] = []): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "presentation",
    title: "Presentation",
    slides: [{ id: "slide", elements: [] }],
    ...(textStyles.length > 0 ? { textStyles } : {}),
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

  function renderInspector(): void {
    root.render(
      <StudioI18nProvider>
        <TextInspector
          element={current}
          presentation={activePresentation}
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

  async function mount(element: TextElement, nextPresentation = presentation()): Promise<void> {
    current = element;
    activePresentation = nextPresentation;
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

  it("displays Presentation-effective values without writing on mount", async () => {
    const source = presentation([{ id: "body", typography: { fontFamily: "Inter", fontSize: 20, fontWeight: 500 } }]);
    await mount(text(), source);

    expect(host.querySelector<HTMLInputElement>("#text-font-size")?.value).toBe("1.25");
    expect(host.querySelector<HTMLSelectElement>("#text-font-family")?.value).toBe("Inter");
    expect(host.querySelector<HTMLSelectElement>("#text-font-weight")?.value).toBe("500");
    expect(updates).toHaveLength(0);
    expect(source.textStyles?.[0]).toMatchObject({ id: "body", typography: { fontSize: 20 } });
  });

  it("keeps an attached local override local while inherited values change", async () => {
    const first = presentation([{ id: "body", typography: { fontFamily: "Inter", fontWeight: 500 } }]);
    await mount(text({ typography: { fontSize: 22 } }), first);
    expect(host.querySelector<HTMLInputElement>("#text-font-size")?.value).toBe("22");
    expect(host.querySelector<HTMLSelectElement>("#text-font-family")?.value).toBe("Inter");
    expect(host.querySelector<HTMLSelectElement>("#text-font-weight")?.value).toBe("500");

    await mount(current, presentation([{ id: "body", typography: { fontFamily: "Roboto", fontWeight: 700 } }]));
    expect(host.querySelector<HTMLInputElement>("#text-font-size")?.value).toBe("22");
    expect(host.querySelector<HTMLSelectElement>("#text-font-family")?.value).toBe("Roboto");
    expect(host.querySelector<HTMLSelectElement>("#text-font-weight")?.value).toBe("700");
    expect(current).toMatchObject({ variant: "body", typography: { fontSize: 22 } });
    expect(current).not.toHaveProperty("styleDetached");
  });

  it("edits one attached field without materializing effective typography", async () => {
    const source = presentation([{ id: "body", typography: { fontFamily: "Inter", fontWeight: 500 } }]);
    await mount(text(), source);
    await act(async () => {
      const select = host.querySelector<HTMLSelectElement>("#text-font-weight")!;
      select.value = "700";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(current).toMatchObject({ variant: "body", typography: { fontWeight: 700 } });
    expect(current).not.toHaveProperty("styleDetached");
    expect(current.typography).not.toHaveProperty("fontFamily");
    expect(source.textStyles?.[0]).toMatchObject({ typography: { fontWeight: 500 } });
  });

  it("offers explicit Detach and materializes the current effective typography", async () => {
    await mount(
      text({ typography: { fontSize: 22 } }),
      presentation([{ id: "body", typography: { fontFamily: "Inter", fontWeight: 500 } }]),
    );

    expect(host.textContent).toContain("Linked style · Body");
    const detach = [...host.querySelectorAll("button")].find((button) => button.textContent === "Detach");
    expect(detach).not.toBeUndefined();

    await act(async () => detach?.dispatchEvent(new MouseEvent("click", { bubbles: true })));

    expect(current).toMatchObject({
      variant: "body",
      styleDetached: true,
      typography: { fontFamily: "Inter", fontSize: 22, fontWeight: 500 },
    });
    expect(host.textContent).toContain("Local typography · Body");
    expect(host.textContent).toContain("Attach");
  });

  it("detaches a custom style to its fundamental role without inheriting that role's override", async () => {
    await mount(text({ variant: "quote", typography: { fontSize: 24 } }), presentation([
      { id: "body", typography: { fontFamily: "Inter", fontWeight: 700 } },
      { id: "quote", name: "Quote", role: "body", typography: { fontStyle: "italic", fontFamily: "Fira Code" } },
    ]));

    expect(host.textContent).toContain("Linked style · Quote");
    const detach = [...host.querySelectorAll("button")].find((button) => button.textContent === "Detach");
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
    const detach = [...host.querySelectorAll("button")].find((button) => button.textContent === "Detach");
    await act(async () => detach?.dispatchEvent(new MouseEvent("click", { bubbles: true })));

    await mount(current, presentation([
      { id: "body", typography: { fontFamily: "Another Family", fontSize: 30, fontWeight: 700 } },
    ]));

    expect(current).toMatchObject({ typography: { fontFamily: "Inter", fontSize: 22, fontWeight: 400 } });
    expect(host.querySelector<HTMLSelectElement>("#text-font-family")?.value).toBe("Inter");
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
    expect(current).not.toHaveProperty("typography");
    expect(current).not.toHaveProperty("typography.fontSize");
    expect(current).not.toHaveProperty("typography.fontWeight");
    expect(current).not.toHaveProperty("styleDetached");

    await act(async () => {
      const select = host.querySelector<HTMLSelectElement>("#text-variant")!;
      select.value = "title";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(current).toMatchObject({ variant: "title" });
    expect(current).not.toHaveProperty("typography");
    expect(current).not.toHaveProperty("styleDetached");
  });

  it("keeps Style identity separate from detached status and supports explicit Attach", async () => {
    await mount(text({ styleDetached: true, typography: { fontSize: 22 } }));
    expect(host.querySelector<HTMLSelectElement>("#text-variant")?.value).toBe("body");
    expect(host.textContent).toContain("Local typography");
    const attach = [...host.querySelectorAll("button")].find((button) => button.textContent === "Attach");
    expect(attach).not.toBeUndefined();

    await act(async () => attach?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(current).toMatchObject({ variant: "body" });
    expect(current).not.toHaveProperty("styleDetached");
    expect(current).not.toHaveProperty("typography");
    expect(host.querySelector<HTMLSelectElement>("#text-variant")?.value).toBe("body");
  });

  it("Attach strips detached overrides while preserving element-only typography", async () => {
    await mount(text({
      styleDetached: true,
      typography: {
        fontSize: 22,
        textStroke: { width: 1, color: "#ffffff" },
        textDecorationColor: "#ff0000",
      },
    }));

    const attach = [...host.querySelectorAll("button")].find((button) => button.textContent === "Attach");
    await act(async () => attach?.dispatchEvent(new MouseEvent("click", { bubbles: true })));

    expect(current).toMatchObject({ variant: "body" });
    expect(current).not.toHaveProperty("typography");
    expect(current).not.toHaveProperty("typography.fontSize");
    expect(current).not.toHaveProperty("styleDetached");
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
          blocksAuthoringControls={blocks}
          tableAuthoringControls={tables}
        />
      </StudioI18nProvider>,
    ));

    expect(host.querySelector("#text-variant option[value='quote']")?.textContent).toBe("Quote");
  });
});
