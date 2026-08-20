// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  PresentationSchema,
  type Presentation,
} from "@powershow/document-schema";

import { EditorWorkspace } from "../src/features/editor/editor-workspace";
import { PresenterSlideList } from "../src/features/control/presenter/presenter-slide-list";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const LONG_TITLE =
  "A very long slide title that surely overflows the summary column width and must be revealed by the hover scroll behavior";

function createTitledPresentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "presentation-slides-titles",
    title: "Slide titles",
    slides: [
      { id: "slide-long", title: LONG_TITLE },
      { id: "slide-short", title: "Short" },
      { id: "slide-empty" },
    ],
  });
}

describe("single-line hover-scroll slide titles", () => {
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

  it("uses the shared hover-scroll primitive for the Editor SLIDES list", () => {
    act(() => {
      root.render(
        <StudioI18nProvider>
          <EditorWorkspace
            initialPresentation={createTitledPresentation()}
          />
        </StudioI18nProvider>,
      );
    });

    const scrollTitles = Array.from(
      container.querySelectorAll(".ps-ui-hover-scroll"),
    );
    const longTitle = scrollTitles.find(
      (element) => element.getAttribute("title") === LONG_TITLE,
    );

    expect(longTitle).toBeDefined();
    expect(longTitle?.textContent).toBe(LONG_TITLE);
  });

  it("uses the same primitive for Control Summary slide titles and keeps the full text available", () => {
    act(() => {
      root.render(
        <PresenterSlideList
          presentation={createTitledPresentation()}
          desiredPageIndex={0}
        />,
      );
    });

    const scrollTitles = Array.from(
      container.querySelectorAll<Element>(".ps-ui-hover-scroll"),
    );

    expect(scrollTitles).toHaveLength(3);

    const longTitle = scrollTitles.find(
      (element) => element.getAttribute("title") === LONG_TITLE,
    );
    expect(longTitle).not.toBeUndefined();
    expect(longTitle?.textContent).toBe(LONG_TITLE);

    const shortTitle = scrollTitles[1];
    expect(shortTitle?.getAttribute("title")).toBe("Short");
    expect(shortTitle?.textContent).toBe("Short");

    const untitledSlide = scrollTitles[2];
    expect(untitledSlide?.getAttribute("title")).toBe("Slide 3");
  });

  it("keeps the Control Summary read-only without navigation affordances", () => {
    act(() => {
      root.render(
        <PresenterSlideList
          presentation={createTitledPresentation()}
          desiredPageIndex={1}
        />,
      );
    });

    const interactive = container.querySelectorAll(
      "button, a, input, [role='button']",
    );
    expect(interactive.length).toBe(0);

    const current = container.querySelector('[aria-current="step"]');
    expect(current).not.toBeNull();
  });
});