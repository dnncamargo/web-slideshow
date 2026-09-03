// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import type { BlocksElement } from "@powershow/document-schema";
import { BlocksContentSection } from "../src/features/editor/inspector/sections/blocks-content-section";
import type { ElementInspectorUpdate } from "../src/features/editor/inspector/inspector-types";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

const element = (source = ""): BlocksElement => ({ id: "blocks", type: "blocks", hidden: false, source });

describe("Blocks source Inspector", () => {
  it("exposes one controlled source textarea and writes its value", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    let current: BlocksElement = element("move [10] steps");
    const onUpdate: ElementInspectorUpdate = (update) => { current = update(current) as BlocksElement; };
    await act(async () => root.render(<StudioI18nProvider><BlocksContentSection element={current} onUpdate={onUpdate} /></StudioI18nProvider>));
    const textarea = host.querySelector("textarea");
    expect(textarea?.value).toBe("move [10] steps");
    if (!textarea) throw new Error("source textarea missing");
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(textarea, "repeat [10] times");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      textarea.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(current.source).toBe("repeat [10] times");
    await act(async () => root.unmount());
    host.remove();
  });

  it("does not expose recursive BlockItem controls", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<StudioI18nProvider><BlocksContentSection element={element("[scope] repeat")} onUpdate={() => {}} /></StudioI18nProvider>));
    expect(host.querySelectorAll("button, select")).toHaveLength(0);
    expect(host.textContent).toContain("Content");
    await act(async () => root.unmount());
    host.remove();
  });
});
