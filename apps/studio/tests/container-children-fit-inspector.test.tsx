// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ContainerElement } from "@web-slideshow/document-schema";

import { ContainerInspector } from "../src/features/editor/inspector/container-inspector";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function container(layout?: ContainerElement["layout"]): ContainerElement {
  return {
    id: "container-fit",
    type: "container",
    hidden: false,
    children: [],
    ...(layout === undefined ? {} : { layout }),
  };
}

describe("retired Container children fit Inspector", () => {
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

  function mount(element: ContainerElement): void {
    act(() => {
      root.render(
        <StudioI18nProvider>
          <ContainerInspector
            element={element}
            onUpdate={(update) => update(element)}
          />
        </StudioI18nProvider>,
      );
    });
  }

  it("does not expose a Container children fit control", () => {
    mount(container({ children: { fit: { mode: "cover", sourceWidth: 800, sourceHeight: 400 } } }));

    expect(host.querySelector("#container-children-fit")).toBeNull();
    expect(host.textContent).not.toContain("Children fit");
  });

  it("keeps ordinary Container layout controls available for historical data", () => {
    mount(container({ children: { direction: "row", gap: 16, fit: { mode: "contain", sourceWidth: 800, sourceHeight: 400 } } }));

    expect(host.querySelector("#container-direction")).not.toBeNull();
    expect(host.querySelector("#container-distribution")).not.toBeNull();
    expect(host.querySelector("#container-overflow")).not.toBeNull();
  });
});
