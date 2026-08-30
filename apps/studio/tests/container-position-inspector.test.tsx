// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  PowerShowElementSchema,
  PresentationSchema,
  type ContainerElement,
  type PowerShowElement,
  type Presentation,
} from "@powershow/document-schema";

import { ContainerInspector } from "../src/features/editor/inspector/container-inspector";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function containerElement(
  overrides: Partial<ContainerElement> = {},
): ContainerElement {
  return {
    type: "container",
    id: "container-position",
    hidden: false,
    children: [],
    ...overrides,
  };
}

function changeSelect(select: HTMLSelectElement, value: string): void {
  select.value = value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function changeInput(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("Container canonical position inspector", () => {
  let host: HTMLDivElement;
  let root: Root;
  let state: PowerShowElement;
  let moves: number[];
  let linkedPresentation: Presentation | undefined;

  function renderInspector(parent: ContainerElement | null = null): void {
    root.render(
      <StudioI18nProvider>
        <ContainerInspector
          element={state as ContainerElement}
          presentation={linkedPresentation}
          onContainerFitModeChange={() => true}
          parent={parent}
          layerControls={{
            index: 1,
            count: 3,
            onMoveTo: (index) => moves.push(index),
          }}
          onUpdate={(update) => {
            state = update(state);
            renderInspector(parent);
          }}
        />
      </StudioI18nProvider>,
    );
  }

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    moves = [];
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    linkedPresentation = undefined;
    document.body.innerHTML = "";
  });

  it("renders Flow without direct edge controls or legacy placement controls", async () => {
    state = containerElement();
    await act(async () => renderInspector());

    expect(
      host.querySelector<HTMLSelectElement>("#container-position-mode")?.value,
    ).toBe("flow");
    expect(host.querySelector("#container-position-top")).toBeNull();
    expect(host.textContent).not.toContain("Anchor");
    expect(host.textContent).not.toContain("X offset");
    expect(host.querySelector("#container-preserve-size")).toBeNull();
  });

  it("shows Preserve size only for a child in an effective Flow parent", async () => {
    state = containerElement();
    await act(async () => renderInspector(containerElement()));
    expect(host.querySelector("#container-preserve-size")).not.toBeNull();

    await act(async () =>
      renderInspector(containerElement({ layout: { children: { mode: "flow" } } })),
    );
    expect(host.querySelector("#container-preserve-size")).not.toBeNull();

    await act(async () =>
      renderInspector(containerElement({ layout: { children: { mode: "stack" } } })),
    );
    expect(host.querySelector("#container-preserve-size")).toBeNull();

    state = containerElement({ layout: { position: "absolute" } });
    await act(async () => renderInspector(containerElement()));
    expect(host.querySelector("#container-preserve-size")).toBeNull();
  });

  it("authors Preserve size without disturbing layout and cleans up when unchecked", async () => {
    state = containerElement({
      layout: {
        width: "80%",
        height: 100,
        padding: 12,
        children: { direction: "row" },
      },
    });
    const parent = containerElement();
    await act(async () => renderInspector(parent));

    await act(async () =>
      (host.querySelector("#container-preserve-size") as HTMLInputElement).click(),
    );
    expect(state.layout).toMatchObject({
      flexShrink: 0,
      width: "80%",
      height: 100,
      padding: 12,
      children: { direction: "row" },
    });

    await act(async () =>
      (host.querySelector("#container-preserve-size") as HTMLInputElement).click(),
    );
    expect(state.layout).toEqual({
      width: "80%",
      height: 100,
      padding: 12,
      children: { direction: "row" },
    });

    state = containerElement({ layout: { flexShrink: 0 } });
    await act(async () => renderInspector(parent));
    await act(async () =>
      (host.querySelector("#container-preserve-size") as HTMLInputElement).click(),
    );
    expect(state.layout).toBeUndefined();
  });

  it("preserves authored size across Absolute and Flow", async () => {
    state = containerElement({ layout: { flexShrink: 0 } });
    const parent = containerElement();
    await act(async () => renderInspector(parent));
    expect(host.querySelector<HTMLInputElement>("#container-preserve-size")?.checked).toBe(true);

    await act(async () =>
      changeSelect(host.querySelector("#container-position-mode")!, "absolute"),
    );
    expect(state.layout?.flexShrink).toBe(0);
    expect(host.querySelector("#container-preserve-size")).toBeNull();

    await act(async () =>
      changeSelect(host.querySelector("#container-position-mode")!, "flow"),
    );
    expect(state.layout?.flexShrink).toBe(0);
    expect(host.querySelector<HTMLInputElement>("#container-preserve-size")?.checked).toBe(true);
  });

  it("enters Absolute with top and left defaults while preserving layout", async () => {
    state = containerElement({
      layout: {
        width: "80%",
        height: 200,
        padding: 16,
        children: { direction: "row" },
      },
    });
    await act(async () => renderInspector());
    await act(async () =>
      changeSelect(host.querySelector("#container-position-mode")!, "absolute"),
    );

    expect(state.layout).toMatchObject({
      position: "absolute",
      top: 0,
      left: 0,
      width: "80%",
      height: 200,
      padding: 16,
    });
    expect(state.layout?.children).toEqual({ direction: "row" });
    expect(PowerShowElementSchema.safeParse(state).success).toBe(true);
  });

  it("writes all direct edges independently and allows opposite edges", async () => {
    state = containerElement({ layout: { position: "absolute" } });
    await act(async () => renderInspector());

    for (const [edge, value] of [
      ["top", "10"],
      ["right", "20"],
      ["bottom", "30"],
      ["left", "40"],
    ] as const) {
      await act(async () =>
        changeInput(host.querySelector(`#container-position-${edge}`)!, value),
      );
    }

    expect(state.layout).toMatchObject({
      position: "absolute",
      top: 10,
      right: 20,
      bottom: 30,
      left: 40,
    });
    expect(PowerShowElementSchema.safeParse(state).success).toBe(true);
  });

  it("clears one edge and all positioning fields when returning to Flow", async () => {
    state = containerElement({
      layout: {
        position: "absolute",
        top: 10,
        right: 20,
        bottom: 30,
        left: 40,
        width: 100,
        children: { mode: "stack" },
      },
    });
    await act(async () => renderInspector());
    await act(async () =>
      changeInput(host.querySelector("#container-position-right")!, ""),
    );
    expect(state.layout).toMatchObject({
      position: "absolute",
      top: 10,
      bottom: 30,
      left: 40,
      width: 100,
    });
    expect(state.layout?.right).toBeUndefined();

    await act(async () =>
      changeSelect(host.querySelector("#container-position-mode")!, "flow"),
    );
    expect(state.layout).toEqual({ width: 100, children: { mode: "stack" } });
    expect(PowerShowElementSchema.safeParse(state).success).toBe(true);
  });

  it("shows layer controls for absolute Containers and stack-parent flow Containers", async () => {
    state = containerElement({ layout: { position: "absolute" } });
    await act(async () => renderInspector());
    expect(host.textContent).toContain("Send to back");
    await act(async () =>
      Array.from(host.querySelectorAll<HTMLButtonElement>("button"))
        .find((button) => button.textContent === "Send to back")?.click(),
    );
    expect(moves).toEqual([0]);

    state = containerElement();
    await act(async () =>
      renderInspector(
        containerElement({ layout: { children: { mode: "stack" } } }),
      ),
    );
    expect(host.textContent).toContain("Send to back");
  });

  it("writes and resets a Linked edge without materializing sibling edges", async () => {
    linkedPresentation = PresentationSchema.parse({ schemaVersion: 1, id: "p", title: "P", slides: [{ id: "s", title: "S", elements: [] }], linkedStyles: [{ id: "linked", name: "Linked", layout: { position: "absolute", top: 10, left: 20 } }] });
    state = containerElement({ linkedStyleId: "linked" });
    await act(async () => renderInspector());
    await act(async () => changeInput(host.querySelector("#container-position-top")!, "30"));
    expect(state.layout).toMatchObject({ position: "absolute", top: 30 });
    expect(state.layout?.left).toBeUndefined();
    expect(linkedPresentation.linkedStyles?.[0]?.layout).toMatchObject({ position: "absolute", top: 10, left: 20 });
    const reset = host.querySelector("#container-position-top")?.closest("label")?.querySelector("button");
    expect(reset).not.toBeNull();
    await act(async () => (reset as HTMLButtonElement).click());
    expect(state.layout?.top).toBeUndefined();
    expect(state.layout?.position).toBeUndefined();
  });
});
