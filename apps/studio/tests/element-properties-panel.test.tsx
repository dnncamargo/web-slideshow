// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PowerShowElement } from "@powershow/document-schema";

import { ElementPropertiesPanel } from "../src/features/editor/element-properties-panel";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function renderPanel(
  root: Root,
  element: PowerShowElement | null,
  isStructuralTopicSelection = false,
): void {
  act(() => {
    root.render(
      <StudioI18nProvider>
        <ElementPropertiesPanel
          selectedElement={element}
          isStructuralTopicSelection={isStructuralTopicSelection}
        />
      </StudioI18nProvider>,
    );
  });
}

describe("ElementPropertiesPanel", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = "";
  });

  it("shows a neutral empty state when no element is selected", () => {
    renderPanel(root, null);

    expect(container.textContent).toContain("Properties");
    expect(container.textContent).toContain("No element selected.");
  });

  it("shows identity and authored canonical values for text and image elements", () => {
    renderPanel(root, {
      type: "text",
      id: "hero-title",
      hidden: false,
      variant: "title",
      content: "Introduction to PWM",
      layout: { position: "absolute", top: "8%" },
    });

    expect(container.textContent).toContain("Text · hero-title");
    expect(container.textContent).toContain("contentIntroduction to PWM");
    expect(container.textContent).toContain("layout.positionabsolute");

    renderPanel(root, {
      type: "image",
      id: "company-logo",
      hidden: false,
      src: "https://example.com/logo.svg",
      alt: "PowerShow",
      fit: "contain",
    });

    expect(container.textContent).toContain("Image · company-logo");
    expect(container.textContent).toContain("srchttps://example.com/logo.svg");
  });

  it("does not expose a Topics element as the selected ContentSlot", () => {
    renderPanel(
      root,
      {
        type: "topics",
        id: "topics-1",
        hidden: false,
        kind: "unordered",
        items: [],
      },
      true,
    );

    expect(container.textContent).toContain("Content slot");
    expect(container.textContent).toContain("Structural authoring context");
    expect(container.textContent).not.toContain("Topics · topics-1");
    expect(container.textContent).not.toContain("items0 items");
  });
});
