import type { Presentation } from "@powershow/document-schema";
import type { ScriptedReportMessage } from "@powershow/renderer";

import {
  fitLogicalSlideGeometry,
  hydrateRendererRuntime,
  paletteColorCssVariableName,
  renderFontResources,
  renderSlide,
} from "@powershow/renderer";

import {
  postScriptedAction,
  postScriptedInput,
  validateScriptedReport,
} from "./scripted-port-host";

export type PlayerTransition = "none" | "fade";

export interface ProjectionSurfaceOptions {
  transition?: PlayerTransition;
  onScriptedReport?: (report: ScriptedReportMessage) => void;
  onScriptedMount?: (mount: { pageId: string; elementId: string }) => void;
}

export interface ProjectionSurface {
  stage: HTMLElement;
  goTo(index: number): void;
  setGalleryActiveIndex(galleryId: string, targetIndex: number): void;
  setGalleryExpanded(galleryId: string, expanded: boolean): void;
  sendScriptedAction(elementId: string, portId: string): void;
  sendScriptedInput(
    elementId: string,
    portId: string,
    value: boolean | number,
  ): void;
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
  let expandedGalleryId: string | null = null;
  let expandedOverlay: HTMLElement | null = null;
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
    if (expandedOverlay) {
      hydrateRendererRuntime(expandedOverlay);
    }
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
    clearExpandedGallery();
    const slide = presentation.slides[currentIndex];

    if (!slide) {
      slideSurface.innerHTML = `
        <div class="powershow-player-empty">No slides</div>
      `;
      return;
    }

    slideSurface.innerHTML = renderSlide(slide, { presentation });
    hydrateRendererRuntime(slideSurface);
    for (const frame of slideSurface.querySelectorAll<HTMLIFrameElement>(
      'iframe[data-powershow-type="scripted"][data-powershow-id]',
    )) {
      const elementId = frame.dataset.powershowId;
      if (elementId !== undefined) options.onScriptedMount?.({ pageId: slide.id, elementId });
    }
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

  function handleScriptedMessage(event: MessageEvent<unknown>): void {
    const report = validateScriptedReport(
      event,
      presentation.slides[currentIndex],
      slideSurface,
    );

    if (report) {
      options.onScriptedReport?.(report);
    }
  }

  function galleryItems(galleryRoot: HTMLElement): HTMLElement[] {
    return Array.from(galleryRoot.children).filter(
      (child): child is HTMLElement =>
        child instanceof HTMLElement &&
        child.classList.contains("powershow-gallery-item"),
    );
  }

  function findGalleryById(galleryId: string): HTMLElement | null {
    for (const candidate of slideSurface.querySelectorAll<HTMLElement>(
      "[data-powershow-id][data-powershow-type]",
    )) {
      if (
        candidate.dataset.powershowType === "gallery" &&
        candidate.dataset.powershowId === galleryId
      ) {
        return candidate;
      }
    }

    return null;
  }

  function activeGalleryItem(galleryRoot: HTMLElement): HTMLElement | null {
    return galleryItems(galleryRoot).find((item) =>
      item.classList.contains("powershow-gallery-item-active"),
    ) ?? null;
  }

  function clearExpandedGallery(): void {
    if (expandedOverlay) {
      expandedOverlay.removeEventListener("click", handleExpandedGalleryClick);
      expandedOverlay.remove();
    }

    expandedOverlay = null;
    expandedGalleryId = null;
  }

  function refreshExpandedGallery(): void {
    if (!expandedGalleryId) {
      return;
    }

    const galleryRoot = findGalleryById(expandedGalleryId);
    const activeItem = galleryRoot && activeGalleryItem(galleryRoot);

    if (!activeItem) {
      clearExpandedGallery();
      return;
    }

    if (!expandedOverlay) {
      expandedOverlay = document.createElement("div");
      expandedOverlay.className = "powershow-player-gallery-expanded";
      expandedOverlay.dataset.powershowGalleryExpanded = expandedGalleryId;
      expandedOverlay.addEventListener("click", handleExpandedGalleryClick);
      stage.append(expandedOverlay);
    }

    const frame = document.createElement("div");
    frame.className = "powershow-player-gallery-expanded-media";
    const clone = activeItem.cloneNode(true) as HTMLElement;

    clone.style.position = "absolute";
    clone.style.inset = "0";
    clone.style.width = "100%";
    clone.style.height = "100%";
    clone.style.overflow = "hidden";
    clone.style.visibility = "visible";
    clone.style.pointerEvents = "auto";
    clone.removeAttribute("aria-hidden");

    if (clone.dataset.powershowImageCrop !== undefined) {
      clone.dataset.powershowImageWidthAuthored = "true";
      clone.dataset.powershowImageHeightAuthored = "true";
    } else {
      const image = clone.querySelector<HTMLImageElement>("img.powershow-gallery-image");
      if (image) {
        image.style.width = "100%";
        image.style.height = "100%";
        image.style.display = "block";
      }
    }

    frame.append(clone);
    expandedOverlay.replaceChildren(frame);
    hydrateRendererRuntime(expandedOverlay);
  }

