import type {
  Presentation,
} from "@powershow/document-schema";

import {
  renderSlide,
} from "@powershow/renderer";

function queryRequired<T extends Element>(
  root: ParentNode,
  selector: string,
): T {
  const element =
    root.querySelector<T>(selector);

  if (!element) {
    throw new Error(
      `PowerShow Player element not found: ${selector}`,
    );
  }

  return element;
}

export type PlayerTransition =
  | "none"
  | "fade";

export interface PlayerOptions {
  transition?: PlayerTransition;

  controlsAutoHideMs?: number | null;
}

export interface PlayerController {
  next(): void;

  previous(): void;

  goTo(index: number): void;

  fullscreen(): Promise<void>;

  getCurrentIndex(): number;

  destroy(): void;
}

export function mountPlayer(
  root: HTMLElement,
  presentation: Presentation,
  options: PlayerOptions = {},
): PlayerController {
  let currentIndex = 0;

  let controlsTimer:
    ReturnType<typeof setTimeout>
    | undefined;

  let destroyed = false;

  const transition =
    options.transition ?? "fade";

  const controlsAutoHideMs =
    options.controlsAutoHideMs === undefined
      ? 2500
      : options.controlsAutoHideMs;

  /*
   * Player shell.
   *
   * Notice that navigation is a sibling of
   * the slide host. It is NOT rendered by
   * renderSlide().
   */
  root.innerHTML = `
    <div class="powershow-player">
      <div class="powershow-player-stage">
        <div
          class="powershow-player-slide-host"
        ></div>

        <nav
          class="powershow-player-controls"
          aria-label="Presentation navigation"
        >
          <button
            type="button"
            data-player-action="previous"
            aria-label="Previous slide"
          >
            ←
          </button>

          <output
            class="powershow-player-counter"
            aria-live="polite"
          ></output>

          <button
            type="button"
            data-player-action="next"
            aria-label="Next slide"
          >
            →
          </button>

          <button
            type="button"
            data-player-action="fullscreen"
            aria-label="Fullscreen"
          >
            ⛶
          </button>
        </nav>
      </div>
    </div>
  `;

  /*
   * Required DOM elements.
   *
   * queryRequired() guarantees non-null
   * values both to TypeScript and at runtime.
   */
  const stage =
    queryRequired<HTMLElement>(
      root,
      ".powershow-player-stage",
    );

  const slideHost =
    queryRequired<HTMLElement>(
      root,
      ".powershow-player-slide-host",
    );

  const controls =
    queryRequired<HTMLElement>(
      root,
      ".powershow-player-controls",
    );

  const counter =
    queryRequired<HTMLOutputElement>(
      root,
      ".powershow-player-counter",
    );

  const previousButton =
    queryRequired<HTMLButtonElement>(
      root,
      '[data-player-action="previous"]',
    );

  const nextButton =
    queryRequired<HTMLButtonElement>(
      root,
      '[data-player-action="next"]',
    );

  const fullscreenButton =
    queryRequired<HTMLButtonElement>(
      root,
      '[data-player-action="fullscreen"]',
    );

  function updateStageSize(): void {
    const ratio =
      presentation.aspectRatio === "4:3"
        ? {
            width: 4,
            height: 3,
          }
        : {
            width: 16,
            height: 9,
          };

    const scale = Math.min(
      window.innerWidth / ratio.width,
      window.innerHeight / ratio.height,
    );

    stage.style.width =
      `${ratio.width * scale}px`;

    stage.style.height =
      `${ratio.height * scale}px`;
  }

  function showControls(): void {
    if (controlsTimer !== undefined) {
      clearTimeout(controlsTimer);

      controlsTimer = undefined;
    }

    controls.classList.remove(
      "powershow-player-controls-hidden",
    );

    if (
      controlsAutoHideMs !== null &&
      controlsAutoHideMs > 0
    ) {
      controlsTimer = setTimeout(() => {
        controls.classList.add(
          "powershow-player-controls-hidden",
        );

        controlsTimer = undefined;
      }, controlsAutoHideMs);
    }
  }

  function renderCurrentSlide(): void {
    const slide =
      presentation.slides[currentIndex];

    if (!slide) {
      slideHost.innerHTML = `
        <div class="powershow-player-empty">
          No slide available.
        </div>
      `;

      counter.value = "0 / 0";

      previousButton.disabled = true;
      nextButton.disabled = true;

      return;
    }

    slideHost.innerHTML =
      renderSlide(slide);

    if (
      transition === "fade" &&
      typeof slideHost.animate === "function"
    ) {
      slideHost.animate(
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
    }

    counter.value =
      `${currentIndex + 1} / ${presentation.slides.length}`;

    previousButton.disabled =
      currentIndex === 0;

    nextButton.disabled =
      currentIndex ===
      presentation.slides.length - 1;
  }

  function goTo(index: number): void {
    if (
      index < 0 ||
      index >= presentation.slides.length
    ) {
      return;
    }

    currentIndex = index;

    renderCurrentSlide();
  }

  function next(): void {
    goTo(currentIndex + 1);
  }

  function previous(): void {
    goTo(currentIndex - 1);
  }

  async function fullscreen(): Promise<void> {
    if (document.fullscreenElement) {
      await document.exitFullscreen();

      return;
    }

    await root.requestFullscreen();
  }

  function handleKeyboard(
    event: KeyboardEvent,
  ): void {
    switch (event.key) {
      case "ArrowRight":
      case "PageDown":
        event.preventDefault();

        next();

        break;

      case "ArrowLeft":
      case "PageUp":
        event.preventDefault();

        previous();

        break;

      case "Home":
        event.preventDefault();

        goTo(0);

        break;

      case "End":
        event.preventDefault();

        goTo(
          presentation.slides.length - 1,
        );

        break;

      case "f":
      case "F":
        event.preventDefault();

        void fullscreen();

        break;
    }
  }

  function handlePrevious(): void {
    previous();
  }

  function handleNext(): void {
    next();
  }

  function handleFullscreen(): void {
    void fullscreen();
  }

  /*
   * Register listeners exactly once.
   */
  previousButton.addEventListener(
    "click",
    handlePrevious,
  );

  nextButton.addEventListener(
    "click",
    handleNext,
  );

  fullscreenButton.addEventListener(
    "click",
    handleFullscreen,
  );

  window.addEventListener(
    "keydown",
    handleKeyboard,
  );

  window.addEventListener(
    "resize",
    updateStageSize,
  );

  stage.addEventListener(
    "pointermove",
    showControls,
  );

  stage.addEventListener(
    "pointerdown",
    showControls,
  );

  updateStageSize();
  renderCurrentSlide();
  showControls();

  return {
    next,

    previous,

    goTo,

    fullscreen,

    getCurrentIndex(): number {
      return currentIndex;
    },

    destroy(): void {
      if (destroyed) {
        return;
      }

      destroyed = true;

      if (controlsTimer !== undefined) {
        clearTimeout(controlsTimer);

        controlsTimer = undefined;
      }

      previousButton.removeEventListener(
        "click",
        handlePrevious,
      );

      nextButton.removeEventListener(
        "click",
        handleNext,
      );

      fullscreenButton.removeEventListener(
        "click",
        handleFullscreen,
      );

      window.removeEventListener(
        "keydown",
        handleKeyboard,
      );

      window.removeEventListener(
        "resize",
        updateStageSize,
      );

      stage.removeEventListener(
        "pointermove",
        showControls,
      );

      stage.removeEventListener(
        "pointerdown",
        showControls,
      );

      root.replaceChildren();
    },
  };
}