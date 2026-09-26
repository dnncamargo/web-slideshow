// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Presentation, PresentationElement } from "@web-slideshow/document-schema";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";
import { CodeInspector } from "../src/features/editor/inspector/code-inspector";
import { TerminalInspector } from "../src/features/editor/inspector/terminal-inspector";
import { TableInspector } from "../src/features/editor/inspector/table-inspector";
import { DividerInspector } from "../src/features/editor/inspector/divider-inspector";
import { ContainerInspector } from "../src/features/editor/inspector/container-inspector";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const styles = [
  { id: "container", name: "Container", layout: { children: { gap: 1 } } },
  { target: "topics", id: "topics", name: "Topics", kind: "unordered", itemGap: 1 },
  { target: "code", id: "code-a", name: "Code A", style: { color: "#111" } },
  { target: "code", id: "code-b", name: "Code B", style: { color: "#222" } },
  { target: "terminal", id: "terminal", name: "Terminal", style: { outputColor: "#111" } },
  { target: "table", mode: "simple", id: "simple", name: "Simple", style: { color: "#111" } },
  { target: "table", mode: "structured", id: "structured", name: "Structured", style: { headerBackground: "#111" } },
  { target: "divider", id: "divider", name: "Divider", style: { background: { color: "#111" } } },
] as Presentation["linkedStyles"];

const code: Extract<PresentationElement, { type: "code" }> = { id: "code", type: "code", hidden: false, code: "x", language: "text", showLineNumbers: true, highlightedLines: [] };
const terminal: Extract<PresentationElement, { type: "terminal" }> = { id: "terminal", type: "terminal", hidden: false, lines: [] };
const simple: Extract<PresentationElement, { type: "table" }> = { id: "simple", type: "table", hidden: false, columns: [{ key: "value", label: "Value" }], rows: [{ value: "one" }] };
const explicitSimple = { ...simple, mode: "simple" as const };
const structured: Extract<PresentationElement, { type: "table" }> = { id: "structured", type: "table", mode: "structured", hidden: false, showHeader: true, columns: [], rows: [] };
const divider: Extract<PresentationElement, { type: "divider" }> = { id: "divider", type: "divider", hidden: false, orientation: "vertical" };

function renderInspector(element: PresentationElement, callbacks: { attach?: (id: string) => void; detach?: () => void } = {}) {
  callbacks = { attach: callbacks.attach ?? (() => {}), detach: callbacks.detach ?? (() => {}) };
  const relationship = {
    ...(callbacks.attach ? { onAttachLinkedStyle: callbacks.attach } : {}),
    ...(callbacks.detach ? { onDetachLinkedStyle: callbacks.detach } : {}),
  };
  const presentation = { linkedStyles: styles } as Presentation;
  if (element.type === "code") return <CodeInspector element={element} onUpdate={() => {}} presentation={presentation} fontResources={[]} {...relationship} />;
  if (element.type === "terminal") return <TerminalInspector element={element} onUpdate={() => {}} presentation={presentation} fontResources={[]} {...relationship} />;
  if (element.type === "divider") return <DividerInspector element={element} onUpdate={() => {}} presentation={presentation} {...relationship} />;
  if (element.type !== "table") throw new Error("expected target inspector element");
  return <TableInspector element={element} onUpdate={() => {}} presentation={presentation} fontResources={[]} {...relationship} tableAuthoringControls={{ onAddColumn: () => {}, onRemoveColumn: () => {}, onAddRow: () => {}, onRemoveRow: () => {}, onShowHeaderChange: () => {} }} />;
}

describe("target Linked Style Inspector relationships", () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => { host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host); });
  afterEach(async () => { await act(async () => root.unmount()); document.body.innerHTML = ""; });

  function options(id: string): string[] {
    return Array.from(host.querySelector<HTMLSelectElement>("select[id$='-linked-style']")?.options ?? [], (option) => option.text);
  }

  it("filters Code, Terminal, and Divider definitions and wires attach/detach", async () => {
    const attach = vi.fn(); const detach = vi.fn();
    await act(async () => root.render(<StudioI18nProvider>{renderInspector({ ...code, linkedStyleId: "code-a" }, { attach, detach })}</StudioI18nProvider>));
    expect(options("code")).toEqual(["None", "Code A", "Code B"]);
    const select = host.querySelector<HTMLSelectElement>("#code-linked-style")!;
    await act(async () => { select.value = "code-b"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(attach).toHaveBeenCalledWith("code-b");
    await act(async () => { select.value = ""; select.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(detach).toHaveBeenCalledOnce();

    await act(async () => root.render(<StudioI18nProvider>{renderInspector(terminal)}</StudioI18nProvider>));
    expect(options("terminal")).toEqual(["None", "Terminal"]);
    await act(async () => root.render(<StudioI18nProvider>{renderInspector(divider)}</StudioI18nProvider>));
    expect(options("divider")).toEqual(["None", "Divider"]);
  });

  it.each([["omitted", simple, ["None", "Simple"]], ["explicit", explicitSimple, ["None", "Simple"]], ["structured", structured, ["None", "Structured"]]] as const)("filters Table %s mode", async (_name, element, expected) => {
    await act(async () => root.render(<StudioI18nProvider>{renderInspector(element)}</StudioI18nProvider>));
    expect(options(element.id)).toEqual(expected);
  });

  it("keeps target styles out of the Container dropdown", async () => {
    const element = { id: "container", type: "container" as const, hidden: false, children: [] };
    await act(async () => root.render(<StudioI18nProvider><ContainerInspector element={element} onUpdate={() => {}} onContainerFitModeChange={() => true} presentation={{ linkedStyles: styles }} /></StudioI18nProvider>));
    expect(Array.from(host.querySelector<HTMLSelectElement>("#container-linked-style")!.options, (option) => option.text)).toEqual(["None", "Container"]);
  });
});
