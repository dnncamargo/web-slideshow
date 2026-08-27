// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getFontResourceFaces, type FontResource } from "@powershow/document-schema";
import type { ResolvedWebFontFamily } from "../src/features/fonts/web-font-types";
import type { WebFontSummary } from "../src/features/fonts/web-font-types";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";
import { WebFontSearchControl } from "../src/features/fonts/components/web-font-search-control";

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

function inventory(resources: readonly FontResource[]) {
  return resources.map((resource) => ({
    family: resource.family,
    faces: getFontResourceFaces(resource),
  }));
}

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

function hasButton(container: HTMLElement, label: string): boolean {
  return [...container.querySelectorAll("button")].some(
    (button) => button.textContent?.trim() === label,
  );
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

  it("serves the Google Fonts provider with the same add-font flow when available", async () => {
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

    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <WebFontSearchControl
            provider="google-fonts"
            fontFamilies={[]}
            onAddFontFace={vi.fn(() => true)}
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

    assertHasButton(container, "Add font");

    await act(async () => {
      clickButton(container, "Add font");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

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

describe("WebFontSearchControl add-to-apply flow", () => {
  let container: HTMLDivElement;
  let root: Root;
  let onAddFontFace: ReturnType<typeof vi.fn>;
  let onFontAdded: ReturnType<typeof vi.fn>;

  function renderControl() {
    root.render(
      <StudioI18nProvider>
        <WebFontSearchControl
          provider="fontsource"
          fontFamilies={[]}
          onAddFontFace={onAddFontFace}
          onFontAdded={onFontAdded}
          controlPrefix="presentation-font"
        />
      </StudioI18nProvider>,
    );
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    onAddFontFace = vi.fn(() => true);
    onFontAdded = vi.fn();
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

  async function search(query: string, fetchMock?: ReturnType<typeof vi.fn>) {
    if (fetchMock) {
      vi.stubGlobal("fetch", fetchMock);
    } else {
      vi.stubGlobal("fetch", searchResponseStub());
    }

    await act(async () => {
      renderControl();
    });

    await act(async () => {
      typeQuery(container, query);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS + 100);
    });

    await act(async () => {});
  }

  it("exposes 'Add font' directly on search results", async () => {
    await search("Inter");

    assertHasButton(container, "Add font");
    expect(
      container.querySelector("#presentation-font-search-weight"),
    ).toBeNull();
  });

  it("does not show Weight / Style / Subset controls before Customize is chosen", async () => {
    await search("Inter");

    expect(
      container.querySelector("#presentation-font-search-weight"),
    ).toBeNull();
    expect(
      container.querySelector("#presentation-font-search-style"),
    ).toBeNull();
    expect(
      container.querySelector("#presentation-font-search-subset"),
    ).toBeNull();
  });

  it("Add font resolves the family and adds the recommended face in one action", async () => {
    const fetchMock = searchResponseStub();
    await search("Inter", fetchMock);

    await act(async () => {
      clickButton(container, "Add font");
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).includes("/api/fonts/family"),
      ),
    ).toBe(true);
    expect(onAddFontFace).toHaveBeenCalledTimes(1);
    expect(onFontAdded).toHaveBeenCalledWith("Inter");
    expect(onAddFontFace.mock.calls[0]?.[0]).toBe("Inter");
    expect(onAddFontFace.mock.calls[0]?.[1]).toMatchObject({
      weight: 400,
      style: "normal",
      subset: "latin",
    });
  });

  it("waits for an async add result before reporting the recommended face", async () => {
    let resolveAdd: ((added: boolean) => void) | undefined;
    onAddFontFace = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveAdd = resolve;
        }),
    );
    await search("Inter");

    await act(async () => {
      clickButton(container, "Add font");
      await Promise.resolve();
    });

    expect(onFontAdded).not.toHaveBeenCalled();
    resolveAdd?.(true);
    await act(async () => {
      await Promise.resolve();
    });
    expect(onFontAdded).toHaveBeenCalledWith("Inter");
  });

  it("does not report or remember a recommended face when the add is rejected", async () => {
    onAddFontFace = vi.fn(async () => false);
    await search("Inter");

    await act(async () => {
      clickButton(container, "Add font");
      await Promise.resolve();
    });

    expect(onFontAdded).not.toHaveBeenCalled();
    expect(hasButton(container, "Add another variant")).toBe(false);
  });

  it("keeps normal as the initial style even though italic appears first", async () => {
    await search("Inter");

    await act(async () => {
      clickButton(container, "Customize");
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    const styleSelect = container.querySelector<HTMLSelectElement>(
      "#presentation-font-search-style",
    );
    expect(styleSelect?.value).toBe("normal");
  });

  it("Customize exposes the Weight / Style / Subset editor initialized to the recommended face", async () => {
    await search("Inter");

    await act(async () => {
      clickButton(container, "Customize");
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(
      container.querySelector<HTMLSelectElement>("#presentation-font-search-weight")
        ?.value,
    ).toBe("400");
    expect(
      container.querySelector<HTMLSelectElement>("#presentation-font-search-style")
        ?.value,
    ).toBe("normal");
    expect(
      container.querySelector<HTMLSelectElement>("#presentation-font-search-subset")
        ?.value,
    ).toBe("latin");
  });

  it("Back collapses the Customize editor without adding anything", async () => {
    await search("Inter");

    await act(async () => {
      clickButton(container, "Customize");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    await act(async () => {
      clickButton(container, "Back");
    });

    expect(
      container.querySelector("#presentation-font-search-weight"),
    ).toBeNull();
    expect(onAddFontFace).not.toHaveBeenCalled();
  });

  it("Add variant adds the selected customized face", async () => {
    await search("Inter");

    await act(async () => {
      clickButton(container, "Customize");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    const weightSelect = container.querySelector<HTMLSelectElement>(
      "#presentation-font-search-weight",
    );
    if (!weightSelect) {
      throw new Error("weight select not found");
    }

    await act(async () => {
      weightSelect.value = "700";
      weightSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await act(async () => {
      clickButton(container, "Add variant");
    });

    expect(onAddFontFace).toHaveBeenCalledTimes(1);
    expect(onAddFontFace.mock.calls[0]?.[1]).toMatchObject({
      weight: 700,
      style: "normal",
      subset: "latin",
    });
    expect(onFontAdded).toHaveBeenCalledWith("Inter");
  });

  it("keeps duplicate protection when the face already exists", async () => {
    onAddFontFace = vi.fn(() => true);
    const duplicateFace = INTER_FAMILY.faces.find(
      (candidate) =>
        candidate.weight === 400 &&
        candidate.style === "normal" &&
        candidate.subset === "latin",
    );
    if (!duplicateFace) {
      throw new Error("expected fixture face not found");
    }
    const existingResources: FontResource[] = [
      { id: "inter", family: "Inter", faces: [duplicateFace] },
    ];

    vi.stubGlobal("fetch", searchResponseStub());

    await act(async () => {
      root.render(
        <StudioI18nProvider>
          <WebFontSearchControl
            provider="fontsource"
            fontFamilies={inventory(existingResources)}
            onAddFontFace={onAddFontFace}
            onFontAdded={onFontAdded}
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

    await act(async () => {
      clickButton(container, "Add font");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(onAddFontFace).not.toHaveBeenCalled();
    expect(container.textContent).toContain("This font face already exists.");
  });

  it("a stale family request never adds the wrong family", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes("/api/fonts/family")) {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      }

      if (url.includes("/api/fonts/search")) {
        return Promise.resolve(
          Response.json({ ok: true, results: SEARCH_RESULTS }),
        );
      }

      return Promise.resolve(Response.json({ ok: true, results: [] }));
    });

    await search("Inter", fetchMock);

    await act(async () => {
      clickButton(container, "Add font");
    });

    // Changing the query while the family is still loading cancels the add.
    await act(async () => {
      typeQuery(container, "Roboto");
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(onAddFontFace).not.toHaveBeenCalled();
    expect(onFontAdded).not.toHaveBeenCalled();
  });

  it("clears the Add another variant context when the query changes", async () => {
    await search("Inter");

    await act(async () => {
      clickButton(container, "Add font");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(hasButton(container, "Add another variant")).toBe(true);

    // The results now refer to a different family: the stale "Add another
    // variant" action must disappear together with the other search state.
    await act(async () => {
      typeQuery(container, "Roboto");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS + 100);
    });
    await act(async () => {});

    expect(hasButton(container, "Add another variant")).toBe(false);
  });
});