  function setGalleryActiveIndex(
    galleryRoot: HTMLElement,
    targetIndex: number,
  ): void {
    const items = galleryItems(galleryRoot);

    if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= items.length) {
      return;
    }

    for (const [index, item] of items.entries()) {
      const isActive = index === targetIndex;

      item.classList.toggle("powershow-gallery-item-active", isActive);
      item.style.visibility = isActive ? "" : "hidden";
      item.style.pointerEvents = isActive ? "" : "none";

      if (isActive) {
        item.removeAttribute("aria-hidden");
      } else {
        item.setAttribute("aria-hidden", "true");
      }
    }

    if (galleryRoot.dataset.powershowId === expandedGalleryId) {
      refreshExpandedGallery();
    }
  }

  function advanceGallery(galleryRoot: HTMLElement): void {
    const items = galleryItems(galleryRoot);
    const activeIndex = items.findIndex((item) =>
      item.classList.contains("powershow-gallery-item-active"),
    );

    if (items.length < 2 || activeIndex < 0) {
      return;
    }

    setGalleryActiveIndex(galleryRoot, (activeIndex + 1) % items.length);
  }

  function handleGalleryClick(event: MouseEvent): void {
    if (!(event.target instanceof Element)) {
      return;
    }

    const galleryRoot = event.target.closest<HTMLElement>(".powershow-gallery");

    if (!galleryRoot || !slideSurface.contains(galleryRoot)) {
      return;
    }

    advanceGallery(galleryRoot);
  }

  function handleExpandedGalleryClick(event: MouseEvent): void {
    if (!(event.target instanceof Node)) {
      return;
    }

    const frame = expandedOverlay?.querySelector<HTMLElement>(
      ".powershow-player-gallery-expanded-media",
    );

    if (!frame || !frame.contains(event.target) || !expandedGalleryId) {
      return;
    }

    const galleryRoot = findGalleryById(expandedGalleryId);
    if (galleryRoot) {
      advanceGallery(galleryRoot);
    }
  }

  function setGalleryExpanded(galleryId: string, expanded: boolean): void {
    if (!expanded) {
      if (expandedGalleryId === galleryId) {
        clearExpandedGallery();
      }
      return;
    }

    const galleryRoot = findGalleryById(galleryId);
    if (!galleryRoot || !activeGalleryItem(galleryRoot)) {
      return;
    }

    if (expandedGalleryId !== galleryId) {
      clearExpandedGallery();
      expandedGalleryId = galleryId;
    }

    refreshExpandedGallery();
  }

  window.addEventListener("resize", handleResize);
  window.addEventListener("message", handleScriptedMessage);
  slideSurface.addEventListener("click", handleGalleryClick);

  updateStageSize();
  renderCurrentSlide();

  return {
    stage,
    goTo,
    setGalleryActiveIndex(galleryId: string, targetIndex: number): void {
      const galleryRoot = findGalleryById(galleryId);
      if (galleryRoot) {
        setGalleryActiveIndex(galleryRoot, targetIndex);
      }
    },
    setGalleryExpanded,
    sendScriptedAction(elementId: string, portId: string): void {
      postScriptedAction(
        presentation.slides[currentIndex],
        slideSurface,
        elementId,
        portId,
      );
    },
    sendScriptedInput(
      elementId: string,
      portId: string,
      value: boolean | number,
    ): void {
      postScriptedInput(
        presentation.slides[currentIndex],
        slideSurface,
        elementId,
        portId,
        value,
      );
    },
    getCurrentIndex(): number {
      return currentIndex;
    },
    destroy(): void {
      if (destroyed) {
        return;
      }

      destroyed = true;
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("message", handleScriptedMessage);
      slideSurface.removeEventListener("click", handleGalleryClick);
      clearExpandedGallery();
      root.innerHTML = "";
    },
  };
}
