import { demoPresentation } from "./demo-presentation";
import {
  mountProjectionSurface,
  type ProjectionSurface,
} from "./projection-surface";

const DEMO_SLIDE_INTERVAL_MS = 10_000;

export interface DemoController {
  destroy(): void;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/** Boots the self-contained public demo without connecting to live services. */
export function startDemo(root: HTMLElement): DemoController {
  const projection: ProjectionSurface = mountProjectionSurface(root, demoPresentation, {
    transition: "fade",
  });
  let timer: ReturnType<typeof setInterval> | undefined;
  let destroyed = false;

  function stopAutoplay(): void {
    if (timer !== undefined) {
      clearInterval(timer);
      timer = undefined;
    }
  }

  function startAutoplay(): void {
    if (destroyed || document.hidden || prefersReducedMotion() || timer !== undefined) {
      return;
    }

    timer = setInterval(() => {
      const slideCount = demoPresentation.slides.length;
      if (slideCount > 0) {
        projection.goTo((projection.getCurrentIndex() + 1) % slideCount);
      }
    }, DEMO_SLIDE_INTERVAL_MS);
  }

  function handleVisibilityChange(): void {
    if (document.hidden) {
      stopAutoplay();
    } else {
      startAutoplay();
    }
  }

  let controller: DemoController;
  const handlePagehide = (): void => controller.destroy();

  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("pagehide", handlePagehide, { once: true });
  startAutoplay();

  controller = {
    destroy(): void {
      if (destroyed) return;

      destroyed = true;
      stopAutoplay();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePagehide);
      projection.destroy();
    },
  };

  return controller;
}
