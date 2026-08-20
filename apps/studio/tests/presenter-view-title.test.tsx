// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PresentationSchema,
  type Presentation,
} from "@powershow/document-schema";

import { PresenterView } from "../src/features/control/presenter/presenter-view";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";
import type { LiveControlView } from "../src/features/control/live-control";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

/**
 * Regression contract for the Control centered title: PresenterView must
 * render the title of the READY published Presentation it received, exactly as
 * stored in that immutable version, and never substitute the generic
 * "Untitled presentation" draft fallback.
 */
function namedPublishedPresentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "presentation-named",
    title: "Named presentation",
    slides: [{ id: "slide-1", title: "First slide" }],
  });
}

const VIEW: LiveControlView = {
  enabled: true,
  desiredPageId: "slide-1",
  desiredPageIndex: 0,
  actualPageId: "slide-1",
  actualPageIndex: 0,
  status: { kind: "synced", latencyMs: 12 },
};

describe("PresenterView published presentation title", () => {
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

  it("renders the ready published Presentation.title in the centered TopbarTitle", async () => {
    const presentation = namedPublishedPresentation();

    act(() => {
      root.render(
        <StudioI18nProvider>
          <PresenterView
            view={VIEW}
            sendFailed={false}
            presentationState={{
              kind: "ready",
              presentation,
              livePresentation: presentation,
              displayIndex: 0,
              pendingVersion: null,
            }}
            promotingVersionId={null}
            failedPromotionVersionId={null}
            previous={vi.fn()}
            next={vi.fn()}
            followPlayer={vi.fn()}
            updatePlayer={vi.fn()}
            end={vi.fn()}
          />
        </StudioI18nProvider>,
      );
    });

    // Settle the async private-notes read so its state update lands inside act.
    await act(async () => {});

    const titleSlot = container.querySelector(".ps-ui-topbar__title");

    expect(titleSlot?.textContent).toBe("Named presentation");
    expect(titleSlot?.getAttribute("title")).toBe("Named presentation");
    expect(container.textContent).not.toContain("Untitled presentation");
  });
});