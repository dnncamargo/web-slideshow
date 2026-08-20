// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { HoverScrollText } from "../src/index";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

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
    const text =
      "A very long slide title that overflows the available width and needs hover scrolling";

    act(() => {
      root.render(<HoverScrollText text={text} />);
    });

    const wrapper = container.querySelector(".ps-ui-hover-scroll");
    const inner = container.querySelector(".ps-ui-hover-scroll__inner");

    expect(wrapper).not.toBeNull();
    expect(inner).not.toBeNull();
    expect(wrapper?.parentElement).toBe(container);

    // The complete text remains in the DOM and in the native title attribute.
    expect(inner?.textContent).toBe(text);
    expect(wrapper?.getAttribute("title")).toBe(text);
    expect(wrapper?.textContent).toBe(text);
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

  it("accepts an explicit title override", () => {
    act(() => {
      root.render(<HoverScrollText text="Shown" title="Full stored title" />);
    });

    const wrapper = container.querySelector(".ps-ui-hover-scroll");
    expect(wrapper?.getAttribute("title")).toBe("Full stored title");
    expect(wrapper?.textContent).toBe("Shown");
  });
});