// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PresentationSchema,
  type Presentation,
} from "@web-slideshow/document-schema";

import { PresenterView } from "../src/features/control/presenter/presenter-view";
import {
  usePresenterNotes,
  type PresenterNotesState,
} from "../src/features/control/presenter/use-presenter-notes";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

vi.mock("../src/features/control/presenter/use-presenter-notes", () => ({
  usePresenterNotes: vi.fn(() => ({ kind: "idle" })),
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const mockedUsePresenterNotes = vi.mocked(usePresenterNotes);

function presentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "presentation-pointed-notes",
    title: "Pointed notes",
    slides: [
      { id: "slide-1", title: "First" },
      { id: "slide-2", title: "Second" },
      { id: "slide-3", title: "Third" },
    ],
  });
}

function readyNotesState(): PresenterNotesState {
  return {
    kind: "ready",
    notes: {
      bySlideId: {
        "slide-1": {
          text: "Legacy slide note",
          pointed: [
            { id: "first-slide-note", text: "First slide note", x: 10, y: 20 },
          ],
        },
        "slide-2": {
          text: "Legacy general note must stay hidden",
          pointed: [
            {
              id: "second-slide-note-a",
              text: "Second slide first\nline",
              x: 10,
              y: 20,
            },
            { id: "second-slide-note-b", text: "", x: 30, y: 40 },
            {
              id: "second-slide-note-c",
              text: "Second slide third",
              x: 50,
              y: 60,
            },
          ],
        },
      },
    },
  };
}

describe("PresenterView pointed notes", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mockedUsePresenterNotes.mockReset();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  function render(notesState: PresenterNotesState, displayIndex = 1) {
    mockedUsePresenterNotes.mockReturnValue(notesState);
    const publishedPresentation = presentation();

    act(() => {
      root.render(
        <StudioI18nProvider>
          <PresenterView
            view={{
              enabled: true,
              desiredPageId: `slide-${displayIndex + 1}`,
              desiredPageIndex: displayIndex,
              actualPageId: `slide-${displayIndex + 1}`,
              actualPageIndex: displayIndex,
              status: { kind: "synced" },
            }}
            sendFailed={false}
            presentationState={{
              kind: "ready",
              presentation: publishedPresentation,
              livePresentation: publishedPresentation,
              displayIndex,
              pendingVersion: null,
            }}
            galleries={[]}
            scriptedActionGroups={[]}
            scriptedActionsEnabled={false}
            promotingVersionId={null}
            failedPromotionVersionId={null}
            previous={vi.fn()}
            next={vi.fn()}
            goTo={vi.fn()}
            followPlayer={vi.fn()}
            updatePlayer={vi.fn()}
            requestFullscreen={vi.fn()}
            nextGallery={vi.fn()}
            setGalleryExpanded={vi.fn()}
            triggerScriptedAction={vi.fn()}
            end={vi.fn()}
          />
        </StudioI18nProvider>,
      );
    });
  }

  it("renders the current slide pointed notes on desktop and mobile without legacy text or markers", () => {
    render(readyNotesState());

    const desktop = container.querySelector<HTMLElement>(
      "[data-pointed-notes]",
    );
    const mobile = container.querySelector<HTMLElement>(
      "[data-mobile-pointed-notes]",
    );

    expect(desktop?.parentElement?.className).toContain("notesRegion");
    expect(mobile?.parentElement?.className).toContain("mobileNotesRegion");
    expect(desktop?.textContent).toContain("Pointed notes");
    expect(desktop?.textContent).toContain("[1]Second slide first\nline");
    expect(desktop?.textContent).toContain("[2]");
    expect(desktop?.textContent).toContain("[3]Second slide third");
    expect(mobile?.textContent).toBe(desktop?.textContent);
    expect(container.textContent).not.toContain(
      "Legacy general note must stay hidden",
    );
    expect(container.querySelector("[data-pointed-note-marker]")).toBeNull();
  });

  it("resolves pointed notes by the current slide id when the display index changes", () => {
    const notes = readyNotesState();
    render(notes, 1);
    expect(
      container.querySelector("[data-pointed-notes]")?.textContent,
    ).toContain("Second slide first");
    expect(
      container.querySelector("[data-pointed-notes]")?.textContent,
    ).not.toContain("First slide note");

    render(notes, 0);
    expect(
      container.querySelector("[data-pointed-notes]")?.textContent,
    ).toContain("First slide note");
    expect(
      container.querySelector("[data-pointed-notes]")?.textContent,
    ).not.toContain("Second slide first");
  });

  it.each([
    [{ kind: "loading" } as const],
    [{ kind: "ready", notes: { bySlideId: {} } } as PresenterNotesState],
  ])("does not render an empty pointed notes section for %s", (notesState) => {
    render(notesState);

    expect(container.querySelector("[data-pointed-notes]")).toBeNull();
    expect(container.querySelector("[data-mobile-pointed-notes]")).toBeNull();
    expect(container.querySelector('[class*="mobileNotesRegion"]')).toBeNull();
  });

  it("keeps the localized notes load error visible on both responsive owners", () => {
    render({ kind: "error" });

    expect(container.textContent).toContain("Could not load notes.");
    expect(
      container.querySelector('[class*="mobileNotesRegion"]')?.textContent,
    ).toContain("Could not load notes.");
    expect(
      container.querySelector('[class*="notesRegion"]')?.textContent,
    ).toContain("Could not load notes.");
    expect(container.querySelector("[data-pointed-notes]")).toBeNull();
    expect(container.querySelector("[data-mobile-pointed-notes]")).toBeNull();
  });
});
