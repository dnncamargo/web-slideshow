// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ResolvedWebFontFamily } from "../src/features/fonts/web-font-types";
import type { WebFontSummary } from "../src/features/fonts/web-font-types";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";
import { WebFontSearchControl } from "../src/features/fonts/components/web-font-search-control";
import type { FontFamilyFaces } from "../src/features/fonts/font-acquisition-types";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const SEARCH_DEBOUNCE_MS = 300;

function face(
  weight: number,
  style: "normal" | "italic",
  subset: string,
): ResolvedWebFontFamily["faces"][number] {
  return {
    weight,
    style,
    subset,
    source: {
      type: "url",
      url: `https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/${subset}-${weight}-${style}.woff2`,
      format: "woff2",
    },
  };
}

// It is important that the italic face appears first: the recommended face
// must still choose normal whenever a normal face exists.
const INTER_FAMILY: ResolvedWebFontFamily = {
  provider: "fontsource",
  id: "inter",
  family: "Inter",
  category: "sans-serif",
  weights: [400, 700],
  styles: ["normal", "italic"],
  subsets: ["latin", "latin-ext"],
  defaultSubset: "latin",
  faces: [
    face(400, "italic", "latin"),
    face(400, "normal", "latin"),
    face(400, "normal", "latin-ext"),
    face(700, "normal", "latin"),
  ],
};

const SEARCH_RESULTS: WebFontSummary[] = [
  {
    provider: "fontsource",
    id: "inter",
    family: "Inter",
    category: "sans-serif",
    weights: [400, 700],
    styles: ["normal", "italic"],
    subsets: ["latin", "latin-ext"],
  },
];

function searchResponseStub(): ReturnType<typeof vi.fn> {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);

    if (url.includes("/api/fonts/search")) {
      return Response.json({ ok: true, results: SEARCH_RESULTS });
    }

    if (url.includes("/api/fonts/family")) {
      return Response.json({ ok: true, family: INTER_FAMILY });
    }

    return Response.json({ ok: true, results: [] });
  });
}

