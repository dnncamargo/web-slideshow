import type { Presentation } from "@powershow/document-schema";

import {
  fitLogicalSlideGeometry,
  hydrateRendererRuntime,
  paletteColorCssVariableName,
  renderFontResources,
  renderSlide,
} from "@powershow/renderer";

export type PlayerTransition = "none" | "fade";

export interface ProjectionSurfaceOptions {
  transition?: PlayerTransition;
}

export interface ProjectionSurface {
  stage: HTMLElement;
  goTo(index: number): void;
  getCurrentIndex(): number;
  destroy(): void;
}

function queryRequired<T extends Element>(
  root: ParentNode,
  selector: string,
): T {
  const element = root.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Required projection element not found: ${selector}`);
  }

  return element;
}

export function mountProjectionSurface(
  root: HTMLElement,
  presentation: Presentation,
  options: ProjectionSurfaceOptions = {},
): ProjectionSurface {
  const transition = options.transition ?? "fade";
  let currentIndex = 0;
  let destroyed = false;

  root.innerHTML = `
    <div class="powershow-player">
      <div class="powershow-player-stage">
        <div class="powershow-player-slide-host">
          <div class="powershow-player-slide-surface"></div>
        </div>
      </div>
    </div>
  `;

  const player = queryRequired<HTMLElement>(root, ".powershow-player");
  const stage = queryRequired<HTMLElement>(root, ".powershow-player-stage");
  const slideHost = queryRequired<HTMLElement>(
    root,
    ".powershow-player-slide-host",
  );
  const slideSurface = queryRequired<HTMLElement>(
    root,
    ".powershow-player-slide-surface",
  );

  const fontResourceCss = renderFontResources(presentation.resources?.fonts);

  if (fontResourceCss) {
    const fontResourceStyle = document.createElement("style");

    fontResourceStyle.setAttribute("data-powershow-font-resources", "");
    fontResourceStyle.textContent = fontResourceCss;
    player.prepend(fontResourceStyle);
  }

  for (const color of presentation.palette?.colors ?? []) {
    slideSurface.style.setProperty(
      paletteColorCssVariableName(color.id),
      color.value,
    );
  }

  function updateStageSize(): void {
    const geometry = fitLogicalSlideGeometry(
      presentation.aspectRatio,
      window.innerWidth,
      window.innerHeight,
    );

    stage.style.width = `${geometry.physicalWidth}px`;
    stage.style.height = `${geometry.physicalHeight}px`;
    slideSurface.style.width = `${geometry.logicalWidth}px`;
    slideSurface.style.height = `${geometry.logicalHeight}px`;
    slideSurface.style.transform = `scale(${geometry.scale})`;

    hydrateRendererRuntime(slideHost);
  }

  function animateSlide(): void {
    if (transition !== "fade" || typeof slideHost.animate !== "function") {
      return;
    }

    slideHost.animate(
      [
        { opacity: 0, transform: "scale(0.995)" },
        { opacity: 1, transform: "scale(1)" },
      ],
      { duration: 180, easing: "ease-out" },
    );
  }

  function renderCurrentSlide(): void {
    const slide = presentation.slides[currentIndex];

    if (!slide) {
      slideSurface.innerHTML = `
        <div class="powershow-player-empty">No slides</div>
      `;
      return;
    }

    slideSurface.innerHTML = renderSlide(slide, { presentation });
    hydrateRendererRuntime(slideSurface);
    animateSlide();
  }

  function goTo(index: number): void {
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= presentation.slides.length
    ) {
      return;
    }

    if (index === currentIndex) {
      return;
    }

    currentIndex = index;
    renderCurrentSlide();
  }

  function handleResize(): void {
    updateStageSize();
  }

  window.addEventListener("resize", handleResize);

  updateStageSize();
  renderCurrentSlide();

  return {
    stage,
    goTo,
    getCurrentIndex(): number {
      return currentIndex;
    },
    destroy(): void {
      if (destroyed) {
        return;
      }

      destroyed = true;
      window.removeEventListener("resize", handleResize);
      root.innerHTML = "";
    },
  };
}
