// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PresentationSchema,
  type Presentation,
} from "@powershow/document-schema";

import { PresenterView } from "../src/features/control/presenter/presenter-view";
import type { LiveControlView } from "../src/features/control/live-control";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

vi.mock("../src/features/control/presenter/use-presenter-notes", () => ({
  usePresenterNotes: () => ({ kind: "idle" }),
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

type PendingVersion = Extract<
  ComponentProps<typeof PresenterView>["presentationState"],
  { kind: "ready" }
>["pendingVersion"];

function presentation(): Presentation {
  return PresentationSchema.parse({
    schemaVersion: 1,
    id: "presentation-1",
    title: "Control presentation",
    slides: [
      { id: "slide-1", title: "First" },
      { id: "slide-2", title: "Second" },
      { id: "slide-3", title: "Third" },
    ],
  });
}

function view(index: number, enabled = true): LiveControlView {
  return {
    enabled,
    desiredPageId: `slide-${index + 1}`,
    desiredPageIndex: index,
    actualPageId: `slide-${index + 1}`,
    actualPageIndex: index,
    status: { kind: "synced" },
  };
}

describe("PresenterView controls", () => {
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

  function render({
    controlView = view(1),
    displayIndex = 1,
    pendingVersion = null,
    previous = vi.fn(),
    next = vi.fn(),
    goTo = vi.fn(),
  }: {
    controlView?: LiveControlView | null;
    displayIndex?: number;
    pendingVersion?: PendingVersion;
    previous?: ReturnType<typeof vi.fn>;
    next?: ReturnType<typeof vi.fn>;
    goTo?: ReturnType<typeof vi.fn>;
  } = {}) {
    const publishedPresentation = presentation();

    act(() => {
      root.render(
        <StudioI18nProvider>
          <PresenterView
            view={controlView}
            sendFailed={false}
            presentationState={{
              kind: "ready",
              presentation: publishedPresentation,
              livePresentation: publishedPresentation,
              displayIndex,
              pendingVersion,
            }}
            promotingVersionId={null}
            failedPromotionVersionId={null}
            previous={previous}
            next={next}
            goTo={goTo}
            followPlayer={vi.fn()}
            updatePlayer={vi.fn()}
            end={vi.fn()}
          />
        </StudioI18nProvider>,
      );
    });

    return { previous, next, goTo };
  }

  function dispatchKey(target: EventTarget, init: KeyboardEventInit): KeyboardEvent {
    const event = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      ...init,
    });
    act(() => {
      target.dispatchEvent(event);
    });
    return event;
  }

  it("renders interactive Summary rows and navigates directly", () => {
    const { goTo } = render();
    const buttons = Array.from(
      container.querySelectorAll<HTMLButtonElement>("ol button"),
    );

    expect(buttons).toHaveLength(3);
    expect(buttons[1]?.getAttribute("aria-current")).toBe("step");

    act(() => buttons[2]?.click());

    expect(goTo).toHaveBeenCalledWith(2);
  });

  it("disables Summary navigation when Control is unavailable or a version is pending", () => {
    const unavailable = render({ controlView: view(1, false) });

    expect(
      [...container.querySelectorAll("ol button")].every(
        (button) => (button as HTMLButtonElement).disabled,
      ),
    ).toBe(true);

    act(() => {
      root.unmount();
      root = createRoot(container);
    });

    const pending = render({
      pendingVersion: {
        targetVersionId: "version-2",
        structuralChange: true,
        projectedSlideRemoved: false,
      },
    });
    const pendingButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>("ol button"),
    );

    expect(
      [...pendingButtons].every(
        (button) => (button as HTMLButtonElement).disabled,
      ),
    ).toBe(true);
    act(() => pendingButtons[0]?.click());
    expect(unavailable.goTo).not.toHaveBeenCalled();
    expect(pending.goTo).not.toHaveBeenCalled();
  });

  it("uses Previous and Next for valid arrow navigation", () => {
    const { previous, next } = render();

    const left = dispatchKey(document, { key: "ArrowLeft" });
    const right = dispatchKey(document, { key: "ArrowRight" });

    expect(left.defaultPrevented).toBe(true);
    expect(right.defaultPrevented).toBe(true);
    expect(previous).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("does not consume arrows when movement is unavailable", () => {
    const first = render({ displayIndex: 0, controlView: view(0) });
    const firstLeft = dispatchKey(document, { key: "ArrowLeft" });

    expect(firstLeft.defaultPrevented).toBe(false);
    expect(first.previous).not.toHaveBeenCalled();

    act(() => {
      root.unmount();
      root = createRoot(container);
    });

    const last = render({ displayIndex: 2, controlView: view(2) });
    const lastRight = dispatchKey(document, { key: "ArrowRight" });

    expect(lastRight.defaultPrevented).toBe(false);
    expect(last.next).not.toHaveBeenCalled();

    act(() => {
      root.unmount();
      root = createRoot(container);
    });

    const pending = render({
      pendingVersion: {
        targetVersionId: "version-2",
        structuralChange: false,
        projectedSlideRemoved: false,
      },
    });
    const pendingLeft = dispatchKey(document, { key: "ArrowLeft" });
    const pendingRight = dispatchKey(document, { key: "ArrowRight" });

    expect(pendingLeft.defaultPrevented).toBe(false);
    expect(pendingRight.defaultPrevented).toBe(false);
    expect(pending.previous).not.toHaveBeenCalled();
    expect(pending.next).not.toHaveBeenCalled();
  });

  it("ignores repeated, modified, default-prevented, and editable-target arrows", () => {
    const { previous, next } = render();
    const input = document.createElement("input");
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    const editableChild = document.createElement("span");
    editable.appendChild(editableChild);
    document.body.append(input, editable);

    const repeated = dispatchKey(document, { key: "ArrowLeft", repeat: true });
    const modified = dispatchKey(document, { key: "ArrowRight", ctrlKey: true });
    const inputEvent = dispatchKey(input, { key: "ArrowLeft" });
    const editableEvent = dispatchKey(editableChild, { key: "ArrowRight" });
    const prevented = new KeyboardEvent("keydown", {
      key: "ArrowLeft",
      bubbles: true,
      cancelable: true,
    });
    prevented.preventDefault();
    document.dispatchEvent(prevented);

    expect(repeated.defaultPrevented).toBe(false);
    expect(modified.defaultPrevented).toBe(false);
    expect(inputEvent.defaultPrevented).toBe(false);
    expect(editableEvent.defaultPrevented).toBe(false);
    expect(previous).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
