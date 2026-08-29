// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  liveState: { kind: "none" } as { kind: "none" } | {
    kind: "active";
    live: { publicationId: string; currentVersionId: string; revision: number };
  },
  activateLivePresentation: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("../src/features/control/realtime-db", () => ({
  isRealtimeDatabaseConfigured: () => true,
}));
vi.mock("../src/features/control/live-current", () => ({
  activateLivePresentation: mocks.activateLivePresentation,
  endLivePresentation: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../src/features/control/use-live-session-control", () => ({
  useLiveSessionControl: () => ({
    liveState: mocks.liveState,
    view: null,
    sendFailed: false,
    promotingVersionId: null,
    failedPromotionVersionId: null,
    previous: vi.fn(),
    next: vi.fn(),
    goTo: vi.fn(),
    followPlayer: vi.fn(),
    updatePlayer: vi.fn(),
  }),
}));
vi.mock("../src/features/control/presenter/use-presenter-presentation", () => ({
  usePresenterPresentation: () => ({ kind: "idle" }),
  resolveLivePageId: vi.fn(),
}));

import { ControlPage } from "../src/features/control/control-page";
import { StudioI18nProvider } from "../src/features/i18n/studio-i18n-context";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("ControlPage empty state recovery", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    mocks.liveState = { kind: "none" };
    mocks.activateLivePresentation.mockReset();
    mocks.push.mockReset();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = "";
  });

  function render() {
    act(() => {
      root.render(
        <StudioI18nProvider>
          <ControlPage />
        </StudioI18nProvider>,
      );
    });
  }

  function recoveryButton(): HTMLButtonElement | null {
    return Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.includes("Re-display")) ?? null;
  }

  function dispatchKey(target: EventTarget, init: KeyboardEventInit): KeyboardEvent {
    const event = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      ...init,
    });
    act(() => target.dispatchEvent(event));
    return event;
  }

  it("shows the initial no-active state without recovery", () => {
    render();

    expect(container.textContent).toContain("No presentation is active.");
    expect(recoveryButton()).toBeNull();
    expect(container.textContent).toContain("Back to Library");
  });

  it("routes an unmodified Escape to Library without changing recovery state", () => {
    render();

    const escape = dispatchKey(document, { key: "Escape" });

    expect(escape.defaultPrevented).toBe(true);
    expect(mocks.push).toHaveBeenCalledWith("/studio/library");
    expect(mocks.activateLivePresentation).not.toHaveBeenCalled();
    expect(recoveryButton()).toBeNull();
  });

  it("preserves no-active Escape keyboard safety guards", () => {
    render();

    const input = document.createElement("input");
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    const editableChild = document.createElement("span");
    editable.appendChild(editableChild);
    document.body.append(input, editable);

    const repeated = dispatchKey(document, { key: "Escape", repeat: true });
    const modified = dispatchKey(document, { key: "Escape", ctrlKey: true });
    const inputEscape = dispatchKey(input, { key: "Escape" });
    const editableEscape = dispatchKey(editableChild, { key: "Escape" });
    const prevented = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    prevented.preventDefault();
    act(() => document.dispatchEvent(prevented));

    expect(repeated.defaultPrevented).toBe(false);
    expect(modified.defaultPrevented).toBe(false);
    expect(inputEscape.defaultPrevented).toBe(false);
    expect(editableEscape.defaultPrevented).toBe(false);
    expect(prevented.defaultPrevented).toBe(true);
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("remembers the latest active identity and re-displays it without its revision", async () => {
    mocks.liveState = {
      kind: "active",
      live: { publicationId: "publication-old", currentVersionId: "version-old", revision: 4 },
    };
    render();

    mocks.liveState = { kind: "none" };
    render();
    expect(recoveryButton()).not.toBeNull();

    mocks.activateLivePresentation.mockResolvedValue(undefined);
    await act(async () => recoveryButton()?.click());

    expect(mocks.activateLivePresentation).toHaveBeenCalledWith(
      "publication-old",
      "version-old",
    );
    expect(mocks.activateLivePresentation.mock.calls[0]).toHaveLength(2);
  });

  it("uses a newer identity observed before ending", async () => {
    mocks.liveState = {
      kind: "active",
      live: { publicationId: "publication-old", currentVersionId: "version-old", revision: 4 },
    };
    render();
    mocks.liveState = {
      kind: "active",
      live: { publicationId: "publication-new", currentVersionId: "version-new", revision: 9 },
    };
    render();
    mocks.liveState = { kind: "none" };
    render();

    mocks.activateLivePresentation.mockResolvedValue(undefined);
    await act(async () => recoveryButton()?.click());

    expect(mocks.activateLivePresentation).toHaveBeenCalledWith(
      "publication-new",
      "version-new",
    );
  });

  it("prevents duplicate activation and allows retry after failure", async () => {
    let resolveActivation!: () => void;
    mocks.liveState = {
      kind: "active",
      live: { publicationId: "publication-1", currentVersionId: "version-1", revision: 2 },
    };
    render();
    mocks.liveState = { kind: "none" };
    render();

    mocks.activateLivePresentation.mockImplementation(
      () => new Promise<void>((resolve) => { resolveActivation = resolve; }),
    );
    const button = recoveryButton();
    act(() => button?.click());
    act(() => button?.click());
    expect(mocks.activateLivePresentation).toHaveBeenCalledTimes(1);
    expect(recoveryButton()?.disabled).toBe(true);

    await act(async () => resolveActivation());
    expect(recoveryButton()?.disabled).toBe(false);

    mocks.activateLivePresentation.mockRejectedValueOnce(new Error("failed"));
    await act(async () => recoveryButton()?.click());
    expect(recoveryButton()?.disabled).toBe(false);

    mocks.activateLivePresentation.mockResolvedValueOnce(undefined);
    await act(async () => recoveryButton()?.click());
    expect(mocks.activateLivePresentation).toHaveBeenCalledTimes(3);
  });
});
