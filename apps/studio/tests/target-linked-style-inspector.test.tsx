// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PresentationSchema, type LinkedStyle, type Presentation, type PresentationElement } from "@web-slideshow/document-schema";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";
import { CodeInspector } from "../src/features/editor/inspector/code-inspector";
import { TerminalInspector } from "../src/features/editor/inspector/terminal-inspector";
import { TableInspector } from "../src/features/editor/inspector/table-inspector";
import { DividerInspector } from "../src/features/editor/inspector/divider-inspector";
import { ContainerInspector } from "../src/features/editor/inspector/container-inspector";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const styles: LinkedStyle[] = [
  { id: "container", name: "Container", layout: { children: { gap: 1 } } },
  { target: "topics", id: "topics", name: "Topics", kind: "unordered", itemGap: 1 },
  { target: "code", id: "code-a", name: "Code A", style: { color: "#111" } },
  { target: "code", id: "code-b", name: "Code B", style: { color: "#222" } },
  { target: "terminal", id: "terminal", name: "Terminal", style: { outputColor: "#111" } },
  { target: "table", mode: "simple", id: "simple", name: "Simple", style: { color: "#111" } },
  { target: "table", mode: "structured", id: "structured", name: "Structured", style: { headerBackground: "#111" } },
  { target: "divider", id: "divider", name: "Divider", style: { background: { color: "#111" } } },
];

const code: Extract<PresentationElement, { type: "code" }> = { id: "code", type: "code", hidden: false, code: "x", language: "text", showLineNumbers: true, highlightedLines: [] };
const terminal: Extract<PresentationElement, { type: "terminal" }> = { id: "terminal", type: "terminal", hidden: false, lines: [] };
const simple: Extract<PresentationElement, { type: "table" }> = { id: "simple", type: "table", hidden: false, columns: [{ key: "value", label: "Value" }], rows: [{ value: "one" }] };
const explicitSimple = { ...simple, mode: "simple" as const };
const structured: Extract<PresentationElement, { type: "table" }> = { id: "structured", type: "table", mode: "structured", hidden: false, showHeader: true, columns: [], rows: [] };
const divider: Extract<PresentationElement, { type: "divider" }> = { id: "divider", type: "divider", hidden: false, orientation: "vertical" };

function renderInspector(
  element: PresentationElement,
  callbacks: { attach?: (id: string) => void; detach?: () => void; update?: (update: (current: PresentationElement) => PresentationElement) => void } = {},
  linkedStyles: ReadonlyArray<LinkedStyle> = styles,
) {
  callbacks = { attach: callbacks.attach ?? (() => {}), detach: callbacks.detach ?? (() => {}) };
  const relationship = {
    ...(callbacks.attach ? { onAttachLinkedStyle: callbacks.attach } : {}),
    ...(callbacks.detach ? { onDetachLinkedStyle: callbacks.detach } : {}),
  };
  const presentation = { linkedStyles } as Presentation;
  if (element.type === "code") return <CodeInspector element={element} onUpdate={callbacks.update ?? (() => {})} presentation={presentation} fontResources={[]} {...relationship} />;
  if (element.type === "terminal") return <TerminalInspector element={element} onUpdate={callbacks.update ?? (() => {})} presentation={presentation} fontResources={[]} {...relationship} />;
  if (element.type === "divider") return <DividerInspector element={element} onUpdate={callbacks.update ?? (() => {})} presentation={presentation} {...relationship} />;
  if (element.type !== "table") throw new Error("expected target inspector element");
  return <TableInspector element={element} onUpdate={callbacks.update ?? (() => {})} presentation={presentation} fontResources={[]} {...relationship} tableAuthoringControls={{ onAddColumn: () => {}, onRemoveColumn: () => {}, onAddRow: () => {}, onRemoveRow: () => {}, onShowHeaderChange: () => {} }} />;
}

