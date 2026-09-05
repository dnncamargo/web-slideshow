// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ElementTypography, FontResource } from "@powershow/document-schema";

import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";
import { TextInspector } from "../src/features/editor/inspector/text-inspector";
import { ElementTypographyControl } from "../src/features/editor/inspector/sections/element-typography-control";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const FONT_RESOURCES: readonly FontResource[] = [
  {
    id: "font-inter",
    family: "Inter",
    source: {
      type: "url",
      url: "https://example.com/inter.woff2",
      format: "woff2",
    },
  },
  {
    id: "font-audiowide",
    family: "Audiowide",
    source: {
      type: "url",
      url: "https://example.com/audiowide.woff2",
      format: "woff2",
    },
  },
];

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
          typography={styleState}
          effectiveDefaults={EFFECTIVE_DEFAULTS}
          onUpdateTypography={(update) => {
            styleState = update(styleState);
            updates.push(styleState);
            renderControl();
          }}
          controlPrefix="text"
          fontResources={FONT_RESOURCES}
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

  it("shows local fonts, clears Default, preserves legacy families, and has no font manager", async () => {
    await act(async () => {
      mount({ fontFamily: "Legacy Custom" });
    });

    const fontFamily = container.querySelector<HTMLSelectElement>("#text-font-family");
    expect(fontFamily?.value).toBe("Legacy Custom");
    expect(fontFamily?.querySelector("option[value='Inter']")).not.toBeNull();
    expect(fontFamily?.querySelector("option[value='Audiowide']")).not.toBeNull();
    expect(container.textContent).not.toContain("Manage fonts");
    expect(container.querySelector("[data-presentation-font-manager]")).toBeNull();

    await act(async () => {
      changeSelect(container, "text-font-family", "Inter");
    });
    expect(updates.at(-1)).toEqual({ fontFamily: "Inter" });

    await act(async () => {
      changeSelect(container, "text-font-family", "");
    });
    expect(updates.at(-1)).toEqual({ fontFamily: undefined });
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
          fontResources={FONT_RESOURCES}
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

describe("shared typography controls with unknown defaults", () => {
  let container: HTMLDivElement;
  let root: Root;
  let state: ElementTypography | undefined;
  let updates: ElementTypography[];

  function renderControl() {
    root.render(
      <StudioI18nProvider>
        <ElementTypographyControl
          typography={state}
          effectiveDefaults={{}}
          visibleProperties={["fontSize", "lineHeight"]}
          controlPrefix="unknown"
          fontResources={[]}
          onUpdateTypography={(update) => {
            state = update(state);
            updates.push(state);
            renderControl();
          }}
        />
      </StudioI18nProvider>,
    );
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    state = undefined;
    updates = [];
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  function numeric(id: string): HTMLInputElement {
    const input = container.querySelector<HTMLInputElement>(`#${id}`);
    if (!input) throw new Error(`input ${id} not found`);
    return input;
  }

  function change(id: string, value: string) {
    const input = numeric(id);
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (!setter) throw new Error("input value setter not found");
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  it("keeps unknown inherited values blank, authors values, and resets independently", async () => {
    await act(async () => {
      renderControl();
    });

    expect(numeric("unknown-font-size").value).toBe("");
    expect(numeric("unknown-line-height").value).toBe("");
    expect(container.textContent).toContain("Default");
    expect(updates).toHaveLength(0);

    await act(async () => change("unknown-font-size", "24"));
    await act(async () => change("unknown-line-height", "1.4"));
    expect(state).toEqual({ fontSize: "24rem", lineHeight: 1.4 });

    const resetFor = (id: string) => numeric(id).closest("div")?.parentElement?.querySelector<HTMLButtonElement>("button");
    await act(async () => resetFor("unknown-font-size")?.click());
    expect(state).toEqual({ fontSize: undefined, lineHeight: 1.4 });

    await act(async () => resetFor("unknown-line-height")?.click());
    expect(state).toEqual({ fontSize: undefined, lineHeight: undefined });
  });
});
