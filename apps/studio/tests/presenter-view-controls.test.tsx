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
import type { ControlGalleryView } from "../src/features/control/use-live-gallery-control";
import type { ControlScriptedActionGroup } from "../src/features/control/use-live-scripted-action-control";
import type { PlayerOperationalStatus } from "../src/features/control/player-presence";
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

function gallery(
  elementId: string,
  itemCount: number,
  overrides: Partial<ControlGalleryView> = {},
): ControlGalleryView {
  return {
    slot: 0,
    elementId,
    itemCount,
    targetIndex: 0,
    expanded: false,
    pending: false,
    ...overrides,
  };
}

describe("PresenterView controls", () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalRequestFullscreen: PropertyDescriptor | undefined;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    originalRequestFullscreen = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      "requestFullscreen",
    );
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
    if (originalRequestFullscreen) {
      Object.defineProperty(
        HTMLElement.prototype,
        "requestFullscreen",
        originalRequestFullscreen,
      );
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, "requestFullscreen");
    }
  });

  function render({
    controlView = view(1),
    displayIndex = 1,
    pendingVersion = null,
    previous = vi.fn(),
    next = vi.fn(),
    goTo = vi.fn(),
    requestFullscreen = vi.fn(),
    galleries = [],
    scriptedActionGroups = [],
    scriptedActionsEnabled = true,
    triggerScriptedAction = vi.fn(),
    nextGallery = vi.fn(),
    setGalleryExpanded = vi.fn(),
    end = vi.fn(),
    playerStatus = {
      kind: "ready",
      presence: {
        activationRevision: 1,
        currentVersionId: "version-1",
        bootId: "boot-1",
        stage: "ready",
        transitionedAt: 1,
      },
    },
  }: {
    controlView?: LiveControlView | null;
    displayIndex?: number;
    pendingVersion?: PendingVersion;
    previous?: ReturnType<typeof vi.fn>;
    next?: ReturnType<typeof vi.fn>;
    goTo?: ReturnType<typeof vi.fn>;
    requestFullscreen?: ReturnType<typeof vi.fn>;
    galleries?: ControlGalleryView[];
    scriptedActionGroups?: ControlScriptedActionGroup[];
    scriptedActionsEnabled?: boolean;
    triggerScriptedAction?: ReturnType<typeof vi.fn>;
    nextGallery?: ReturnType<typeof vi.fn>;
    setGalleryExpanded?: ReturnType<typeof vi.fn>;
    end?: ReturnType<typeof vi.fn>;
    playerStatus?: PlayerOperationalStatus;
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
            galleries={galleries}
            scriptedActionGroups={scriptedActionGroups}
            scriptedActionsEnabled={scriptedActionsEnabled}
            promotingVersionId={null}
            failedPromotionVersionId={null}
            playerStatus={playerStatus}
            previous={previous}
            next={next}
            goTo={goTo}
            followPlayer={vi.fn()}
            updatePlayer={vi.fn()}
            requestFullscreen={requestFullscreen}
            nextGallery={nextGallery}
            setGalleryExpanded={setGalleryExpanded}
            triggerScriptedAction={triggerScriptedAction}
            end={end}
          />
        </StudioI18nProvider>,
      );
    });

    return {
      previous,
      next,
      goTo,
      requestFullscreen,
      nextGallery,
      setGalleryExpanded,
      triggerScriptedAction,
      end,
    };
  }

  it("uses Player presence as primary status and links to Maintenance", () => {
    render({ playerStatus: { kind: "no-report" } });

    expect(container.textContent).toContain("No Player report");
    expect(container.textContent).not.toContain("Synced");
    expect(
      container.querySelector<HTMLAnchorElement>(
        'a[href="/studio/control/maintenance"]',
      )?.textContent,
    ).toBe("Maintenance");
  });

  it.each([
    [{ kind: "no-report" }, { kind: "synced" }, "No Player report"],
    [
      {
        kind: "disconnected",
        presence: {
          activationRevision: 1,
          currentVersionId: "version-1",
          bootId: "boot-1",
          stage: "ready",
          transitionedAt: 1,
        },
      },
      { kind: "synced" },
      "Player disconnected",
    ],
    [
      {
        kind: "starting",
        presence: {
          activationRevision: 1,
          currentVersionId: "version-1",
          bootId: "boot-1",
          stage: "starting",
          transitionedAt: 1,
        },
      },
      { kind: "synced" },
      "Player starting…",
    ],
    [
      {
        kind: "load-failed",
        presence: {
          activationRevision: 1,
          currentVersionId: "version-1",
          bootId: "boot-1",
          stage: "load-failed",
          transitionedAt: 1,
          errorCode: "presentation-load-failed",
        },
      },
      { kind: "synced" },
      "Player load failed",
    ],
    [undefined, { kind: "awaiting-player" }, "Player ready"],
    [undefined, { kind: "syncing" }, "Syncing…"],
    [undefined, { kind: "player-changed" }, "Player changed"],
    [undefined, { kind: "synced" }, "Synced"],
    [undefined, { kind: "synced", latencyMs: 45 }, "Synced • 45 ms"],
  ] as const)(
    "combines presence and projection status with priority: %s / %s",
    (playerStatus, projectionStatus, expected) => {
      const readyStatus: PlayerOperationalStatus = {
        kind: "ready",
        presence: {
          activationRevision: 1,
          currentVersionId: "version-1",
          bootId: "boot-1",
          stage: "ready",
          transitionedAt: 1,
        },
      };
      const controlView = view(1);
      controlView.status = projectionStatus;

      render({
        controlView,
        playerStatus: playerStatus ?? readyStatus,
      });

      expect(container.textContent).toContain(expected);
      if (expected !== "Synced" && expected !== "Synced • 45 ms") {
        expect(container.textContent).not.toContain("Synced");
      }
    },
  );

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

  it("sends a fullscreen request without calling the Presenter native API", () => {
    const requestFullscreen = vi.fn();
    const nativeRequestFullscreen = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
      configurable: true,
      value: nativeRequestFullscreen,
    });
    const result = render({ requestFullscreen });

    const fullscreenButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Fullscreen"]',
    );

    act(() => fullscreenButton?.click());

    expect(result.requestFullscreen).toHaveBeenCalledTimes(1);
    expect(nativeRequestFullscreen).not.toHaveBeenCalled();
  });

  it("renders no Gallery controls when the desired slide has no Galleries", () => {
    render();

    expect(container.querySelector('[data-gallery-controls]')).toBeNull();
  });

  it("renders Gallery commands and sends exact desired intents without fullscreen", () => {
    const arbitraryId = "gallery A / #1";
    const result = render({ galleries: [gallery(arbitraryId, 2)] });

    expect(container.textContent).toContain("Gallery");
    expect(container.textContent).not.toContain("Gallery 1");
    const nextButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Gallery: Next image"]',
    );
    const expandButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Gallery: Expand"]',
    );

    act(() => nextButton?.click());
    act(() => expandButton?.click());

    expect(result.nextGallery).toHaveBeenCalledTimes(1);
    expect(result.nextGallery).toHaveBeenCalledWith(arbitraryId);
    expect(result.setGalleryExpanded).toHaveBeenCalledTimes(1);
    expect(result.setGalleryExpanded).toHaveBeenCalledWith(arbitraryId, true);
    expect(result.requestFullscreen).not.toHaveBeenCalled();
  });

  it("keeps desktop controls in Notes and provides a separate mobile surface", () => {
    render({ galleries: [gallery("gallery-a", 2)] });

    const desktop = container.querySelector("[data-gallery-controls]");
    const mobile = container.querySelector("[data-mobile-gallery-controls]");
    const center = Array.from(container.querySelectorAll("div")).find((element) => element.className.includes("centerControls"));

    expect(desktop?.parentElement?.className).toContain("notesRegion");
    expect(mobile).not.toBeNull();
    expect(center?.contains(desktop ?? null)).toBe(false);
    expect(center?.contains(mobile ?? null)).toBe(false);
  });

  it("labels multiple Galleries deterministically and preserves per-Gallery disabled state", () => {
    const first = gallery("first", 2, { pending: true });
    const second = gallery("second", 1);
    const result = render({ galleries: [first, second] });

    expect(container.textContent).toContain("Gallery 1");
    expect(container.textContent).toContain("Gallery 2");
    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>(
      '[data-gallery-controls] button',
    ));
    expect(buttons).toHaveLength(4);
    expect(buttons.slice(0, 2).every((button) => button.disabled)).toBe(true);
    expect(buttons[2]?.disabled).toBe(true);
    expect(buttons[3]?.disabled).toBe(false);
    expect(container.querySelectorAll('[data-gallery-controls] > div')).toHaveLength(2);

    act(() => buttons[3]?.click());
    expect(result.setGalleryExpanded).toHaveBeenCalledWith("second", true);
  });

  it("uses Collapse for expanded Galleries and disables Gallery actions with empty items or disabled Control", () => {
    const expanded = gallery("expanded", 2, { expanded: true });
    const empty = gallery("empty", 0);
    const result = render({ galleries: [expanded, empty] });

    const collapseButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Gallery 1: Collapse"]',
    );
    expect(collapseButton?.textContent).toContain("Collapse");
    act(() => collapseButton?.click());
    expect(result.setGalleryExpanded).toHaveBeenCalledWith("expanded", false);
    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>(
      '[data-gallery-controls] button',
    ));
    expect(buttons[2]?.disabled).toBe(true);
    expect(buttons[3]?.disabled).toBe(true);

    act(() => {
      root.unmount();
      root = createRoot(container);
    });
    render({ controlView: view(1, false), galleries: [gallery("available", 2)] });
    expect([...container.querySelectorAll<HTMLButtonElement>('[data-gallery-controls] button')]
      .every((button) => button.disabled)).toBe(true);
  });

  it("suppresses Gallery controls while a published version is pending", () => {
    render({
      galleries: [gallery("live-gallery", 2)],
      pendingVersion: {
        targetVersionId: "version-2",
        structuralChange: true,
        projectedSlideRemoved: false,
      },
    });

    expect(container.querySelector('[data-gallery-controls]')).toBeNull();
  });

  it("renders authored Scripted action groups before Notes and keeps them enabled without a pending lock", () => {
    const triggerScriptedAction = vi.fn();
    render({
      galleries: [gallery("gallery-a", 2)],
      scriptedActionGroups: [{ scriptedSlot: 1, elementId: "scripted-a", title: "Scroller", actions: [{ portIndex: 0, portId: "up", label: "Scroll up" }, { portIndex: 2, portId: "down", label: "Scroll down" }] }],
      triggerScriptedAction,
    });

    const desktop = container.querySelector("[data-scripted-action-controls]");
    const buttons = Array.from(desktop?.querySelectorAll<HTMLButtonElement>("button") ?? []);
    expect(desktop?.parentElement?.className).toContain("notesRegion");
    expect(desktop?.previousElementSibling?.getAttribute("data-gallery-controls")).not.toBeNull();
    expect(desktop?.textContent).toContain("Scroller");
    expect(buttons.map((button) => button.textContent)).toEqual(["Scroll up", "Scroll down"]);
    expect(buttons.every((button) => !button.disabled)).toBe(true);
    act(() => { buttons[1]?.click(); buttons[1]?.click(); });
    expect(triggerScriptedAction).toHaveBeenCalledTimes(2);
    expect(triggerScriptedAction).toHaveBeenLastCalledWith(1, 2);
    expect(container.querySelector("[data-mobile-gallery-controls]")?.textContent).toContain("Scroll down");
  });

  it("keeps declared Scripted actions visible but disabled while transport or promotion is unsafe", () => {
    render({
      scriptedActionGroups: [{ scriptedSlot: 0, elementId: "scripted-a", title: "Circuit", actions: [{ portIndex: 0, portId: "reset", label: "Reset" }] }],
      scriptedActionsEnabled: false,
      pendingVersion: { targetVersionId: "version-2", structuralChange: true, projectedSlideRemoved: false },
    });
    const button = container.querySelector<HTMLButtonElement>("[data-scripted-action-controls] button");
    expect(button?.textContent).toBe("Reset");
    expect(button?.disabled).toBe(true);
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

  it("ends the presentation on Escape while Control is active", () => {
    const { end } = render();

    const escape = dispatchKey(document, { key: "Escape" });

    expect(escape.defaultPrevented).toBe(true);
    expect(end).toHaveBeenCalledTimes(1);
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

  it("ignores repeated, modified, default-prevented, and editable-target keys", () => {
    const { previous, next, end } = render();
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
    const repeatedEscape = dispatchKey(document, { key: "Escape", repeat: true });
    const modifiedEscape = dispatchKey(document, { key: "Escape", metaKey: true });
    const inputEscape = dispatchKey(input, { key: "Escape" });
    const editableEscape = dispatchKey(editableChild, { key: "Escape" });
    const prevented = new KeyboardEvent("keydown", {
      key: "ArrowLeft",
      bubbles: true,
      cancelable: true,
    });
    prevented.preventDefault();
    document.dispatchEvent(prevented);
    const preventedEscape = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    preventedEscape.preventDefault();
    document.dispatchEvent(preventedEscape);

    expect(repeated.defaultPrevented).toBe(false);
    expect(modified.defaultPrevented).toBe(false);
    expect(inputEvent.defaultPrevented).toBe(false);
    expect(editableEvent.defaultPrevented).toBe(false);
    expect(repeatedEscape.defaultPrevented).toBe(false);
    expect(modifiedEscape.defaultPrevented).toBe(false);
    expect(inputEscape.defaultPrevented).toBe(false);
    expect(editableEscape.defaultPrevented).toBe(false);
    expect(previous).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
    expect(end).not.toHaveBeenCalled();
  });
});
