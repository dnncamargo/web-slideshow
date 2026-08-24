// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PresentationSchema } from "@powershow/document-schema";

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
  it("mounts presentation font resources once across slide navigation", () => {
    player.destroy();

    const presentation = structuredClone(playerTestPresentation);
    presentation.resources = {
      fonts: [
        {
          id: "source-sans-3",
          family: "Source Sans 3",
          source: {
            type: "url",
            url: "https://cdn.example.com/source-sans-3.woff2",
            format: "woff2",
          },
        },
      ],
    };
    presentation.slides[0]?.elements.forEach((element) => {
      if (element.type === "text" || element.type === "textbox") {
        element.typography = {
          ...element.typography,
          fontFamily: "Source Sans 3",
        };
      } else if (element.type !== "container") {
        element.style = {
          ...element.style,
          fontFamily: "Source Sans 3",
        };
      }
    });

    player = mountPlayer(root, presentation);

    const resourceStyles = root.querySelectorAll(
      "style[data-powershow-font-resources]",
    );

    expect(resourceStyles).toHaveLength(1);
    expect(resourceStyles[0]?.textContent?.split("@font-face")).toHaveLength(2);
    expect(resourceStyles[0]?.textContent).toContain("font-display:swap");
    expect(root.innerHTML).toContain("font-family:&quot;Source Sans 3&quot;");

    player.next();

    expect(
      root.querySelectorAll("style[data-powershow-font-resources]"),
    ).toHaveLength(1);
  });
  it("uses the renderer CSS for multiple font faces", () => {
    player.destroy();

    const presentation = structuredClone(playerTestPresentation);
    presentation.resources = {
      fonts: [
        {
          id: "inter",
          family: "Inter",
          faces: [
            {
              weight: 400,
              style: "normal",
              subset: "latin",
              source: {
                type: "url",
                url: "https://cdn.example.com/inter-400.woff2",
                format: "woff2",
              },
            },
            {
              weight: 700,
              style: "normal",
              subset: "latin",
              source: {
                type: "url",
                url: "https://cdn.example.com/inter-700.woff2",
                format: "woff2",
              },
            },
          ],
        },
      ],
    };
    const firstElement = presentation.slides[0]?.elements[0];
    if (firstElement) {
      firstElement.style = {
        ...firstElement.style,
        fontFamily: "Inter",
        fontWeight: 700,
      };
    }

    player = mountPlayer(root, presentation);

    const resourceStyle = root.querySelector<HTMLStyleElement>(
      "style[data-powershow-font-resources]",
    );

    expect(resourceStyle?.textContent?.split("@font-face")).toHaveLength(3);
    expect(resourceStyle?.textContent).toContain("font-weight:400");
    expect(resourceStyle?.textContent).toContain("font-weight:700");
    expect(resourceStyle?.textContent?.split("font-style:normal")).toHaveLength(
      3,
    );
    expect(root.innerHTML).toContain("font-weight:700");

    player.next();

    expect(
      root.querySelectorAll("style[data-powershow-font-resources]"),
    ).toHaveLength(1);
    expect(resourceStyle?.textContent?.split("@font-face")).toHaveLength(3);
  });

  it("mounts and renders a canonical Container presentation", () => {
    player.destroy();

    const presentation = PresentationSchema.parse({
      schemaVersion: 1,
      id: "canonical-container-player",
      title: "Canonical Container",
      description: "",
      aspectRatio: "16:9",
      slides: [
        {
          id: "slide-container",
          title: "",
          summary: "",
          speakerNotes: "",
          elements: [
            {
              id: "container-rendered",
              type: "container",
              hidden: false,
              layout: {
                width: "80%",
                padding: 16,
                children: {
                  direction: "column",
                  gap: 12,
                },
              },
              style: {
                background: {
                  color: "#123456",
                },
                borderRadius: 8,
              },
              effect: {
                opacity: 0.75,
              },
              children: [
                {
                  id: "canonical-text",
                  type: "text",
                  hidden: false,
                  variant: "body",
                  content: "Canonical Player Container",
                },
              ],
            },
          ],
        },
      ],
    });

    player = mountPlayer(root, presentation);

    const container = root.querySelector<HTMLElement>(
      '[data-powershow-id="container-rendered"]',
    );

    const child = root.querySelector<HTMLElement>(
      '[data-powershow-id="canonical-text"]',
    );

    expect(container).not.toBeNull();
    expect(child).not.toBeNull();
    expect(child?.textContent).toContain("Canonical Player Container");

    const style = container?.getAttribute("style") ?? "";

    expect(style).toContain("width:80%");
    expect(style).toContain("padding:16px");
    expect(style).toContain("flex-direction:column");
    expect(style).toContain("gap:12px");
    expect(style).toContain("background:#123456");
    expect(style).toContain("border-radius:8px");
    expect(style).toContain("opacity:0.75");
  });

  it("plays normalized Google-imported faces without stylesheet/provider state", () => {
    player.destroy();

    const presentation = structuredClone(playerTestPresentation);
    presentation.resources = {
      fonts: [
        {
          id: "audiowide",
          family: "Audiowide",
          faces: [
            {
              weight: 400,
              style: "normal",
              unicodeRange: "U+0100-024F",
              source: {
                type: "url",
                url: "https://fonts.gstatic.com/s/audiowide/latin-ext.woff2",
                format: "woff2",
              },
            },
            {
              weight: 400,
              style: "normal",
              unicodeRange: "U+0000-00FF",
              source: {
                type: "url",
                url: "https://fonts.gstatic.com/s/audiowide/latin.woff2",
                format: "woff2",
              },
            },
          ],
        },
      ],
    };
    const firstElement = presentation.slides[0]?.elements[0];

    if (firstElement) {
      firstElement.style = {
        ...firstElement.style,
        fontFamily: "Audiowide",
      };
    }

    player = mountPlayer(root, presentation);

    const resourceStyle = root.querySelector<HTMLStyleElement>(
      "style[data-powershow-font-resources]",
    );

    expect(resourceStyle?.textContent?.split("@font-face")).toHaveLength(3);
    expect(resourceStyle?.textContent).toContain("fonts.gstatic.com");
    expect(resourceStyle?.textContent).toContain("U+0100-024F");
    expect(resourceStyle?.textContent).toContain("U+0000-00FF");
    expect(resourceStyle?.textContent).not.toContain("fonts.googleapis.com");
    expect(JSON.stringify(presentation)).not.toContain("provider");

    player.next();

    expect(
      root.querySelectorAll("style[data-powershow-font-resources]"),
    ).toHaveLength(1);
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
  // ============================================================
  // BEGIN: TESTES DE POSIÇÃO DOS CONTROLES
  // ============================================================

  it("uses bottom-center controls by default", () => {
    const controller = mountPlayer(root, playerTestPresentation);

    const controls = root.querySelector(".powershow-player-controls");

    expect(controls).not.toBeNull();

    expect(
      controls?.classList.contains("powershow-player-controls-bottom-center"),
    ).toBe(true);

    controller.destroy();
  });

  it("supports top-right controls", () => {
    const controller = mountPlayer(root, playerTestPresentation, {
      controls: {
        position: "top-right",
      },
    });

    const controls = root.querySelector(".powershow-player-controls");

    expect(controls).not.toBeNull();

    expect(
      controls?.classList.contains("powershow-player-controls-top-right"),
    ).toBe(true);

    controller.destroy();
  });

  it("supports bottom-left controls", () => {
    const controller = mountPlayer(root, playerTestPresentation, {
      controls: {
        position: "bottom-left",
      },
    });

    const controls = root.querySelector(".powershow-player-controls");

    expect(controls).not.toBeNull();

    expect(
      controls?.classList.contains("powershow-player-controls-bottom-left"),
    ).toBe(true);

    controller.destroy();
  });

  // ============================================================
  // END: TESTES DE POSIÇÃO DOS CONTROLES
  // ============================================================
  // ============================================================
  // BEGIN: TESTES DE VISIBILIDADE DO CONTADOR
  // ============================================================

  it("shows the slide counter by default", () => {
    const player = mountPlayer(root, playerTestPresentation);

    const counter = root.querySelector<HTMLOutputElement>(
      ".powershow-player-counter",
    );

    expect(counter).not.toBeNull();

    // O comportamento padrão deve continuar mostrando
    // o contador.
    expect(counter?.hidden).toBe(false);

    expect(counter?.value).toBe("1 / 3");

    player.destroy();
  });

  it("can hide the slide counter", () => {
    const player = mountPlayer(root, playerTestPresentation, {
      controls: {
        showCounter: false,
      },
    });

    const counter = root.querySelector<HTMLOutputElement>(
      ".powershow-player-counter",
    );

    expect(counter).not.toBeNull();

    // O elemento continua existindo estruturalmente,
    // mas não é exibido.
    expect(counter?.hidden).toBe(true);

    player.destroy();
  });

  // ============================================================
  // END: TESTES DE VISIBILIDADE DO CONTADOR
  // ============================================================

  // ============================================================
  // BEGIN: TESTES DAS VARIANTES VISUAIS DOS CONTROLES
  // ============================================================

  it("uses floating controls by default", () => {
    const player = mountPlayer(root, playerTestPresentation);

    const controls = root.querySelector(".powershow-player-controls");

    expect(controls).not.toBeNull();

    expect(
      controls?.classList.contains("powershow-player-controls-floating"),
    ).toBe(true);

    player.destroy();
  });

  it("supports minimal controls", () => {
    const player = mountPlayer(root, playerTestPresentation, {
      controls: {
        style: "minimal",
      },
    });

    const controls = root.querySelector(".powershow-player-controls");

    expect(controls).not.toBeNull();

    expect(
      controls?.classList.contains("powershow-player-controls-minimal"),
    ).toBe(true);

    player.destroy();
  });

  it("supports compact controls", () => {
    const player = mountPlayer(root, playerTestPresentation, {
      controls: {
        style: "compact",
      },
    });

    const controls = root.querySelector(".powershow-player-controls");

    expect(controls).not.toBeNull();

    expect(
      controls?.classList.contains("powershow-player-controls-compact"),
    ).toBe(true);

    player.destroy();
  });

  // ============================================================
  // END: TESTES DAS VARIANTES VISUAIS DOS CONTROLES
  // ============================================================

  // ============================================================
  // BEGIN: TESTES DE ANIMAÇÃO DOS CONTROLES
  // ============================================================

  it("uses fade controls animation by default", () => {
    const player = mountPlayer(root, playerTestPresentation);

    const controls = root.querySelector(".powershow-player-controls");

    expect(controls).not.toBeNull();

    expect(controls?.classList.contains("powershow-player-controls-fade")).toBe(
      true,
    );

    player.destroy();
  });

  it("supports slide controls animation", () => {
    const player = mountPlayer(root, playerTestPresentation, {
      controls: {
        animation: "slide",
      },
    });

    const controls = root.querySelector(".powershow-player-controls");

    expect(controls).not.toBeNull();

    expect(
      controls?.classList.contains("powershow-player-controls-slide"),
    ).toBe(true);

    player.destroy();
  });

  it("supports controls without animation", () => {
    const player = mountPlayer(root, playerTestPresentation, {
      controls: {
        animation: "none",
      },
    });

    const controls = root.querySelector(".powershow-player-controls");

    expect(controls).not.toBeNull();

    expect(controls?.classList.contains("powershow-player-controls-none")).toBe(
      true,
    );

    player.destroy();
  });

  // ============================================================
  // END: TESTES DE ANIMAÇÃO DOS CONTROLES
  // ============================================================
});
