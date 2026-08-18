// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ElementStyle } from "@powershow/document-schema";
import type { FontResource } from "@powershow/document-schema";

import { ElementTypographyControl } from "../src/features/editor/inspector/sections/element-typography-control";
import { PresentationFontManager } from "../src/features/editor/inspector/sections/presentation-font-manager";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function setInputValue(container: HTMLElement, id: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(`#${id}`);
  if (!input) {
    throw new Error(`input ${id} not found`);
  }
  const valueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )?.set;
  if (!valueSetter) {
    throw new Error("input value setter not found");
  }
  valueSetter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function setSelectValue(container: HTMLElement, id: string, value: string) {
  const select = container.querySelector<HTMLSelectElement>(`#${id}`);
  if (!select) {
    throw new Error(`select ${id} not found`);
  }
  select.value = value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function clickButton(container: HTMLElement, label: string) {
  const button = [...container.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === label,
  );
  if (!button) {
    throw new Error(`button "${label}" not found`);
  }
  button.click();
}

function hasButton(container: HTMLElement, label: string): boolean {
  return [...container.querySelectorAll("button")].some(
    (candidate) => candidate.textContent?.trim() === label,
  );
}

function fontFixture(): FontResource[] {
  return [
    {
      id: "inter",
      family: "Inter",
      faces: [
        {
          weight: 400,
          style: "normal",
          subset: "latin",
          source: {
            type: "url",
            url: "https://cdn.example.com/fonts/inter-400.woff2",
            format: "woff2",
          },
        },
      ],
    },
  ];
}

describe("PresentationFontManager add-to-apply flow", () => {
  let container: HTMLDivElement;
  let root: Root;
  let onApplyFontFamily: ReturnType<typeof vi.fn>;
  let onAddFontFace: ReturnType<typeof vi.fn>;
  let onRemoveFontFace: ReturnType<typeof vi.fn>;

  interface RenderOptions {
    selectedElementId?: string;
    selectedFontFamily?: string;
    fontResources?: readonly FontResource[];
  }

  function renderManager(options: RenderOptions = {}) {
    root.render(
      <StudioI18nProvider>
        <PresentationFontManager
          id="presentation-font-manager"
          selectedElementId={options.selectedElementId ?? "element-1"}
          selectedFontFamily={options.selectedFontFamily}
          onApplyFontFamily={onApplyFontFamily}
          fontResources={options.fontResources ?? []}
          onAddFontFace={onAddFontFace}
          onRemoveFontFace={onRemoveFontFace}
          isFontFamilyInUse={() => false}
        />
      </StudioI18nProvider>,
    );
  }

  async function addManualViaFamily(family = "Inter") {
    await act(async () => {
      setSelectValue(container, "presentation-font-source", "manual");
    });

    await act(async () => {
      setInputValue(container, "presentation-font-family", family);
      setInputValue(
        container,
        "presentation-font-url",
        "https://cdn.example.com/fonts/inter.woff2",
      );
    });

    await act(async () => {
      clickButton(container, "Add face");
    });
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    onApplyFontFamily = vi.fn();
    onAddFontFace = vi.fn();
    onRemoveFontFace = vi.fn();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("shows the in-manager success state after a font source adds a family", async () => {
    await act(async () => {
      renderManager();
    });

    await addManualViaFamily("Example");

    expect(container.textContent).toContain("Example added to presentation.");
    expect(hasButton(container, "Apply to selected text")).toBe(true);
  });

  it("does not apply the font automatically on Add", async () => {
    await act(async () => {
      renderManager();
    });

    await addManualViaFamily();

    expect(onApplyFontFamily).not.toHaveBeenCalled();
  });

  it("Apply routes the family through the apply callback", async () => {
    await act(async () => {
      renderManager();
    });

    await addManualViaFamily();

    await act(async () => {
      clickButton(container, "Apply to selected text");
    });

    expect(onApplyFontFamily).toHaveBeenCalledWith("Inter");
  });

  it("shows the completed state when the selected element already uses the family", async () => {
    await act(async () => {
      renderManager({ selectedFontFamily: "Inter" });
    });

    await addManualViaFamily();

    expect(container.textContent).toContain("Applied to selected text");
    expect(hasButton(container, "Apply to selected text")).toBe(false);
  });

  it("clears the transient added state when the selected element changes", async () => {
    await act(async () => {
      renderManager({ selectedElementId: "element-1" });
    });

    await addManualViaFamily("Example");

    expect(container.textContent).toContain("Example added to presentation.");

    await act(async () => {
      renderManager({ selectedElementId: "element-2" });
    });

    expect(container.textContent).not.toContain("added to presentation");
  });

  it("never reports 'applied' for a different element", async () => {
    await act(async () => {
      renderManager({ selectedElementId: "element-1" });
    });

    await addManualViaFamily("Example");

    await act(async () => {
      clickButton(container, "Apply to selected text");
    });

    // The transient state was consumed by element-1; element-2 must not
    // inherit the applied claim or the stale success panel.
    await act(async () => {
      renderManager({
        selectedElementId: "element-2",
        fontResources: fontFixture(),
      });
    });

    expect(container.textContent).not.toContain("Example added to presentation");
    expect(container.textContent).not.toContain("Applied to selected text");
  });

  it("keeps the manager mounted after Add and Apply", async () => {
    await act(async () => {
      renderManager();
    });

    await addManualViaFamily("Example");

    await act(async () => {
      clickButton(container, "Apply to selected text");
    });

    expect(container.textContent).toContain("Example");
  });
});

describe("registered fonts disclosure", () => {
  let container: HTMLDivElement;
  let root: Root;

  function renderManager(
    fontResources: readonly FontResource[],
    isInUse: (family: string) => boolean = () => false,
  ) {
    root.render(
      <StudioI18nProvider>
        <PresentationFontManager
          id="presentation-font-manager"
          selectedElementId="element-1"
          selectedFontFamily={undefined}
          onApplyFontFamily={() => {}}
          fontResources={fontResources}
          onAddFontFace={() => {}}
          onRemoveFontFace={vi.fn()}
          isFontFamilyInUse={isInUse}
        />
      </StudioI18nProvider>,
    );
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("starts collapsed and shows the family count", async () => {
    await act(async () => {
      renderManager(fontFixture());
    });

    const toggle = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Fonts in presentation"),
    );
    expect(toggle).toBeDefined();
    expect(toggle?.getAttribute("aria-expanded")).toBe("false");
    expect(container.textContent).toContain("Fonts in presentation (1)");
    expect(hasButton(container, "Remove face")).toBe(false);
  });

  it("expanding reveals the registered faces and keeps removal available", async () => {
    await act(async () => {
      renderManager(fontFixture());
    });

    const toggle = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Fonts in presentation"),
    );
    if (!toggle) {
      throw new Error("registered fonts toggle not found");
    }

    await act(async () => {
      toggle.click();
    });

    expect(toggle?.getAttribute("aria-expanded")).toBe("true");
    expect(container.textContent).toContain("Inter");
    expect(hasButton(container, "Remove face")).toBe(true);
  });

  it("counts families, not faces", async () => {
    const resources: FontResource[] = [
      {
        id: "inter",
        family: "Inter",
        faces: [
          {
            weight: 400,
            style: "normal",
            subset: "latin",
            source: {
              type: "url",
              url: "https://cdn.example.com/fonts/inter-400.woff2",
              format: "woff2",
            },
          },
          {
            weight: 700,
            style: "normal",
            subset: "latin",
            source: {
              type: "url",
              url: "https://cdn.example.com/fonts/inter-700.woff2",
              format: "woff2",
            },
          },
        ],
      },
      {
        id: "roboto",
        family: "Roboto",
        faces: [
          {
            weight: 400,
            style: "normal",
            subset: "latin",
            source: {
              type: "url",
              url: "https://cdn.example.com/fonts/roboto-400.woff2",
              format: "woff2",
            },
          },
        ],
      },
    ];

    await act(async () => {
      renderManager(resources);
    });

    // Two families with three faces total: the counter must show 2.
    expect(container.textContent).toContain("Fonts in presentation (2)");
  });
});

describe("ElementTypographyControl apply integration", () => {
  let container: HTMLDivElement;
  let root: Root;

  const EFFECTIVE_DEFAULTS = {
    fontSize: 18,
    lineHeight: 1.6,
    letterSpacing: 0,
  };

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("Apply updates the selected text style.fontFamily through the existing update path", async () => {
    let styleState: ElementStyle | undefined;
    const updates: ElementStyle[] = [];

    function renderControl() {
      root.render(
        <StudioI18nProvider>
          <ElementTypographyControl
            selectedElementId="text-1"
            style={styleState}
            effectiveDefaults={EFFECTIVE_DEFAULTS}
            onUpdateStyle={(update) => {
              styleState = update(styleState);
              updates.push(styleState);
              renderControl();
            }}
            controlPrefix="text"
            fontResourceControls={{
              fontResources: [],
              onAddFontFace: vi.fn(),
              onRemoveFontFace: vi.fn(),
              isFontFamilyInUse: () => false,
            }}
          />
        </StudioI18nProvider>,
      );
    }

    await act(async () => {
      renderControl();
    });

    await act(async () => {
      clickButton(container, "Manage fonts");
    });

    // Add a family through the Manual source inside the manager.
    await act(async () => {
      setSelectValue(container, "presentation-font-source", "manual");
    });
    await act(async () => {
      setInputValue(container, "presentation-font-family", "Inter");
      setInputValue(
        container,
        "presentation-font-url",
        "https://cdn.example.com/fonts/inter.woff2",
      );
    });
    await act(async () => {
      clickButton(container, "Add face");
    });

    expect(updates).toHaveLength(0);

    await act(async () => {
      clickButton(container, "Apply to selected text");
    });

    expect(updates.at(-1)).toEqual({ fontFamily: "Inter" });
    expect(container.textContent).toContain("Applied to selected text");
  });
});