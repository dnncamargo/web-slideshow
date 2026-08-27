// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LiteralColorInput } from "../src/features/editor/color/literal-color-input";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("LiteralColorInput", () => {
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

  function render(value = "#facc15", onChange = vi.fn()) {
    act(() => root.render(
      <LiteralColorInput id="color" name="Color" value={value} onChange={onChange} />,
    ));
    return onChange;
  }

  it("renders picker, text, and format controls", () => {
    render();
    expect(container.querySelector("input[type=color]")).toBeTruthy();
    expect(container.querySelector<HTMLInputElement>("#color-value")?.value).toBe("#facc15");
    expect(container.querySelector<HTMLSelectElement>("#color-format")?.value).toBe("hex");
  });

  it("displays HEX and RGBA values", () => {
    render("#2563eb");
    expect(container.querySelector<HTMLInputElement>("#color-value")?.value).toBe("#2563eb");
    act(() => root.render(<LiteralColorInput id="color" name="Color" value="rgba(250, 204, 21, 0.4)" onChange={vi.fn()} />));
    expect(container.querySelector<HTMLInputElement>("#color-value")?.value).toBe("rgba(250, 204, 21, 0.4)");
    expect(container.querySelector<HTMLSelectElement>("#color-format")?.value).toBe("rgba");
  });

  it("reports normalized picker changes with source picker", () => {
    const onChange = render("#facc15");
    const picker = container.querySelector<HTMLInputElement>("input[type=color]");
    act(() => {
      if (picker) {
        setInputValue(picker, "#2563eb");
        picker.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    expect(onChange).toHaveBeenCalledWith("#2563eb", "picker");
  });

  it("reports valid HEX and RGBA text changes with source text", () => {
    const onChange = render();
    const input = container.querySelector<HTMLInputElement>("#color-value");
    act(() => {
      if (input) {
        setInputValue(input, "#22c55e");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    expect(onChange).toHaveBeenCalledWith("#22c55e", "text");

    act(() => {
      if (input) {
        setInputValue(input, "rgba(37, 99, 235, 0.4)");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    expect(onChange).toHaveBeenLastCalledWith("rgba(37, 99, 235, 0.4)", "text");
  });

  it("keeps invalid text as a draft without emitting", () => {
    const onChange = render();
    const input = container.querySelector<HTMLInputElement>("#color-value");
    act(() => {
      if (input) {
        setInputValue(input, "#f");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    expect(input?.value).toBe("#f");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("uses the valid value as the picker fallback after an invalid HEX draft", () => {
    const onChange = render("#facc15");
    const input = container.querySelector<HTMLInputElement>("#color-value");
    const picker = container.querySelector<HTMLInputElement>("input[type=color]");
    act(() => {
      if (input) {
        setInputValue(input, "#");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    expect(input?.value).toBe("#");
    expect(onChange).not.toHaveBeenCalled();

    act(() => {
      if (picker) {
        setInputValue(picker, "#2563eb");
        picker.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    expect(onChange).toHaveBeenCalledWith("#2563eb", "picker");
    expect(input?.value).toBe("#2563eb");
  });

  it("preserves RGBA alpha through the picker fallback after an invalid draft", () => {
    const onChange = render("rgba(10, 20, 30, 0.4)");
    const input = container.querySelector<HTMLInputElement>("#color-value");
    const picker = container.querySelector<HTMLInputElement>("input[type=color]");
    act(() => {
      if (input) {
        setInputValue(input, "rgba(");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    expect(input?.value).toBe("rgba(");
    expect(onChange).not.toHaveBeenCalled();

    act(() => {
      if (picker) {
        setInputValue(picker, "#facc15");
        picker.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    expect(onChange).toHaveBeenCalledWith("rgba(250, 204, 21, 0.4)", "picker");
    expect(input?.value).toBe("rgba(250, 204, 21, 0.4)");
  });

  it("converts HEX to RGBA and reports source format", () => {
    const onChange = render("#facc15");
    const select = container.querySelector<HTMLSelectElement>("#color-format");
    act(() => {
      if (select) {
        setInputValue(select, "rgba");
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    expect(container.querySelector<HTMLInputElement>("#color-value")?.value).toBe("rgba(250, 204, 21, 1)");
    expect(onChange).toHaveBeenCalledWith("rgba(250, 204, 21, 1)", "format");
  });

  it("converts RGBA to HEX according to formatter semantics", () => {
    const onChange = render("rgba(250, 204, 21, 0.4)");
    const select = container.querySelector<HTMLSelectElement>("#color-format");
    act(() => {
      if (select) {
        setInputValue(select, "hex");
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    expect(container.querySelector<HTMLInputElement>("#color-value")?.value).toBe("#facc1566");
    expect(onChange).toHaveBeenCalledWith("#facc1566", "format");
  });

  it("preserves RGBA alpha when the picker changes RGB", () => {
    const onChange = render("rgba(250, 204, 21, 0.4)");
    const picker = container.querySelector<HTMLInputElement>("input[type=color]");
    act(() => {
      if (picker) {
        setInputValue(picker, "#2563eb");
        picker.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    expect(onChange).toHaveBeenCalledWith("rgba(37, 99, 235, 0.4)", "picker");
  });

  it("synchronizes draft and format when value changes externally", () => {
    const onChange = render("#facc15");
    act(() => root.render(<LiteralColorInput id="color" name="Color" value="#2563eb" onChange={onChange} />));
    expect(container.querySelector<HTMLInputElement>("#color-value")?.value).toBe("#2563eb");
    expect(container.querySelector<HTMLSelectElement>("#color-format")?.value).toBe("hex");
  });

  it("disables all controls", () => {
    act(() => root.render(<LiteralColorInput id="color" name="Color" value="#facc15" disabled onChange={vi.fn()} />));
    expect(Array.from(container.querySelectorAll("input, select")).every((control) => (control as HTMLInputElement).disabled)).toBe(true);
  });
});

function setInputValue(input: HTMLInputElement | HTMLSelectElement, value: string): void {
  if (input instanceof HTMLSelectElement) {
    input.value = value;
    return;
  }

  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
}
