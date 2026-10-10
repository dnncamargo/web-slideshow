import { demoPresentation } from "./demo-presentation";
import {
  mountProjectionSurface,
  type ProjectionSurface,
} from "./projection-surface";

const DEMO_SLIDE_INTERVAL_MS = 10_000;
const DEMO_TOUCH_RESUME_MS = 12_000;

export interface DemoController {
  destroy(): void;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function isInteractiveSurface(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(
    '[data-presentation-type="scripted"], [data-presentation-type="gallery"]',
  ) !== null;
}

/** Boots the self-contained public demo without connecting to live services. */
export function startDemo(root: HTMLElement): DemoController {
  const projection: ProjectionSurface = mountProjectionSurface(root, demoPresentation, {
    transition: "fade",
  });
  let timer: ReturnType<typeof setInterval> | undefined;
  let touchResumeTimer: ReturnType<typeof setTimeout> | undefined;
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

  function cancelTouchResume(): void {
    if (touchResumeTimer !== undefined) {
      clearTimeout(touchResumeTimer);
      touchResumeTimer = undefined;
    }
  }

  function scheduleTouchResume(): void {
    cancelTouchResume();
    touchResumeTimer = setTimeout(() => {
      touchResumeTimer = undefined;
      startAutoplay();
    }, DEMO_TOUCH_RESUME_MS);
  }

  function handlePointerOver(event: PointerEvent): void {
    if (isInteractiveSurface(event.target)) {
      cancelTouchResume();
      stopAutoplay();
    }
  }

  function handlePointerOut(event: PointerEvent): void {
    if (event.pointerType !== "touch" && isInteractiveSurface(event.target) && !isInteractiveSurface(event.relatedTarget)) {
      startAutoplay();
    }
  }

  function handlePointerDown(event: PointerEvent): void {
    if (event.pointerType !== "touch" || !isInteractiveSurface(event.target)) {
      return;
    }

    stopAutoplay();
    scheduleTouchResume();
  }

  function handlePointerUp(event: PointerEvent): void {
    if (event.pointerType !== "touch" || !isInteractiveSurface(event.target)) {
      return;
    }

    cancelTouchResume();
    startAutoplay();
  }

  function handleFocusIn(event: FocusEvent): void {
    if (isInteractiveSurface(event.target)) stopAutoplay();
  }

  function handleFocusOut(event: FocusEvent): void {
    if (isInteractiveSurface(event.target) && !isInteractiveSurface(event.relatedTarget)) {
      startAutoplay();
    }
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
  root.addEventListener("pointerover", handlePointerOver);
  root.addEventListener("pointerout", handlePointerOut);
  root.addEventListener("pointerdown", handlePointerDown);
  root.addEventListener("pointerup", handlePointerUp);
  root.addEventListener("pointercancel", handlePointerUp);
  root.addEventListener("focusin", handleFocusIn);
  root.addEventListener("focusout", handleFocusOut);
  window.addEventListener("pagehide", handlePagehide, { once: true });
  startAutoplay();

  controller = {
    destroy(): void {
      if (destroyed) return;

      destroyed = true;
      stopAutoplay();
      cancelTouchResume();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      root.removeEventListener("pointerover", handlePointerOver);
      root.removeEventListener("pointerout", handlePointerOut);
      root.removeEventListener("pointerdown", handlePointerDown);
      root.removeEventListener("pointerup", handlePointerUp);
      root.removeEventListener("pointercancel", handlePointerUp);
      root.removeEventListener("focusin", handleFocusIn);
      root.removeEventListener("focusout", handleFocusOut);
      window.removeEventListener("pagehide", handlePagehide);
      projection.destroy();
    },
  };

  return controller;
}
