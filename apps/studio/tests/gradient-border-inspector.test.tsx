// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type {
  ContainerElement,
  Gradient,
  PowerShowElement,
} from "@powershow/document-schema";

import { ContainerInspector } from "../src/features/editor/inspector/container-inspector";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function containerElement(
  overrides: Partial<ContainerElement> = {},
): ContainerElement {
  return {
    type: "container",
    id: "gradient-border",
    hidden: false,
    direction: "column",
    children: [],
    ...overrides,
  };
}

function setValue(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): void {
  const prototype =
    element.tagName === "TEXTAREA"
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
}

function changeSelect(select: HTMLSelectElement, value: string): void {
  select.value = value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

const DEFAULT_BORDER_GRADIENT: Gradient = {
  type: "linear",
  angle: 135,
  stops: [
    { color: "#7c3aed", position: 0 },
    { color: "#06b6d4", position: 100 },
  ],
};

describe("Gradient Border authoring", () => {
  let host: HTMLDivElement;
  let root: Root;
  let state: PowerShowElement;
  let updates: PowerShowElement[];

  function renderInspector(): void {
    root.render(
      <StudioI18nProvider>
        <ContainerInspector
          element={state as ContainerElement}
          onUpdate={(update) => {
            state = update(state);
            updates.push(state);
            renderInspector();
          }}
        />
      </StudioI18nProvider>,
    );
  }

  function mount(element: PowerShowElement): void {
    state = element;
    updates = [];
    renderInspector();
  }

  function borderStyleSelect(): HTMLSelectElement {
    const select = host.querySelector<HTMLSelectElement>(
      "#container-border-style",
    );
    expect(select).not.toBeNull();
    return select!;
  }

  function borderPaintSelect(): HTMLSelectElement {
    const select = host.querySelector<HTMLSelectElement>(
      "#container-border-paint",
    );
    expect(select).not.toBeNull();
    return select!;
  }

  function gradientTypeSelect(): HTMLSelectElement {
    const select = host.querySelector<HTMLSelectElement>(
      "#container-border-gradient-type",
    );
    expect(select).not.toBeNull();
    return select!;
  }

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  it("1. Color Border UI still works: picking Solid creates a canonical Color Border", async () => {
    await act(async () => mount(containerElement()));

    await act(async () => changeSelect(borderStyleSelect(), "solid"));

    expect(updates).toHaveLength(1);
    expect(state.style?.border).toEqual({
      width: 1,
      style: "solid",
      color: "#94a3b8",
    });
    expect(state.style?.border?.gradient).toBeUndefined();
  });

  it("2. enabling Gradient Border creates canonical border.gradient", async () => {
    await act(async () =>
      mount(
        containerElement({
          style: { border: { width: 3, style: "solid", color: "#111111" } },
        }),
      ),
    );

    await act(async () => changeSelect(borderPaintSelect(), "gradient"));

    expect(state.style?.border?.gradient).toEqual(DEFAULT_BORDER_GRADIENT);
  });

  it("3. Gradient Border removes border.color", async () => {
    await act(async () =>
      mount(
        containerElement({
          style: { border: { width: 3, style: "solid", color: "#111111" } },
        }),
      ),
    );

    await act(async () => changeSelect(borderPaintSelect(), "gradient"));

    expect(state.style?.border?.color).toBeUndefined();
    expect(state.style?.border?.gradient).toBeDefined();
  });

  it("4. switching Gradient -> Color removes border.gradient", async () => {
    await act(async () =>
      mount(
        containerElement({
          style: { border: { width: 3, style: "solid", gradient: DEFAULT_BORDER_GRADIENT } },
        }),
      ),
    );

    await act(async () => changeSelect(borderPaintSelect(), "color"));

    expect(state.style?.border?.gradient).toBeUndefined();
    expect(state.style?.border?.color).toBe("#94a3b8");
  });

  it("5. switching Color -> Gradient preserves width", async () => {
    await act(async () =>
      mount(
        containerElement({
          style: { border: { width: 6, style: "dashed", color: "#123456" } },
        }),
      ),
    );

    await act(async () => changeSelect(borderPaintSelect(), "gradient"));

    expect(state.style?.border?.width).toBe(6);
  });

  it("6. Gradient authoring normalizes style to Solid and hides dashed/dotted", async () => {
    await act(async () =>
      mount(
        containerElement({
          style: { border: { width: 2, style: "dashed", color: "#111111" } },
        }),
      ),
    );

    await act(async () => changeSelect(borderPaintSelect(), "gradient"));

    expect(state.style?.border?.style).toBe("solid");
    expect(borderStyleSelect().value).toBe("solid");
    const offeredStyles = Array.from(borderStyleSelect().options).map(
      (option) => option.value,
    );
    expect(offeredStyles).not.toContain("dashed");
    expect(offeredStyles).not.toContain("dotted");
  });

  it("7. Gradient Border width editing preserves gradient", async () => {
    await act(async () =>
      mount(
        containerElement({
          style: { border: { width: 3, style: "solid", gradient: DEFAULT_BORDER_GRADIENT } },
        }),
      ),
    );

    await act(async () =>
      setValue(
        host.querySelector<HTMLInputElement>("#container-border-width")!,
        "9",
      ),
    );

    expect(state.style?.border?.width).toBe(9);
    expect(state.style?.border?.gradient).toEqual(DEFAULT_BORDER_GRADIENT);
    expect(state.style?.border?.color).toBeUndefined();
  });

  it("8. enabling Gradient creates a linear Gradient Border", async () => {
    await act(async () =>
      mount(
        containerElement({
          style: { border: { width: 1, style: "solid", color: "#111111" } },
        }),
      ),
    );

    await act(async () => changeSelect(borderPaintSelect(), "gradient"));

    expect(state.style?.border?.gradient).toMatchObject({ type: "linear" });
  });

  it("9. linear angle editing writes canonical angle", async () => {
    await act(async () =>
      mount(
        containerElement({
          style: { border: { width: 1, style: "solid", gradient: DEFAULT_BORDER_GRADIENT } },
        }),
      ),
    );

    await act(async () =>
      setValue(
        host.querySelector<HTMLInputElement>(
          "#container-border-gradient-angle",
        )!,
        "90",
      ),
    );

    expect(state.style?.border?.gradient).toMatchObject({
      type: "linear",
      angle: 90,
    });

    await act(async () =>
      setValue(
        host.querySelector<HTMLInputElement>(
          "#container-border-gradient-angle",
        )!,
        "-500",
      ),
    );

    expect(state.style?.border?.gradient).toMatchObject({ angle: -360 });
  });

  it("10. switching to radial creates a radial Gradient Border", async () => {
    await act(async () =>
      mount(
        containerElement({
          style: { border: { width: 1, style: "solid", gradient: DEFAULT_BORDER_GRADIENT } },
        }),
      ),
    );

    await act(async () => changeSelect(gradientTypeSelect(), "radial"));

    expect(state.style?.border?.gradient).toMatchObject({ type: "radial" });
  });

  it("11. radial defaults to circle shape", async () => {
    await act(async () =>
      mount(
        containerElement({
          style: { border: { width: 1, style: "solid", gradient: DEFAULT_BORDER_GRADIENT } },
        }),
      ),
    );

    await act(async () => changeSelect(gradientTypeSelect(), "radial"));

    const gradient = state.style?.border?.gradient;
    expect(gradient?.type).toBe("radial");
    expect(gradient?.type === "radial" ? gradient.shape : undefined).toBe(
      "circle",
    );
  });

  it("12. radial ellipse shape editing", async () => {
    await act(async () =>
      mount(
        containerElement({
          style: { border: { width: 1, style: "solid", gradient: { type: "radial", shape: "circle", stops: DEFAULT_BORDER_GRADIENT.stops } } },
        }),
      ),
    );

    const shapeSelect = host.querySelector<HTMLSelectElement>(
      "#container-border-gradient-shape",
    );
    expect(shapeSelect).not.toBeNull();

    await act(async () => changeSelect(shapeSelect!, "ellipse"));

    const gradient = state.style?.border?.gradient;
    expect(gradient?.type).toBe("radial");
    expect(gradient?.type === "radial" ? gradient.shape : undefined).toBe(
      "ellipse",
    );
  });

  it("13. Gradient Border starts with two default stops", async () => {
    await act(async () =>
      mount(
        containerElement({
          style: { border: { width: 1, style: "solid", gradient: DEFAULT_BORDER_GRADIENT } },
        }),
      ),
    );

    expect(state.style?.border?.gradient?.stops).toEqual([
      { color: "#7c3aed", position: 0 },
      { color: "#06b6d4", position: 100 },
    ]);
  });

  it("14. add stop inserts at the midpoint of the largest gap", async () => {
    await act(async () =>
      mount(
        containerElement({
          style: { border: { width: 1, style: "solid", gradient: DEFAULT_BORDER_GRADIENT } },
        }),
      ),
    );

    await act(async () =>
      host
        .querySelector<HTMLButtonElement>("#container-border-gradient-add-stop")
        ?.click(),
    );

    expect(state.style?.border?.gradient?.stops).toEqual([
      { color: "#7c3aed", position: 0 },
      { color: "#7c3aed", position: 50 },
      { color: "#06b6d4", position: 100 },
    ]);
  });

  it("15. remove stop removes the selected gradient stop", async () => {
    await act(async () =>
      mount(
        containerElement({
          style: { border: { width: 1, style: "solid", gradient: { type: "linear", angle: 135, stops: [{ color: "#7c3aed", position: 0 }, { color: "#ffffff", position: 50 }, { color: "#06b6d4", position: 100 }] } } },
        }),
      ),
    );

    await act(async () =>
      host
        .querySelector<HTMLButtonElement>(
          "#container-border-gradient-stop-1-remove",
        )
        ?.click(),
    );

    expect(state.style?.border?.gradient?.stops).toEqual([
      { color: "#7c3aed", position: 0 },
      { color: "#06b6d4", position: 100 },
    ]);
  });

  it("16. minimum 2 stops enforced", async () => {
    await act(async () =>
      mount(
        containerElement({
          style: { border: { width: 1, style: "solid", gradient: DEFAULT_BORDER_GRADIENT } },
        }),
      ),
    );

    const removeButton = host.querySelector<HTMLButtonElement>(
      "#container-border-gradient-stop-0-remove",
    );
    expect(removeButton?.disabled).toBe(true);

    const updatesBefore = updates.length;
    await act(async () => removeButton?.click());

    expect(updates).toHaveLength(updatesBefore);
    expect(state.style?.border?.gradient?.stops).toHaveLength(2);
  });

  it("17. maximum 8 stops enforced", async () => {
    await act(async () =>
      mount(
        containerElement({
          style: { border: { width: 1, style: "solid", gradient: DEFAULT_BORDER_GRADIENT } },
        }),
      ),
    );

    for (let index = 0; index < 6; index += 1) {
      await act(async () =>
        host
          .querySelector<HTMLButtonElement>(
            "#container-border-gradient-add-stop",
          )
          ?.click(),
      );
    }

    const gradient = state.style?.border?.gradient;
    expect(gradient?.stops).toHaveLength(8);

    const addButton = host.querySelector<HTMLButtonElement>(
      "#container-border-gradient-add-stop",
    );
    expect(addButton?.disabled).toBe(true);

    const updatesBefore = updates.length;
    await act(async () => addButton?.click());

    expect(updates).toHaveLength(updatesBefore);
    expect(state.style?.border?.gradient?.stops).toHaveLength(8);
  });

  it("18. stop color editing writes the new color", async () => {
    await act(async () =>
      mount(
        containerElement({
          style: { border: { width: 1, style: "solid", gradient: DEFAULT_BORDER_GRADIENT } },
        }),
      ),
    );

    await act(async () =>
      setValue(
        host.querySelector<HTMLInputElement>(
          "#container-border-gradient-stop-0-color",
        )!,
        "#ff0000",
      ),
    );

    const gradient = state.style?.border?.gradient;
    expect(gradient?.stops[0]).toEqual({ color: "#ff0000", position: 0 });
    expect(gradient?.stops[1]).toEqual({ color: "#06b6d4", position: 100 });
  });

  it("19. stop position editing writes the clamped position", async () => {
    await act(async () =>
      mount(
        containerElement({
          style: { border: { width: 1, style: "solid", gradient: DEFAULT_BORDER_GRADIENT } },
        }),
      ),
    );

    await act(async () =>
      setValue(
        host.querySelector<HTMLInputElement>(
          "#container-border-gradient-stop-1-position",
        )!,
        "75",
      ),
    );

    expect(state.style?.border?.gradient?.stops[1]).toEqual({
      color: "#06b6d4",
      position: 75,
    });
  });

  it("20. ordered stop behavior remains deterministic", async () => {
    await act(async () =>
      mount(
        containerElement({
          style: { border: { width: 1, style: "solid", gradient: DEFAULT_BORDER_GRADIENT } },
        }),
      ),
    );

    await act(async () =>
      host
        .querySelector<HTMLButtonElement>("#container-border-gradient-add-stop")
        ?.click(),
    );
    await act(async () =>
      setValue(
        host.querySelector<HTMLInputElement>(
          "#container-border-gradient-stop-1-position",
        )!,
        "25",
      ),
    );

    const positions = state.style?.border?.gradient?.stops.map(
      (stop) => stop.position,
    );
    expect(positions).toEqual([0, 25, 100]);

    // position edits are clamped to the ordered neighbors
    await act(async () =>
      setValue(
        host.querySelector<HTMLInputElement>(
          "#container-border-gradient-stop-0-position",
        )!,
        "30",
      ),
    );

    expect(state.style?.border?.gradient?.stops[0]?.position).toBe(25);
  });

  it("21. unrelated ElementStyle properties survive Border edits", async () => {
    await act(async () =>
      mount(
        containerElement({
          style: {
            background: "#0f172a",
            opacity: 0.5,
            borderRadius: 8,
            padding: 12,
            border: { width: 2, style: "solid", color: "#ff00ff" },
          },
        }),
      ),
    );

    await act(async () => changeSelect(borderPaintSelect(), "gradient"));
    await act(async () =>
      setValue(
        host.querySelector<HTMLInputElement>(
          "#container-border-gradient-stop-0-color",
        )!,
        "#00ff00",
      ),
    );
    await act(async () =>
      setValue(
        host.querySelector<HTMLInputElement>("#container-border-width")!,
        "5",
      ),
    );

    expect(state.style).toMatchObject({
      background: "#0f172a",
      opacity: 0.5,
      borderRadius: 8,
      padding: 12,
    });
    expect(state.style?.border?.width).toBe(5);

    await act(async () => changeSelect(borderPaintSelect(), "color"));

    expect(state.style).toMatchObject({
      background: "#0f172a",
      opacity: 0.5,
      borderRadius: 8,
      padding: 12,
    });
  });

  it("22. Border None removes the entire Border", async () => {
    await act(async () =>
      mount(
        containerElement({
          style: { border: { width: 1, style: "solid", gradient: DEFAULT_BORDER_GRADIENT } },
        }),
      ),
    );

    await act(async () => changeSelect(borderStyleSelect(), "none"));

    expect(state.style?.border).toBeUndefined();
  });

  it.each(["solid", "dashed", "dotted"])(
    "23. existing %s Color Border remains unchanged",
    async (styleOption) => {
      await act(async () =>
        mount(
          containerElement({
            style: {
              border: {
                width: 4,
                style: styleOption as "solid" | "dashed" | "dotted",
                color: "#abcdef",
              },
            },
          }),
        ),
      );

      expect(updates).toHaveLength(0);
      expect(borderStyleSelect().value).toBe(styleOption);
      expect(borderPaintSelect().value).toBe("color");
    },
  );

  it("26. existing canonical Gradient Border hydrates correctly", async () => {
    const gradient: Gradient = {
      type: "linear",
      angle: 90,
      stops: [
        { color: "#111111", position: 0 },
        { color: "#ffffff", position: 100 },
      ],
    };

    await act(async () =>
      mount(
        containerElement({
          style: { border: { width: 4, style: "solid", gradient } },
        }),
      ),
    );

    expect(updates).toHaveLength(0);
    expect(borderPaintSelect().value).toBe("gradient");
    expect(
      host.querySelector<HTMLInputElement>("#container-border-gradient-angle")
        ?.value,
    ).toBe("90");
    expect(
      host.querySelector<HTMLInputElement>(
        "#container-border-gradient-stop-0-color",
      )?.value,
    ).toBe("#111111");
  });

  it("27. Inspector hydration performs zero writes", async () => {
    await act(async () =>
      mount(
        containerElement({
          style: {
            background: "#0f172a",
            opacity: 0.8,
            borderRadius: 12,
            border: {
              width: 3,
              style: "solid",
              gradient: DEFAULT_BORDER_GRADIENT,
            },
          },
        }),
      ),
    );

    expect(updates).toHaveLength(0);
  });

  it("28. Background Gradient behavior remains unchanged", async () => {
    await act(async () => mount(containerElement()));

    const gradientSelect = host.querySelector<HTMLSelectElement>(
      "#container-gradient-type",
    );
    expect(gradientSelect).not.toBeNull();

    await act(async () => changeSelect(gradientSelect!, "linear"));

    expect(state.style?.backgroundGradient).toEqual(DEFAULT_BORDER_GRADIENT);
    expect(state.style?.backgroundPattern).toBeUndefined();
  });

  it("29. Background Gradient still clears backgroundPattern", async () => {
    await act(async () =>
      mount(
        containerElement({
          style: {
            backgroundGradient: {
              type: "linear",
              stops: [{ color: "#000", position: 0 }, { color: "#fff", position: 100 }],
            },
          },
        }),
      ),
    );

    await act(async () =>
      changeSelect(
        host.querySelector<HTMLSelectElement>("#container-background-pattern")!,
        "grid",
      ),
    );
    await act(async () =>
      changeSelect(
        host.querySelector<HTMLSelectElement>("#container-gradient-type")!,
        "linear",
      ),
    );

    expect(state.style?.backgroundPattern).toBeUndefined();
    expect(state.style?.backgroundGradient).toBeDefined();
  });

  it("30. Pattern authoring still clears backgroundGradient", async () => {
    await act(async () =>
      mount(
        containerElement({
          style: { backgroundPattern: { image: "linear-gradient(#000, #fff)" } },
        }),
      ),
    );

    await act(async () =>
      changeSelect(
        host.querySelector<HTMLSelectElement>("#container-background-pattern")!,
        "grid",
      ),
    );

    expect(state.style?.backgroundGradient).toBeUndefined();
    expect(state.style?.backgroundPattern).toBeDefined();
  });
});
