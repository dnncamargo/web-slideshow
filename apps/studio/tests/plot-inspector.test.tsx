// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { PlotElement } from "@powershow/document-schema";

import { PlotInspector } from "../src/features/editor/inspector/plot-inspector";
import type { PlotPreviewControls } from "../src/features/editor/inspector/inspector-types";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("Plot Inspector", () => {
  let host: HTMLDivElement;
  let root: Root;
  let current: PlotElement;
  let updateCount: number;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    current = { id: "plot-1", type: "plot", hidden: false, source: "y = x^2" };
    updateCount = 0;
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  function renderInspector(previewControls?: PlotPreviewControls): void {
    root.render(
      <StudioI18nProvider>
        <PlotInspector
          element={current}
          onUpdate={(update) => {
            updateCount += 1;
            const next = update(current);
            current = next.type === "plot" ? next : current;
            renderInspector();
          }}
          previewControls={previewControls}
        />
      </StudioI18nProvider>,
    );
  }

  function changeSource(source: string): void {
    const textarea = host.querySelector<HTMLTextAreaElement>("#plot-source");
    if (!textarea) throw new Error("Plot source textarea not found");
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(textarea, source);
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function changeFitToAxes(checked: boolean): void {
    const checkbox = host.querySelector<HTMLInputElement>("#plot-fit-to-axes");
    if (!checkbox) throw new Error("Plot fit-to-axes checkbox not found");
    if (checkbox.checked !== checked) {
      checkbox.click();
    }
  }

  function changeShowAxes(checked: boolean): void {
    const checkbox = host.querySelector<HTMLInputElement>("#plot-show-axes");
    if (!checkbox) throw new Error("Plot show-axes checkbox not found");
    if (checkbox.checked !== checked) checkbox.click();
  }

  function changeZColorMode(mode: "solid" | "z"): void {
    const select = host.querySelector<HTMLSelectElement>("#plot-z-color-mode");
    if (!select) throw new Error("Plot 3D color mode select not found");
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(select, mode);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function changeColor(id: string, value: string): void {
    const input = host.querySelector<HTMLInputElement>(`#${id}-value`);
    if (!input) throw new Error(`Plot color input not found: ${id}`);
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function removeColor(id: string): void {
    const input = host.querySelector<HTMLInputElement>(`#${id}-value`);
    const button = input?.closest("label")?.querySelector("button");
    if (!(button instanceof HTMLButtonElement)) throw new Error(`Plot color remove button not found: ${id}`);
    button.click();
  }

  function changeAxisThickness(value: string): void {
    const input = host.querySelector<HTMLInputElement>("#plot-axis-stroke-width");
    if (!input) throw new Error("Plot axis thickness input not found");
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.focus();
    input.blur();
  }

  function changeAnimationText(id: string, value: string): void {
    const input = host.querySelector<HTMLInputElement>(`#${id}`);
    if (!input) throw new Error(`Plot animation input not found: ${id}`);
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, value);
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function toggleAnimation(enabled: boolean): void {
    const checkbox = host.querySelector<HTMLInputElement>("#plot-animation-enabled");
    if (!checkbox) throw new Error("Plot animation checkbox not found");
    if (checkbox.checked !== enabled) checkbox.click();
  }

  function clickAnimationButton(id: "plot-animation-apply" | "plot-animation-reset"): void {
    const button = host.querySelector<HTMLButtonElement>(`#${id}`);
    if (!button) throw new Error(`Plot animation button not found: ${id}`);
    button.click();
  }

  function clickPreviewButton(id: "plot-animation-preview-play" | "plot-animation-preview-pause" | "plot-animation-preview-reset"): void {
    const button = host.querySelector<HTMLButtonElement>(`#${id}`);
    if (!button) throw new Error(`Plot preview button not found: ${id}`);
    button.click();
  }

  it.each([
    [undefined, true],
    [true, true],
    [false, false],
  ] as const)("renders fit-to-axes %j as checked=%j", async (fitToAxes, checked) => {
    current = {
      id: "plot-1",
      type: "plot",
      hidden: false,
      source: "y = x^2",
      ...(fitToAxes === undefined ? {} : { fitToAxes }),
    };

    await act(async () => renderInspector());

    expect(host.querySelector<HTMLInputElement>("#plot-fit-to-axes")?.checked).toBe(checked);
  });

  it("keeps Source in Content and exposes both controls in Appearance", async () => {
    await act(async () => renderInspector());

    const details = [...host.querySelectorAll("details")];
    expect(details[0]?.textContent).toContain("Source");
    expect(details[0]?.textContent).not.toContain("Fit to axes");
    const animation = details.find((detail) => detail.textContent?.includes("Animation"));
    const appearance = details.find((detail) => detail.textContent?.includes("Fit to axes"));
    expect(animation?.textContent).toContain("Animate parameter");
    expect(appearance?.textContent).toContain("Fit to axes");
    expect(appearance?.textContent).toContain("Show axes");
    expect(appearance?.textContent).toContain("Axis color");
    expect(appearance?.textContent).toContain("Axis thickness");
    expect(appearance?.textContent).toContain("Color");
    expect(appearance?.textContent).toContain("Background");
    expect(appearance?.textContent).toContain("3D color");
    expect(host.querySelector<HTMLSelectElement>("#plot-z-color-mode")?.value).toBe("solid");
  });

  it("hydrates existing animation without writing canonical state", async () => {
    current.animation = {
      parameter: "phase",
      from: -2,
      to: 3,
      durationMs: 2500,
      loop: false,
      autoplay: false,
    };

    await act(async () => renderInspector());

    expect(host.querySelector<HTMLInputElement>("#plot-animation-enabled")?.checked).toBe(true);
    expect(host.querySelector<HTMLInputElement>("#plot-animation-parameter")?.value).toBe("phase");
    expect(host.querySelector<HTMLInputElement>("#plot-animation-from")?.value).toBe("-2");
    expect(host.querySelector<HTMLInputElement>("#plot-animation-to")?.value).toBe("3");
    expect(host.querySelector<HTMLInputElement>("#plot-animation-duration")?.value).toBe("2500");
    expect(host.querySelector<HTMLInputElement>("#plot-animation-loop")?.checked).toBe(false);
    expect(host.querySelector<HTMLInputElement>("#plot-animation-autoplay")?.checked).toBe(false);
    expect(updateCount).toBe(0);
  });

  it("shows preview only for applied animation and keeps preview commands separate", async () => {
    const calls = { play: 0, pause: 0, reset: 0 };
    const controls: PlotPreviewControls = {
      onPlay: () => { calls.play += 1; },
      onPause: () => { calls.pause += 1; },
      onReset: () => { calls.reset += 1; },
    };

    await act(async () => renderInspector(controls));
    expect(host.querySelector("#plot-animation-preview-play")).toBeNull();
    await act(async () => toggleAnimation(true));
    expect(host.querySelector("#plot-animation-preview-play")).toBeNull();
    expect(updateCount).toBe(0);

    current.animation = { parameter: "t", from: 0, to: 10, durationMs: 1000, autoplay: false };
    await act(async () => renderInspector(controls));
    expect(host.querySelector("#plot-animation-preview-play")).not.toBeNull();
    expect(host.querySelector("#plot-animation-preview-pause")).not.toBeNull();
    expect(host.querySelector("#plot-animation-preview-reset")).not.toBeNull();

    await act(async () => clickPreviewButton("plot-animation-preview-play"));
    await act(async () => clickPreviewButton("plot-animation-preview-pause"));
    await act(async () => clickPreviewButton("plot-animation-preview-reset"));
    expect(calls).toEqual({ play: 1, pause: 1, reset: 1 });
    expect(updateCount).toBe(0);

    await act(async () => changeAnimationText("plot-animation-from", "99"));
    await act(async () => clickPreviewButton("plot-animation-preview-play"));
    expect(calls.play).toBe(2);
    expect(current.animation?.from).toBe(0);
    expect(updateCount).toBe(0);

    await act(async () => clickAnimationButton("plot-animation-reset"));
    expect(host.querySelector<HTMLInputElement>("#plot-animation-from")?.value).toBe("0");
    expect(calls.reset).toBe(1);

    await act(async () => changeAnimationText("plot-animation-from", "77"));
    await act(async () => clickPreviewButton("plot-animation-preview-reset"));
    expect(host.querySelector<HTMLInputElement>("#plot-animation-from")?.value).toBe("77");
    expect(calls.reset).toBe(2);
    expect(updateCount).toBe(0);
  });

  it("keeps enable defaults local until applying, then omits true flags", async () => {
    await act(async () => renderInspector());
    await act(async () => toggleAnimation(true));

    expect(current.animation).toBeUndefined();
    expect(host.querySelector<HTMLInputElement>("#plot-animation-parameter")?.value).toBe("t");
    expect(host.querySelector<HTMLInputElement>("#plot-animation-from")?.value).toBe("0");
    expect(host.querySelector<HTMLInputElement>("#plot-animation-to")?.value).toBe("6.283185307179586");
    expect(host.querySelector<HTMLInputElement>("#plot-animation-duration")?.value).toBe("4000");
    expect(host.querySelector<HTMLInputElement>("#plot-animation-loop")?.checked).toBe(true);
    expect(host.querySelector<HTMLInputElement>("#plot-animation-autoplay")?.checked).toBe(true);

    await act(async () => clickAnimationButton("plot-animation-apply"));
    expect(current.animation).toEqual({
      parameter: "t",
      from: 0,
      to: 6.283185307179586,
      durationMs: 4000,
    });
  });

  it("applies custom animation values while preserving unrelated Plot fields", async () => {
    current = {
      id: "plot-1",
      type: "plot",
      hidden: false,
      source: "y = sin(x + phase)",
      layout: { width: 320, height: 180 },
      fitToAxes: false,
      showAxes: false,
      style: { color: "#ff0000", background: { color: "#000000" }, zGradient: { minColor: "#7c3aed", maxColor: "#06b6d4" } },
    };
    await act(async () => renderInspector());
    await act(async () => toggleAnimation(true));
    await act(async () => changeAnimationText("plot-animation-parameter", "phase"));
    await act(async () => changeAnimationText("plot-animation-from", "-10"));
    await act(async () => changeAnimationText("plot-animation-to", "10"));
    await act(async () => changeAnimationText("plot-animation-duration", "5000"));
    await act(async () => host.querySelector<HTMLInputElement>("#plot-animation-loop")?.click());
    await act(async () => host.querySelector<HTMLInputElement>("#plot-animation-autoplay")?.click());
    await act(async () => clickAnimationButton("plot-animation-apply"));

    expect(current).toEqual({
      id: "plot-1",
      type: "plot",
      hidden: false,
      source: "y = sin(x + phase)",
      layout: { width: 320, height: 180 },
      fitToAxes: false,
      showAxes: false,
      style: { color: "#ff0000", background: { color: "#000000" }, zGradient: { minColor: "#7c3aed", maxColor: "#06b6d4" } },
      animation: { parameter: "phase", from: -10, to: 10, durationMs: 5000, loop: false, autoplay: false },
    });
  });

  it("accepts built-in-like parameters and rejects invalid drafts atomically", async () => {
    await act(async () => renderInspector());
    await act(async () => toggleAnimation(true));
    await act(async () => changeAnimationText("plot-animation-parameter", "sin"));
    await act(async () => clickAnimationButton("plot-animation-apply"));
    expect(current.animation?.parameter).toBe("sin");

    await act(async () => changeAnimationText("plot-animation-parameter", "x"));
    await act(async () => clickAnimationButton("plot-animation-apply"));
    expect(current.animation?.parameter).toBe("sin");
    expect(host.textContent).toContain("Check the animation settings.");

    await act(async () => changeAnimationText("plot-animation-parameter", "_t"));
    await act(async () => clickAnimationButton("plot-animation-apply"));
    expect(current.animation?.parameter).toBe("sin");
  });

  it.each([["plot-animation-from", ""], ["plot-animation-duration", "0"], ["plot-animation-duration", "1.5"]] as const)(
    "rejects invalid numeric draft %s=%s without a partial write",
    async (id, value) => {
      await act(async () => renderInspector());
      await act(async () => toggleAnimation(true));
      await act(async () => changeAnimationText(id, value));
      await act(async () => clickAnimationButton("plot-animation-apply"));
      expect(current.animation).toBeUndefined();
      expect(host.textContent).toContain("Check the animation settings.");
    },
  );

  it("accepts reverse and flat ranges", async () => {
    await act(async () => renderInspector());
    await act(async () => toggleAnimation(true));
    await act(async () => changeAnimationText("plot-animation-from", "10"));
    await act(async () => changeAnimationText("plot-animation-to", "-10"));
    await act(async () => clickAnimationButton("plot-animation-apply"));
    expect(current.animation).toMatchObject({ from: 10, to: -10 });

    await act(async () => changeAnimationText("plot-animation-to", "10"));
    await act(async () => clickAnimationButton("plot-animation-apply"));
    expect(current.animation).toMatchObject({ from: 10, to: 10 });
  });

  it("removes animation while preserving unrelated Plot fields", async () => {
    current = {
      id: "plot-1",
      type: "plot",
      hidden: false,
      source: "y = x + t",
      layout: { width: 320, height: 180 },
      style: { color: "#ff0000", background: { color: "#000000" } },
      animation: { parameter: "t", from: 0, to: 1, durationMs: 1000 },
    };
    await act(async () => renderInspector());
    await act(async () => toggleAnimation(false));
    await act(async () => clickAnimationButton("plot-animation-apply"));

    expect(current).toEqual({
      id: "plot-1",
      type: "plot",
      hidden: false,
      source: "y = x + t",
      layout: { width: 320, height: 180 },
      style: { color: "#ff0000", background: { color: "#000000" } },
    });
  });

  it("resets drafts without writing and rehydrates after element changes", async () => {
    current.animation = { parameter: "phase", from: 1, to: 2, durationMs: 1000 };
    await act(async () => renderInspector());
    await act(async () => changeAnimationText("plot-animation-from", "99"));
    expect(current.animation.from).toBe(1);
    await act(async () => clickAnimationButton("plot-animation-reset"));
    expect(host.querySelector<HTMLInputElement>("#plot-animation-from")?.value).toBe("1");
    expect(updateCount).toBe(0);

    current = { id: "plot-2", type: "plot", hidden: false, source: "y = x^2" };
    await act(async () => renderInspector());
    expect(host.querySelector<HTMLInputElement>("#plot-animation-enabled")?.checked).toBe(false);
    expect(host.querySelector<HTMLInputElement>("#plot-animation-from")).toBeNull();
    expect(updateCount).toBe(0);
  });

  it.each([undefined, true, false] as const)("renders showAxes %j as checked", async (showAxes) => {
    current = {
      id: "plot-1",
      type: "plot",
      hidden: false,
      source: "y = x^2",
      ...(showAxes === undefined ? {} : { showAxes }),
    };

    await act(async () => renderInspector());

    expect(host.querySelector<HTMLInputElement>("#plot-show-axes")?.checked).toBe(showAxes !== false);
  });

  it("toggles fitToAxes without changing source", async () => {
    await act(async () => renderInspector());

    const checkbox = host.querySelector<HTMLInputElement>("#plot-fit-to-axes");
    expect(checkbox?.checked).toBe(true);

    await act(async () => changeFitToAxes(false));
    expect(current).toEqual({ id: "plot-1", type: "plot", hidden: false, source: "y = x^2", fitToAxes: false });

    await act(async () => changeFitToAxes(true));
    expect(current).toEqual({ id: "plot-1", type: "plot", hidden: false, source: "y = x^2", fitToAxes: true });

    await act(async () => changeSource("y = sin(x)"));
    expect(current.fitToAxes).toBe(true);
  });

  it("toggles showAxes without changing fitToAxes or source", async () => {
    await act(async () => renderInspector());

    await act(async () => changeShowAxes(false));
    expect(current).toEqual({ id: "plot-1", type: "plot", hidden: false, source: "y = x^2", showAxes: false });

    await act(async () => changeShowAxes(true));
    expect(current).toEqual({ id: "plot-1", type: "plot", hidden: false, source: "y = x^2", showAxes: true });
  });

  it("writes Color and Background without disturbing unrelated Plot fields", async () => {
    current = {
      id: "plot-1",
      type: "plot",
      hidden: false,
      source: "y = x^2",
      fitToAxes: false,
      showAxes: false,
      layout: { width: 320, height: 180 },
    };
    await act(async () => renderInspector());

    await act(async () => changeColor("plot-color", "#ff0000"));
    expect(current).toMatchObject({
      source: "y = x^2",
      fitToAxes: false,
      showAxes: false,
      layout: { width: 320, height: 180 },
      style: { color: "#ff0000" },
    });
    expect(current.style?.background).toBeUndefined();

    await act(async () => changeColor("plot-background", "#112233"));
    expect(current.style).toEqual({ color: "#ff0000", background: { color: "#112233" } });
  });

  it("removes Background and cleans up the final Plot style property", async () => {
    current = {
      id: "plot-1",
      type: "plot",
      hidden: false,
      source: "y = x^2",
      style: { background: { color: "#112233" } },
    };
    await act(async () => renderInspector());

    await act(async () => removeColor("plot-background"));
    expect(current.style).toBeUndefined();

    current = {
      id: "plot-1",
      type: "plot",
      hidden: false,
      source: "y = x^2",
      style: { color: "#ff0000" },
    };
    await act(async () => renderInspector());
    await act(async () => removeColor("plot-color"));
    expect(current.style).toBeUndefined();
  });

  it("enables By Z with complete defaults and preserves unrelated Plot fields", async () => {
    current = {
      id: "plot-1",
      type: "plot",
      hidden: false,
      source: "z = x + y",
      fitToAxes: false,
      showAxes: false,
      layout: { width: 320, height: 180 },
      style: { color: "#ff0000", background: { color: "#112233" } },
    };
    await act(async () => renderInspector());
    await act(async () => changeZColorMode("z"));

    expect(current).toMatchObject({
      source: "z = x + y",
      fitToAxes: false,
      showAxes: false,
      layout: { width: 320, height: 180 },
      style: {
        color: "#ff0000",
        background: { color: "#112233" },
        zGradient: { minColor: "#7c3aed", maxColor: "#06b6d4" },
      },
    });
    expect(host.querySelector("#plot-z-min-color-value")).not.toBeNull();
    expect(host.querySelector("#plot-z-max-color-value")).not.toBeNull();
  });

  it("edits minimum and maximum Z colors independently", async () => {
    current = {
      id: "plot-1",
      type: "plot",
      hidden: false,
      source: "z = x + y",
      style: { zGradient: { minColor: "#7c3aed", maxColor: "#06b6d4" } },
    };
    await act(async () => renderInspector());

    await act(async () => changeColor("plot-z-min-color", "#111111"));
    expect(current.style?.zGradient).toEqual({ minColor: "#111111", maxColor: "#06b6d4" });
    await act(async () => changeColor("plot-z-max-color", "#eeeeee"));
    expect(current.style?.zGradient).toEqual({ minColor: "#111111", maxColor: "#eeeeee" });
  });

  it("disables By Z without removing Plot color or background", async () => {
    current = {
      id: "plot-1",
      type: "plot",
      hidden: false,
      source: "z = x + y",
      style: {
        color: "#ff0000",
        background: { color: "#112233" },
        zGradient: { minColor: "#7c3aed", maxColor: "#06b6d4" },
      },
    };
    await act(async () => renderInspector());
    await act(async () => changeZColorMode("solid"));

    expect(current.style).toEqual({ color: "#ff0000", background: { color: "#112233" } });
  });

  it("keeps zGradient while removing color and background, then cleans the final style", async () => {
    current = {
      id: "plot-1",
      type: "plot",
      hidden: false,
      source: "z = x + y",
      style: {
        color: "#ff0000",
        background: { color: "#112233" },
        zGradient: { minColor: "#7c3aed", maxColor: "#06b6d4" },
      },
    };
    await act(async () => renderInspector());
    await act(async () => removeColor("plot-color"));
    expect(current.style?.zGradient).toEqual({ minColor: "#7c3aed", maxColor: "#06b6d4" });
    await act(async () => removeColor("plot-background"));
    expect(current.style?.zGradient).toEqual({ minColor: "#7c3aed", maxColor: "#06b6d4" });
    await act(async () => changeZColorMode("solid"));
    expect(current.style).toBeUndefined();
  });

  it("hydrates and edits axis appearance without disturbing other Plot fields", async () => {
    current = {
      id: "plot-1",
      type: "plot",
      hidden: false,
      source: "z = x + y",
      fitToAxes: false,
      showAxes: false,
      layout: { width: 320, height: 180 },
      animation: { parameter: "t", from: 0, to: 1, durationMs: 1000 },
      style: {
        color: "#00aa00",
        background: { color: "#112233" },
        zGradient: { minColor: "#7c3aed", maxColor: "#06b6d4" },
        axes: { color: "#ff00aa", strokeWidth: 2 },
      },
    };

    await act(async () => renderInspector());
    expect(host.querySelector<HTMLInputElement>("#plot-axis-color-value")?.value).toBe("#ff00aa");
    expect(host.querySelector<HTMLInputElement>("#plot-axis-stroke-width")?.value).toBe("2");
    expect(updateCount).toBe(0);

    await act(async () => changeColor("plot-axis-color", "#abcdef"));
    expect(current.style).toEqual({
      color: "#00aa00",
      background: { color: "#112233" },
      zGradient: { minColor: "#7c3aed", maxColor: "#06b6d4" },
      axes: { color: "#abcdef", strokeWidth: 2 },
    });

    await act(async () => changeAxisThickness("3"));
    expect(current.style?.axes).toEqual({ color: "#abcdef", strokeWidth: 3 });
    expect(current.source).toBe("z = x + y");
    expect(current.showAxes).toBe(false);
    expect(current.animation).toEqual({ parameter: "t", from: 0, to: 1, durationMs: 1000 });
  });

  it("removes axis properties and cleans an empty axis style", async () => {
    current = {
      id: "plot-1",
      type: "plot",
      hidden: false,
      source: "y = x^2",
      style: { axes: { color: "#ff00aa", strokeWidth: 2 } },
    };
    await act(async () => renderInspector());

    await act(async () => removeColor("plot-axis-color"));
    expect(current.style?.axes).toEqual({ strokeWidth: 2 });
    await act(async () => changeAxisThickness(""));
    expect(current.style).toBeUndefined();
  });

  it("keeps authored axis appearance while axes are hidden", async () => {
    current = {
      id: "plot-1",
      type: "plot",
      hidden: false,
      source: "y = x^2",
      showAxes: false,
      style: { axes: { color: "#ff00aa", strokeWidth: 2 } },
    };
    await act(async () => renderInspector());
    await act(async () => changeShowAxes(true));
    await act(async () => changeShowAxes(false));

    expect(current.showAxes).toBe(false);
    expect(current.style?.axes).toEqual({ color: "#ff00aa", strokeWidth: 2 });
  });

  it("edits only canonical source, preserving multiline and empty values", async () => {
    await act(async () => renderInspector());

    const textarea = host.querySelector<HTMLTextAreaElement>("#plot-source");
    expect(textarea?.value).toBe("y = x^2");
    expect(textarea?.maxLength).toBe(4096);
    expect(textarea?.getAttribute("spellcheck")).toBe("false");

    await act(async () => changeSource("y = sin(x)"));
    expect(current.source).toBe("y = sin(x)");
    expect(current).toEqual({ id: "plot-1", type: "plot", hidden: false, source: "y = sin(x)" });

    const multiline = "y = sin(x)\ny = x^2";
    await act(async () => changeSource(multiline));
    expect(current.source).toBe(multiline);

    await act(async () => changeSource(""));
    expect(current.source).toBe("");
  });
});
