// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  mountPlayer,
  type PlayerController,
  type PlayerOptions,
} from "../src/player";

import { playerTestPresentation } from "./fixtures/player-presentation";

describe("PowerShow Player", () => {
  let root: HTMLElement;
  let player: PlayerController;

  beforeEach(() => {
    document.body.innerHTML = `<div id="app"></div>`;

    const element = document.querySelector<HTMLElement>("#app");

    if (!element) {
      throw new Error("Test root was not created.");
    }

    root = element;

    player = mountPlayer(root, playerTestPresentation);
  });

  function remount(options: PlayerOptions): void {
    player.destroy();

    player = mountPlayer(root, playerTestPresentation, options);
  }

  afterEach(() => {
    player.destroy();

    document.body.replaceChildren();
  });

  it("starts on the first slide", () => {
    expect(player.getCurrentIndex()).toBe(0);

    expect(root.innerHTML).toContain("Slide One");
  });

  it("moves to the next slide", () => {
    player.next();

    expect(player.getCurrentIndex()).toBe(1);

    expect(root.innerHTML).toContain("Slide Two");
  });

  it("moves to the previous slide", () => {
    player.goTo(2);

    player.previous();

    expect(player.getCurrentIndex()).toBe(1);

    expect(root.innerHTML).toContain("Slide Two");
  });

  it("goes directly to a slide", () => {
    player.goTo(2);

    expect(player.getCurrentIndex()).toBe(2);

    expect(root.innerHTML).toContain("Slide Three");
  });

  it("ignores negative indexes", () => {
    player.goTo(-1);

    expect(player.getCurrentIndex()).toBe(0);

    expect(root.innerHTML).toContain("Slide One");
  });

  it("ignores indexes beyond the presentation", () => {
    player.goTo(99);

    expect(player.getCurrentIndex()).toBe(0);
  });

  it("does not move before the first slide", () => {
    player.previous();

    expect(player.getCurrentIndex()).toBe(0);
  });

  it("does not move after the last slide", () => {
    player.goTo(2);

    player.next();

    expect(player.getCurrentIndex()).toBe(2);
  });

  it("updates the slide counter", () => {
    const counter = root.querySelector<HTMLOutputElement>(
      ".powershow-player-counter",
    );

    expect(counter?.value).toBe("1 / 3");

    player.next();

    expect(counter?.value).toBe("2 / 3");

    player.next();

    expect(counter?.value).toBe("3 / 3");
  });
  it("disables previous on the first slide", () => {
    const button = root.querySelector<HTMLButtonElement>(
      '[data-player-action="previous"]',
    );

    expect(button?.disabled).toBe(true);
  });

  it("disables next on the last slide", () => {
    player.goTo(2);

    const button = root.querySelector<HTMLButtonElement>(
      '[data-player-action="next"]',
    );

    expect(button?.disabled).toBe(true);
  });
  it("navigates using the next button", () => {
    const button = root.querySelector<HTMLButtonElement>(
      '[data-player-action="next"]',
    );

    button?.click();

    expect(player.getCurrentIndex()).toBe(1);
  });

  it("navigates using the previous button", () => {
    player.goTo(1);

    const button = root.querySelector<HTMLButtonElement>(
      '[data-player-action="previous"]',
    );

    button?.click();

    expect(player.getCurrentIndex()).toBe(0);
  });
  it("navigates with ArrowRight", () => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowRight",
      }),
    );

    expect(player.getCurrentIndex()).toBe(1);
  });

  it("navigates with ArrowLeft", () => {
    player.goTo(1);

    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowLeft",
      }),
    );

    expect(player.getCurrentIndex()).toBe(0);
  });

  it("goes to the first slide with Home", () => {
    player.goTo(2);

    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Home",
      }),
    );

    expect(player.getCurrentIndex()).toBe(0);
  });

  it("goes to the last slide with End", () => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "End",
      }),
    );

    expect(player.getCurrentIndex()).toBe(2);
  });
  it("keeps Player controls outside the rendered slide", () => {
    const slide = root.querySelector(".powershow-slide");

    const controls = root.querySelector(".powershow-player-controls");

    expect(slide).not.toBeNull();
    expect(controls).not.toBeNull();

    expect(slide?.contains(controls ?? null)).toBe(false);
  });
  it("removes the Player DOM when destroyed", () => {
    player.destroy();

    expect(root.children.length).toBe(0);
  });
  it("auto-hides controls after the configured delay", () => {
    vi.useFakeTimers();

    try {
      remount({
        transition: "none",
        controlsAutoHideMs: 1000,
      });

      const controls = root.querySelector<HTMLElement>(
        ".powershow-player-controls",
      );

      expect(controls).not.toBeNull();

      expect(
        controls?.classList.contains("powershow-player-controls-hidden"),
      ).toBe(false);

      vi.advanceTimersByTime(999);

      expect(
        controls?.classList.contains("powershow-player-controls-hidden"),
      ).toBe(false);

      vi.advanceTimersByTime(1);

      expect(
        controls?.classList.contains("powershow-player-controls-hidden"),
      ).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
  it("keeps controls visible when auto-hide is disabled", () => {
    vi.useFakeTimers();

    try {
      remount({
        transition: "none",
        controlsAutoHideMs: null,
      });

      const controls = root.querySelector<HTMLElement>(
        ".powershow-player-controls",
      );

      expect(controls).not.toBeNull();

      vi.advanceTimersByTime(60_000);

      expect(
        controls?.classList.contains("powershow-player-controls-hidden"),
      ).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
  it("reveals hidden controls on pointer movement", () => {
    vi.useFakeTimers();

    try {
      remount({
        transition: "none",
        controlsAutoHideMs: 1000,
      });

      const stage = root.querySelector<HTMLElement>(".powershow-player-stage");

      const controls = root.querySelector<HTMLElement>(
        ".powershow-player-controls",
      );

      expect(stage).not.toBeNull();
      expect(controls).not.toBeNull();

      vi.advanceTimersByTime(1000);

      expect(
        controls?.classList.contains("powershow-player-controls-hidden"),
      ).toBe(true);

      stage?.dispatchEvent(new Event("pointermove"));

      expect(
        controls?.classList.contains("powershow-player-controls-hidden"),
      ).toBe(false);

      vi.advanceTimersByTime(1000);

      expect(
        controls?.classList.contains("powershow-player-controls-hidden"),
      ).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
  it("animates slide changes when fade transition is enabled", () => {
    remount({
      transition: "fade",
      controlsAutoHideMs: null,
    });

    const slideHost = root.querySelector<HTMLElement>(
      ".powershow-player-slide-host",
    );

    expect(slideHost).not.toBeNull();

    const animateMock = vi.fn();

    Object.defineProperty(slideHost, "animate", {
      configurable: true,
      value: animateMock,
    });

    player.next();

    expect(animateMock).toHaveBeenCalledOnce();

    expect(animateMock).toHaveBeenCalledWith(
      [
        {
          opacity: 0,
          transform: "scale(0.995)",
        },
        {
          opacity: 1,
          transform: "scale(1)",
        },
      ],
      {
        duration: 180,
        easing: "ease-out",
      },
    );
  });
  it("does not animate slide changes when transition is none", () => {
    remount({
      transition: "none",
      controlsAutoHideMs: null,
    });

    const slideHost = root.querySelector<HTMLElement>(
      ".powershow-player-slide-host",
    );

    expect(slideHost).not.toBeNull();

    const animateMock = vi.fn();

    Object.defineProperty(slideHost, "animate", {
      configurable: true,
      value: animateMock,
    });

    player.next();

    expect(animateMock).not.toHaveBeenCalled();

    expect(player.getCurrentIndex()).toBe(1);
  });
});
