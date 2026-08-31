// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ContainerElement } from "@powershow/document-schema";

import { ContainerInspector } from "../src/features/editor/inspector/container-inspector";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("Container linked style Inspector section", () => {
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

  it("shows, selects, and detaches a linked Container without create controls", async () => {
    const attach = vi.fn();
    const detach = vi.fn();
    const element: ContainerElement = { id: "container", type: "container", hidden: false, linkedStyleId: "card", children: [] };
    await act(async () => root.render(
      <StudioI18nProvider>
        <ContainerInspector
          element={element}
          onUpdate={() => {}}
          onContainerFitModeChange={() => true}
          presentation={{ linkedStyles: [{ id: "card", name: "Card", layout: { children: { gap: 8 } } }, { id: "hero", name: "Hero", style: { borderRadius: 8 } }] }}
          onAttachLinkedStyle={attach}
          onDetachLinkedStyle={detach}
        />
      </StudioI18nProvider>,
    ));
    const select = host.querySelector<HTMLSelectElement>("#container-linked-style")!;
    expect(host.textContent).toContain("Linked style");
    expect(select.value).toBe("card");
    expect(Array.from(select.options).map((option) => option.text)).toContain("Card");
    expect(host.querySelector("#container-linked-style-name")).toBeNull();
    expect(host.textContent).toContain("Detach linked style");

    await act(async () => {
      select.value = "hero";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(attach).toHaveBeenCalledWith("hero");

    await act(async () => {
      select.value = "";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(detach).toHaveBeenCalledOnce();
  });
});
