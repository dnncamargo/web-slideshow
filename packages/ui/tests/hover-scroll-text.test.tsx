// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HoverScrollText } from "../src/index";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const LONG_TEXT =
  "A very long slide title that overflows the available width and needs hover scrolling";

function pointerEnter(element: HTMLElement) {
  element.dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
}

function pointerLeave(element: HTMLElement) {
  element.dispatchEvent(new MouseEvent("pointerout", { bubbles: true }));
}

function mockMeasurements(
  wrapper: HTMLElement,
  wrapperClientWidth: number,
  inner: HTMLElement,
  innerScrollWidth: number,
) {
  Object.defineProperty(wrapper, "clientWidth", {
    configurable: true,
    get: () => wrapperClientWidth,
  });
  Object.defineProperty(inner, "scrollWidth", {
    configurable: true,
    get: () => innerScrollWidth,
  });
}

describe("HoverScrollText", () => {
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

  it("renders one clipped wrapper with the full text available for accessibility", () => {
    act(() => {
      root.render(<HoverScrollText text={LONG_TEXT} />);
    });

    const wrapper = container.querySelector<HTMLElement>(".ps-ui-hover-scroll");
    const inner = container.querySelector<HTMLElement>(
      ".ps-ui-hover-scroll__inner",
    );

    expect(wrapper).not.toBeNull();
    expect(inner).not.toBeNull();
    expect(wrapper?.parentElement).toBe(container);

    // The complete text remains in the DOM and in the native title attribute.
    expect(inner?.textContent).toBe(LONG_TEXT);
    expect(wrapper?.getAttribute("title")).toBe(LONG_TEXT);
    expect(wrapper?.textContent).toBe(LONG_TEXT);
  });

  it("keeps short text identical in the DOM contract", () => {
    act(() => {
      root.render(<HoverScrollText text="Short" />);
    });

    const wrapper = container.querySelector(".ps-ui-hover-scroll");
    expect(wrapper?.textContent).toBe("Short");
    expect(wrapper?.getAttribute("title")).toBe("Short");
    expect(wrapper?.querySelector(".ps-ui-hover-scroll__inner")?.textContent).toBe(
      "Short",
    );
  });

  it("measures the actual overflow distance and resolves a positive offset for overflowing text", () => {
    vi.useFakeTimers();

    act(() => {
      root.render(<HoverScrollText text={LONG_TEXT} />);
    });

    const wrapper = container.querySelector<HTMLElement>(".ps-ui-hover-scroll");
    const inner = container.querySelector<HTMLElement>(
      ".ps-ui-hover-scroll__inner",
    );

    if (!wrapper || !inner) {
      throw new Error("expected hover-scroll wrapper and inner spans");
    }

    // Wrapper shows 100px, inner content is 280px: overflow is 180px and is
    // published as the negative translate distance.
    mockMeasurements(wrapper, 100, inner, 280);

    act(() => {
      pointerEnter(wrapper);
    });

    expect(
      inner.style.getPropertyValue("--ps-ui-hover-scroll-offset"),
    ).toBe("180px");

    // No timers or animation loops are involved.
    expect(vi.getTimerCount()).toBe(0);

    vi.useRealTimers();
  });

  it("resolves zero offset for short text and returns to the start on pointer leave", () => {
    act(() => {
      root.render(<HoverScrollText text="Short" />);
    });

    const wrapper = container.querySelector<HTMLElement>(".ps-ui-hover-scroll");
    const inner = container.querySelector<HTMLElement>(
      ".ps-ui-hover-scroll__inner",
    );

    if (!wrapper || !inner) {
      throw new Error("expected hover-scroll wrapper and inner spans");
    }

    // 80px of text inside a 100px wrapper never overflows.
    mockMeasurements(wrapper, 100, inner, 80);

    act(() => {
      pointerEnter(wrapper);
    });

    expect(
      inner.style.getPropertyValue("--ps-ui-hover-scroll-offset"),
    ).toBe("0px");

    // An overflowing title returns to its start on pointer leave.
    mockMeasurements(wrapper, 100, inner, 280);

    act(() => {
      pointerEnter(wrapper);
    });

    expect(
      inner.style.getPropertyValue("--ps-ui-hover-scroll-offset"),
    ).toBe("180px");

    act(() => {
      pointerLeave(wrapper);
    });

    expect(
      inner.style.getPropertyValue("--ps-ui-hover-scroll-offset"),
    ).toBe("0px");
  });

  it("accepts an explicit title override", () => {
    act(() => {
      root.render(<HoverScrollText text="Shown" title="Full stored title" />);
    });

    const wrapper = container.querySelector(".ps-ui-hover-scroll");
    expect(wrapper?.getAttribute("title")).toBe("Full stored title");
    expect(wrapper?.textContent).toBe("Shown");
  });
});