function typeQuery(container: HTMLElement, value: string) {
  const input = container.querySelector<HTMLInputElement>(
    "#presentation-font-search",
  );
  if (!input) {
    throw new Error("font search input not found");
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

function clickButton(container: HTMLElement, label: string) {
  const button = [...container.querySelectorAll("button")].find(
    (candidate) => candidate.textContent?.trim() === label,
  );
  if (!button) {
    throw new Error(`button "${label}" not found`);
  }
  button.click();
}

function assertHasButton(container: HTMLElement, label: string) {
  expect(
    [...container.querySelectorAll("button")].some(
      (button) => button.textContent?.trim() === label,
    ),
  ).toBe(true);
}

describe("WebFontSearchControl provider behavior", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    vi.useFakeTimers();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    document.body.innerHTML = "";
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("serves the Google Fonts provider and keeps search actions write-free", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/fonts/status")) {
        return Response.json({ ok: true, available: true });
      }

      if (url.includes("/api/fonts/search")) {
        return Response.json({ ok: true, results: SEARCH_RESULTS });
      }

      if (url.includes("/api/fonts/family")) {
        return Response.json({ ok: true, family: INTER_FAMILY });
      }

      return Response.json({ ok: true, results: [] });
    });
    vi.stubGlobal("fetch", fetchMock);
    const onAddFontFace = vi.fn(() => true);

    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <WebFontSearchControl
            provider="google-fonts"
            fontFamilies={[]}
            onAddFontFace={onAddFontFace}
            onFontAdded={vi.fn()}
            controlPrefix="presentation-font"
          />
        </StudioI18nProvider>,
      );
    });

    await act(async () => {
      typeQuery(container, "Inter");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS + 100);
    });
    await act(async () => {});

    assertHasButton(container, "Customize");
    await act(async () => clickButton(container, "Customize"));
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(onAddFontFace).not.toHaveBeenCalled();

    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).includes(
          "/api/fonts/family?provider=google-fonts&id=inter",
        ),
      ),
    ).toBe(true);
  });

  it("keeps the source selector provider-specific", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/api/fonts/search")) {
        return Response.json({ ok: true, results: SEARCH_RESULTS });
      }

      if (url.includes("/api/fonts/family")) {
        return Response.json({ ok: true, family: INTER_FAMILY });
      }

      return Response.json({ ok: true, results: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <WebFontSearchControl
            provider="fontsource"
            fontFamilies={[]}
            onAddFontFace={vi.fn(() => true)}
            onFontAdded={vi.fn()}
            controlPrefix="presentation-font"
          />
        </StudioI18nProvider>,
      );
    });

    const searchInput = container.querySelector<HTMLInputElement>(
      "#presentation-font-search",
    );
    expect(searchInput).not.toBeNull();

    // Fontsource does not require a Google availability probe.
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).includes("/api/fonts/status"),
      ),
    ).toBe(false);
  });
});
describe("WebFontSearchControl multi-weight customizer", () => {
  let container: HTMLDivElement;
  let root: Root;
  let onAddFontFace: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    onAddFontFace = vi.fn(() => true);
    vi.useFakeTimers();
    vi.stubGlobal("fetch", searchResponseStub());
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  async function openCustomizer(fontFamilies: FontFamilyFaces[] = []) {
    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <WebFontSearchControl
            provider="fontsource"
            fontFamilies={fontFamilies}
            onAddFontFace={onAddFontFace}
            onFontAdded={vi.fn()}
            controlPrefix="presentation-font"
          />
        </StudioI18nProvider>,
      );
    });
    await act(async () => typeQuery(container, "Inter"));
    await act(async () => vi.advanceTimersByTimeAsync(400));
    await act(async () => clickButton(container, "Customize"));
    await act(async () => vi.advanceTimersByTimeAsync(0));
  }

  it("renders scoped chips, keeps the recommendation unselected, and orders the customizer before results", async () => {
    await openCustomizer();
    const chips = [...container.querySelectorAll<HTMLButtonElement>("[data-weight]")];
    expect(chips.map((chip) => chip.dataset.weight)).toEqual(["400", "700"]);
    expect(chips.every((chip) => chip.getAttribute("aria-pressed") === "false")).toBe(true);
    const customizer = container.querySelector("[data-web-font-customizer]");
    const results = container.querySelector("[data-web-font-results]");
    expect(customizer?.compareDocumentPosition(results as Node) ?? 0).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(onAddFontFace).not.toHaveBeenCalled();
  });

  it("selects, previews, deselects, and persists multiple weights in ascending order", async () => {
    await openCustomizer();
    const chip400 = container.querySelector<HTMLButtonElement>("[data-weight='400']");
    const chip700 = container.querySelector<HTMLButtonElement>("[data-weight='700']");
    if (!chip400 || !chip700) throw new Error("expected weight chips");
    await act(async () => chip700.click());
    await act(async () => chip400.click());
    expect(chip700.getAttribute("aria-pressed")).toBe("true");
    expect(chip400.getAttribute("aria-pressed")).toBe("true");
    await act(async () => chip400.click());
    expect(chip400.getAttribute("aria-pressed")).toBe("false");
    await act(async () => chip400.click());
    await act(async () => clickButton(container, "Add selected variants"));
    expect(onAddFontFace.mock.calls.map((call) => call[1].weight)).toEqual([400, 700]);
    expect(container.querySelector("[data-web-font-customizer]")).not.toBeNull();
    expect(container.textContent).not.toContain("Add font");
    expect(container.textContent).not.toContain("Add variant");
    expect(container.textContent).not.toContain("Add another variant");
  });

  it("scopes chips and resets pending selection when Style or Subset changes", async () => {
    await openCustomizer();
    const chip700 = container.querySelector<HTMLButtonElement>("[data-weight='700']");
    if (!chip700) throw new Error("expected weight chip");
    await act(async () => chip700.click());
    const style = container.querySelector<HTMLSelectElement>("#presentation-font-search-style");
    if (!style) throw new Error("expected style selector");
    style.value = "italic";
    await act(async () => style.dispatchEvent(new Event("change", { bubbles: true })));
    expect(container.querySelector("[data-weight='700']")).toBeNull();
    expect(container.querySelector("[data-weight='400']")?.getAttribute("aria-pressed")).toBe("false");
    expect(onAddFontFace).not.toHaveBeenCalled();
  });

  it("marks equivalent existing faces and skips them defensively", async () => {
    const existing = INTER_FAMILY.faces.find((candidate) => candidate.weight === 400 && candidate.style === "normal" && candidate.subset === "latin");
    if (!existing) throw new Error("expected existing face");
    await openCustomizer([{ family: "Inter", faces: [existing] }]);
    const chip = container.querySelector<HTMLButtonElement>("[data-weight='400']");
    expect(chip?.getAttribute("aria-disabled")).toBe("true");
    await act(async () => chip?.click());
    expect(chip?.getAttribute("aria-pressed")).toBe("false");
    expect(onAddFontFace).not.toHaveBeenCalled();
  });
});
