// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { mountPlayer, type PlayerController } from "../src/player";

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
});
