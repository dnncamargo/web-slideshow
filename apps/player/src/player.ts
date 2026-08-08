import type { Presentation } from "@powershow/document-schema";

import { renderSlide } from "@powershow/renderer";

function queryRequired<T extends Element>(
  root: ParentNode,
  selector: string,
): T {
  const element = root.querySelector<T>(selector);

  if (!element) {
    throw new Error(`PowerShow Player element not found: ${selector}`);
  }

  return element;
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
): PlayerController {
  let currentIndex = 0;

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
  const stage = queryRequired<HTMLElement>(root, ".powershow-player-stage");

  const slideHost = queryRequired<HTMLElement>(
    root,
    ".powershow-player-slide-host",
  );

  const counter = queryRequired<HTMLOutputElement>(
    root,
    ".powershow-player-counter",
  );

  const previousButton = queryRequired<HTMLButtonElement>(
    root,
    '[data-player-action="previous"]',
  );

  const nextButton = queryRequired<HTMLButtonElement>(
    root,
    '[data-player-action="next"]',
  );

  const fullscreenButton = queryRequired<HTMLButtonElement>(
    root,
    '[data-player-action="fullscreen"]',
  );

  if (
    !stage ||
    !slideHost ||
    !counter ||
    !previousButton ||
    !nextButton ||
    !fullscreenButton
  ) {
    throw new Error("PowerShow Player failed to initialize.");
  }

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

    stage.style.width = `${ratio.width * scale}px`;

    stage.style.height = `${ratio.height * scale}px`;
  }

  function renderCurrentSlide(): void {
    const slide = presentation.slides[currentIndex];

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

    slideHost.innerHTML = renderSlide(slide);

    counter.value = `${currentIndex + 1} / ${presentation.slides.length}`;

    previousButton.disabled = currentIndex === 0;

    nextButton.disabled = currentIndex === presentation.slides.length - 1;
  }

  function goTo(index: number): void {
    if (index < 0 || index >= presentation.slides.length) {
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

  function handleKeyboard(event: KeyboardEvent): void {
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
        goTo(presentation.slides.length - 1);
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

  previousButton.addEventListener("click", handlePrevious);

  nextButton.addEventListener("click", handleNext);

  fullscreenButton.addEventListener("click", handleFullscreen);

  window.addEventListener("keydown", handleKeyboard);

  window.addEventListener("resize", updateStageSize);

  updateStageSize();
  renderCurrentSlide();

  return {
    next,
    previous,
    goTo,
    fullscreen,

    getCurrentIndex(): number {
      return currentIndex;
    },

    destroy(): void {
      previousButton.removeEventListener("click", handlePrevious);

      nextButton.removeEventListener("click", handleNext);

      fullscreenButton.removeEventListener("click", handleFullscreen);

      window.removeEventListener("keydown", handleKeyboard);

      window.removeEventListener("resize", updateStageSize);

      root.replaceChildren();
    },
  };
}
