// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ElementTypography } from "@powershow/document-schema";

import type { FontResourceControls } from "../src/features/editor/inspector/inspector-types";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";
import { TextInspector } from "../src/features/editor/inspector/text-inspector";
import { ElementTypographyControl } from "../src/features/editor/inspector/sections/element-typography-control";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const FONT_RESOURCES: FontResourceControls = {
  fontResources: [],
  onAddFontFace: vi.fn(),
  onRemoveFontFace: vi.fn(),
  isFontFamilyInUse: () => false,
};

const EFFECTIVE_DEFAULTS = {
  fontSize: 18,
  lineHeight: 1.6,
  letterSpacing: 0,
};

function selectValue(container: HTMLElement, id: string): string {
  const select = container.querySelector<HTMLSelectElement>(`#${id}`);
  if (!select) {
    throw new Error(`select ${id} not found`);
  }
  return select.value;
}

function changeSelect(container: HTMLElement, id: string, value: string) {
  const select = container.querySelector<HTMLSelectElement>(`#${id}`);
  if (!select) {
    throw new Error(`select ${id} not found`);
  }
  select.value = value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("ElementTypographyControl text capabilities", () => {
  let container: HTMLDivElement;
  let root: Root;
  let updates: ElementTypography[];
  let styleState: ElementTypography | undefined;

  function renderControl() {
    root.render(
      <StudioI18nProvider>
        <ElementTypographyControl
          selectedElementId="text-1"
          typography={styleState}
          effectiveDefaults={EFFECTIVE_DEFAULTS}
          onUpdateTypography={(update) => {
            styleState = update(styleState);
            updates.push(styleState);
            renderControl();
          }}
          controlPrefix="text"
          fontResourceControls={FONT_RESOURCES}
        />
      </StudioI18nProvider>,
    );
  }

  function mount(style: ElementTypography | undefined) {
    styleState = style;
    renderControl();
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    updates = [];
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("shows the effective natural default for each control when the canonical property is undefined", async () => {
    await act(async () => {
      mount(undefined);
    });

    expect(selectValue(container, "text-text-transform")).toBe("none");
    expect(selectValue(container, "text-white-space")).toBe("normal");
    expect(selectValue(container, "text-text-wrap-style")).toBe("auto");
    expect(selectValue(container, "text-overflow-wrap")).toBe("normal");
    expect(selectValue(container, "text-text-decoration-line")).toBe("none");
  });

  it("mounting does not write any text-capability override", async () => {
    await act(async () => {
      mount(undefined);
    });

    expect(updates).toHaveLength(0);
  });

  it("changing each control writes the canonical typography property", async () => {
    await act(async () => {
      mount(undefined);
    });

    await act(async () => {
      changeSelect(container, "text-text-transform", "uppercase");
      changeSelect(container, "text-white-space", "pre-line");
      changeSelect(container, "text-text-wrap-style", "balance");
      changeSelect(container, "text-overflow-wrap", "break-word");
      changeSelect(container, "text-text-decoration-line", "line-through");
    });

    expect(updates.at(-1)).toEqual({
      textTransform: "uppercase",
      whiteSpace: "pre-line",
      textWrapStyle: "balance",
      overflowWrap: "break-word",
      textDecorationLine: "line-through",
    });
  });

  it.each([
    ["text-transform", "lowercase", { textTransform: "lowercase" }],
    ["white-space", "pre-wrap", { whiteSpace: "pre-wrap" }],
    ["text-wrap-style", "pretty", { textWrapStyle: "pretty" }],
    ["text-wrap-style", "auto", { textWrapStyle: "auto" }],
    ["overflow-wrap", "anywhere", { overflowWrap: "anywhere" }],
    ["text-decoration-line", "underline", { textDecorationLine: "underline" }],
  ] as const)("updates %s to %s", async (_id, value, expected) => {
    await act(async () => {
      mount(undefined);
    });

    await act(async () => {
      changeSelect(container, `text-${_id}`, value);
    });

    expect(updates.at(-1)).toEqual(expected);
  });

  it("text-transform changes never rewrite element content", async () => {
    await act(async () => {
      mount(undefined);
    });

    await act(async () => {
      changeSelect(container, "text-text-transform", "uppercase");
    });

    // The control only updates style; it never touches TextElement.content.
    expect(updates.at(-1)).toEqual({ textTransform: "uppercase" });
    expect(updates.at(-1)).not.toHaveProperty("content");
  });

  it("preserves existing typography controls when a text capability is set", async () => {
    await act(async () => {
      mount({ fontFamily: "Inter", fontWeight: 600, fontSize: 24 });
    });

    await act(async () => {
      changeSelect(container, "text-text-transform", "capitalize");
    });

    const last = updates.at(-1);
    expect(last).toMatchObject({
      fontFamily: "Inter",
      fontWeight: 600,
      fontSize: 24,
      textTransform: "capitalize",
    });
  });
});

describe("shared text capability controls", () => {
  let container: HTMLDivElement;
  let root: Root;

  function mountInspector() {
    root.render(
      <StudioI18nProvider>
        <TextInspector
          element={{
            type: "text",
            id: "text-1",
            hidden: false,
            variant: "body",
            content: "PowerShow Example",
          }}
          onUpdate={() => {}}
          fontResourceControls={FONT_RESOURCES}
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

  it("Text renders the shared text-capability controls", async () => {
    await act(async () => {
      mountInspector();
    });

    expect(
      container.querySelector<HTMLSelectElement>("#text-text-transform"),
    ).not.toBeNull();
    expect(
      container.querySelector<HTMLSelectElement>("#text-text-decoration-line"),
    ).not.toBeNull();
  });
});
