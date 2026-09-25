// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PresentationSchema, type ContainerElement, type Presentation } from "@web-slideshow/document-schema";
import { containerLinkedStyle } from "./linked-style-test-helpers";

import { ContainerInspector } from "../src/features/editor/inspector/container-inspector";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";
import { BACKGROUND_PATTERN_PRESETS } from "../src/features/editor/inspector/sections/element-background-pattern";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const linkedPattern = BACKGROUND_PATTERN_PRESETS.find((preset) => preset.id === "art-deco")!.pattern;

function changeInput(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("Linked Container Pattern inspector", () => {
  let host: HTMLDivElement;
  let root: Root;
  let state: ContainerElement;
  let presentation: Presentation;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    presentation = PresentationSchema.parse({
      schemaVersion: 1,
      id: "linked-pattern-presentation",
      title: "Linked Pattern",
      linkedStyles: [{ id: "pattern-style", name: "Pattern style", style: { background: { pattern: linkedPattern } } }],
      slides: [{ id: "slide", title: "Slide", elements: [] }],
    });
    state = { id: "pattern-container", type: "container", hidden: false, children: [], linkedStyleId: "pattern-style" };
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  function render(): void {
    root.render(
      <StudioI18nProvider>
        <ContainerInspector
          element={state}
          presentation={presentation}
          onUpdate={(update) => {
            state = update(state) as ContainerElement;
            render();
          }}
          onContainerFitModeChange={() => true}
        />
      </StudioI18nProvider>,
    );
  }

  it("authors and resets an atomic local Pattern override from the effective Linked Pattern", async () => {
    await act(async () => render());

    const size = host.querySelector<HTMLInputElement>("#container-background-pattern-size");
    expect(size?.value).toBe("80");
    expect(host.textContent).toContain("Linked");
    expect(host.querySelector<HTMLInputElement>("#container-background-pattern-rotation")?.value).toBe("0");

    await act(async () => changeInput(size!, "96"));

    expect(state.style?.background?.pattern).toMatchObject({
      image: linkedPattern.image,
      colors: linkedPattern.colors,
      size: "192px 134.04px",
    });
    expect(state.style?.background?.pattern?.rotation).toBeUndefined();
    expect(containerLinkedStyle(presentation.linkedStyles?.[0])?.style?.background?.pattern).toEqual(linkedPattern);
    expect(host.textContent).toContain("Local override");
    expect(host.textContent).toContain("Linked");

    const reset = Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.trim() === "Reset" && !button.disabled);
    expect(reset).not.toBeUndefined();
    await act(async () => reset?.click());

    expect(state.style?.background?.pattern).toBeUndefined();
    expect(containerLinkedStyle(presentation.linkedStyles?.[0])?.style?.background?.pattern).toEqual(linkedPattern);
    expect(host.querySelector<HTMLInputElement>("#container-background-pattern-size")?.value).toBe("80");
  });
});
