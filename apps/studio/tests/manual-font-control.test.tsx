// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ManualFontControl } from "../src/features/fonts/components/manual-font-control";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("ManualFontControl provenance", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  it("persists newly registered manual faces as external URLs", async () => {
    const onAddFontFace = vi.fn(() => true);
    await act(async () => root.render(
      <StudioI18nProvider>
        <ManualFontControl fontFamilies={[]} onAddFontFace={onAddFontFace} onFontAdded={vi.fn()} controlPrefix="manual-font" />
      </StudioI18nProvider>,
    ));

    for (const [id, value] of [["manual-font-family", "Example"], ["manual-font-url", "http://fonts.example.test/example.woff2"]]) {
      const input = container.querySelector<HTMLInputElement>(`#${id}`);
      if (!input) throw new Error(`missing ${id}`);
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        setter?.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    }

    const addButton = container.querySelector("button");
    if (!addButton) throw new Error("font registration button not found");
    await act(async () => addButton.click());
    expect(onAddFontFace).toHaveBeenCalledWith(
      "Example",
      expect.objectContaining({ source: expect.objectContaining({ url: "http://fonts.example.test/example.woff2" }) }),
      undefined,
      { kind: "external-url" },
    );
  });
});