describe("target Linked Style Inspector relationships", () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => { host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); });
  afterEach(async () => { await act(async () => root.unmount()); document.body.innerHTML = ""; });

  function options(): string[] {
    return Array.from(host.querySelector<HTMLSelectElement>("select[id$='-linked-style']")?.options ?? [], (option) => option.text);
  }

  it("filters Code, Terminal, and Divider definitions and wires attach/detach", async () => {
    const attach = vi.fn(); const detach = vi.fn();
    await act(async () => root.render(<StudioI18nProvider>{renderInspector({ ...code, linkedStyleId: "code-a" }, { attach, detach })}</StudioI18nProvider>));
    expect(options()).toEqual(["None", "Code A", "Code B"]);
    const select = host.querySelector<HTMLSelectElement>("#code-linked-style")!;
    await act(async () => { select.value = "code-b"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(attach).toHaveBeenCalledWith("code-b");
    await act(async () => { select.value = ""; select.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(detach).toHaveBeenCalledOnce();

    await act(async () => root.render(<StudioI18nProvider>{renderInspector(terminal)}</StudioI18nProvider>));
    expect(options()).toEqual(["None", "Terminal"]);
    await act(async () => root.render(<StudioI18nProvider>{renderInspector(divider)}</StudioI18nProvider>));
    expect(options()).toEqual(["None", "Divider"]);
  });

  it.each([["omitted", simple, ["None", "Simple"]], ["explicit", explicitSimple, ["None", "Simple"]], ["structured", structured, ["None", "Structured"]]] as const)("filters Table %s mode", async (_name, element, expected) => {
    await act(async () => root.render(<StudioI18nProvider>{renderInspector(element)}</StudioI18nProvider>));
    expect(options()).toEqual(expected);
  });

  it("keeps target styles out of the Container dropdown", async () => {
    const element = { id: "container", type: "container" as const, hidden: false, children: [] };
    await act(async () => root.render(<StudioI18nProvider><ContainerInspector element={element} onUpdate={() => {}} onContainerFitModeChange={() => true} presentation={{ linkedStyles: styles }} /></StudioI18nProvider>));
    expect(Array.from(host.querySelector<HTMLSelectElement>("#container-linked-style")!.options, (option) => option.text)).toEqual(["None", "Container"]);
  });

  it("does not swap owned Divider dimensions when orientation changes", async () => {
    let current: Extract<PresentationElement, { type: "divider" }> = {
      ...divider,
      linkedStyleId: "divider",
      layout: { width: 12, height: 48 },
    };
    await act(async () => root.render(
      <StudioI18nProvider>
        <DividerInspector
          element={current}
          onUpdate={(update) => {
            const next = update(current);
            if (next.type !== "divider") throw new Error("Expected Divider update");
            current = next;
          }}
          presentation={PresentationSchema.parse({
            schemaVersion: 1,
            id: "divider-inspector",
            title: "Divider inspector",
            slides: [{ id: "slide", title: "Slide", elements: [current] }],
            linkedStyles: [{ target: "divider", id: "divider", name: "Divider", layout: { width: 2, height: 100 } }],
          })}
        />
      </StudioI18nProvider>,
    ));
    const select = host.querySelector<HTMLSelectElement>("#divider-orientation");
    expect(select).not.toBeNull();
    await act(async () => {
      select!.value = "horizontal";
      select!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(current).toMatchObject({ orientation: "horizontal", layout: { width: 12, height: 48 } });
  });

  it.each([
    ["width only", { width: 2 }, { width: 12, height: 48 }],
    ["height only", { height: 100 }, { width: 12, height: 48 }],
    ["both", { width: 2, height: 100 }, { width: 12, height: 48 }],
    ["neither", {}, { width: 48, height: 12 }],
  ] as const)("preserves the Divider orientation matrix for %s", async (_name, layout, expectedLayout) => {
    let current: Extract<PresentationElement, { type: "divider" }> = { ...divider, linkedStyleId: "matrix", layout: { width: 12, height: 48 } };
    await act(async () => root.render(
      <StudioI18nProvider>
        <DividerInspector
          element={current}
          onUpdate={(update) => { const next = update(current); if (next.type !== "divider") throw new Error("Expected Divider"); current = next; }}
          presentation={PresentationSchema.parse({ schemaVersion: 1, id: "divider-matrix", title: "Divider", slides: [{ id: "slide", title: "Slide", elements: [current] }], linkedStyles: [{ target: "divider", id: "matrix", name: "Matrix", layout, style: { background: { color: "#111111" } } }] })}
        />
      </StudioI18nProvider>,
    ));
    const select = host.querySelector<HTMLSelectElement>("#divider-orientation");
    if (!select) throw new Error("orientation control was not rendered");
    await act(async () => { select.value = "horizontal"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(current).toMatchObject({ orientation: "horizontal", layout: expectedLayout });
  });

  it("locks owned Code fields while leaving source controls editable", async () => {
    const style = {
      target: "code" as const,
      id: "code-owned",
      name: "Code owned",
      layout: { marginTop: 12 },
      typography: { fontSize: 24 },
      style: { background: { color: "#123456" } },
      effect: { shadow: { x: 1, y: 2, blur: 3, color: "#000000" } },
    };
    await act(async () => root.render(<StudioI18nProvider>{renderInspector({ ...code, linkedStyleId: style.id }, {}, [style])}</StudioI18nProvider>));
    expect(host.querySelector<HTMLInputElement>("#code-font-size")?.disabled).toBe(true);
    expect(host.querySelector<HTMLInputElement>("#code-margin-top")?.disabled).toBe(true);
    expect(host.querySelector<HTMLInputElement>("#code-background")).not.toBeNull();
    expect(host.querySelector<HTMLSelectElement>("#code-shadow-mode")?.disabled).toBe(true);
    expect(host.querySelector<HTMLInputElement>("#code-language")?.disabled).toBe(false);
    expect(host.querySelector<HTMLInputElement>("#code-show-line-numbers")?.disabled).toBe(false);
    expect(host.querySelector<HTMLInputElement>("#code-margin-left")?.disabled).toBe(false);
  });

  it("locks Terminal body/title typography and output color independently", async () => {
    const style = {
      target: "terminal" as const,
      id: "terminal-owned",
      name: "Terminal owned",
      typography: { fontSize: 18 },
      titleTypography: { fontSize: 20 },
      style: { outputColor: "#00ff00" },
    };
    await act(async () => root.render(<StudioI18nProvider>{renderInspector({ ...terminal, title: "Shell", linkedStyleId: style.id }, {}, [style])}</StudioI18nProvider>));
    expect(host.querySelector<HTMLInputElement>("#terminal-font-size")?.disabled).toBe(true);
    expect(host.querySelector<HTMLInputElement>("#terminal-title-font-size")?.disabled).toBe(true);
    expect(host.querySelector<HTMLElement>("#terminal-outputColor")).not.toBeNull();
    expect(host.querySelector<HTMLElement>("#terminal-commandColor")).not.toBeNull();
    expect(host.querySelector<HTMLInputElement>("#terminal-title")?.disabled).toBe(false);
  });

  it("keeps Simple Table mode omitted and mixes owned appearance members", async () => {
    const style = {
      target: "table" as const,
      mode: "simple" as const,
      id: "simple-owned",
      name: "Simple owned",
      typography: { fontSize: 16 },
      style: { background: { color: "#111111" } },
    };
    const element = { ...simple, linkedStyleId: style.id };
    await act(async () => root.render(<StudioI18nProvider>{renderInspector(element, {}, [style])}</StudioI18nProvider>));
    expect(element).not.toHaveProperty("mode");
    expect(host.querySelector<HTMLInputElement>("#table-font-size")?.disabled).toBe(true);
    expect(host.querySelector<HTMLInputElement>("#table-background")).not.toBeNull();
    expect(host.querySelector<HTMLInputElement>("#table-border-radius")?.disabled).toBe(false);
  });

  it("locks mixed Structured Table appearance while structural controls remain local", async () => {
    const style = {
      target: "table" as const,
      mode: "structured" as const,
      id: "structured-owned",
      name: "Structured owned",
      style: {
        background: { color: "#111111" },
        headerBackground: "#222222",
        bodyRowAlternateBackground: "#333333",
        dividerOpacity: 0.5,
      },
    };
    const element = { ...structured, linkedStyleId: style.id };
    await act(async () => root.render(<StudioI18nProvider>{renderInspector(element, {}, [style])}</StudioI18nProvider>));
    expect(host.querySelector<HTMLInputElement>("#table-background")).not.toBeNull();
    expect(host.querySelector<HTMLInputElement>("#table-header-background")).not.toBeNull();
    expect(host.querySelector<HTMLInputElement>("#table-body-row-alternate-background")).not.toBeNull();
    expect(host.querySelector<HTMLInputElement>("#table-divider-opacity")?.disabled).toBe(true);
    expect(host.querySelector<HTMLInputElement>("input[type='checkbox']")?.disabled).toBe(false);
  });

  it("keeps Divider orientation local while locking mixed dimensions and appearance", async () => {
    const style = {
      target: "divider" as const,
      id: "divider-mixed",
      name: "Divider mixed",
      layout: { width: 4 },
      style: { background: { color: "#111111" }, borderRadius: 6 },
      effect: { opacity: 0.4 },
    };
    await act(async () => root.render(<StudioI18nProvider>{renderInspector({ ...divider, linkedStyleId: style.id }, {}, [style])}</StudioI18nProvider>));
    expect(host.querySelector<HTMLInputElement>("#divider-width")?.disabled).toBe(true);
    expect(host.querySelector<HTMLInputElement>("#divider-height")?.disabled).toBe(false);
    expect(host.querySelector<HTMLInputElement>("#divider-background")).not.toBeNull();
    expect(host.querySelector<HTMLInputElement>("#divider-border-radius")?.disabled).toBe(true);
    expect(host.querySelector<HTMLInputElement>("#divider-opacity")?.disabled).toBe(true);
    expect(host.querySelector<HTMLSelectElement>("#divider-orientation")?.disabled).toBe(false);
  });

  it.each([
    ["Code position", { ...code, linkedStyleId: "code-disabled" }, [{ target: "code", id: "code-disabled", name: "Code", layout: { marginTop: 12 } }], "#code-margin-top"],
    ["Divider gradient", { ...divider, linkedStyleId: "divider-disabled" }, [{ target: "divider", id: "divider-disabled", name: "Divider", style: { background: { gradient: { type: "linear", stops: [{ color: "#000000", position: 0 }, { color: "#ffffff", position: 100 }] } } } }], "#divider-background-gradient-type"],
    ["Code border", { ...code, linkedStyleId: "code-border-disabled" }, [{ target: "code", id: "code-border-disabled", name: "Code", style: { border: { width: 1, style: "solid", color: "#000000" } } }], "#code-border-style"],
  ] as const)("ignores synthetic disabled interaction for %s", async (_name, element, linkedStyles, controlId) => {
    const update = vi.fn();
    await act(async () => root.render(<StudioI18nProvider>{renderInspector(element, { update }, linkedStyles as unknown as ReadonlyArray<LinkedStyle>)}</StudioI18nProvider>));
    const control = host.querySelector<HTMLElement>(controlId);
    if (!control) throw new Error(`missing disabled control ${controlId}`);
    expect("disabled" in control ? (control as HTMLInputElement).disabled : true).toBe(true);
    await act(async () => {
      control.dispatchEvent(new Event("focus", { bubbles: true }));
      control.dispatchEvent(new Event("input", { bubbles: true }));
      control.dispatchEvent(new Event("change", { bubbles: true }));
      control.dispatchEvent(new Event("blur", { bubbles: true }));
    });
    expect(update).not.toHaveBeenCalled();
    const undo = new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true });
    await act(async () => window.dispatchEvent(undo));
    expect(undo.defaultPrevented).toBe(false);
  });
});
