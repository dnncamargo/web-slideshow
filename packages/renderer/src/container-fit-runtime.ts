import { resolveContainerFitGeometry } from "./container-fit";

type FitViewport = HTMLElement & {
  __powershowContainerFitObserver?: ResizeObserver;
};

const observedViewports = new Set<FitViewport>();

function getDimension(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) ? value : 0;
}

function hydrateViewport(viewport: FitViewport): void {
  const surface = viewport.querySelector<HTMLElement>(
    ".powershow-container-fit-surface",
  );
  if (!surface) return;

  const mode = viewport.dataset.powershowContainerFitMode;
  if (mode !== "contain" && mode !== "cover" && mode !== "fill") return;

  const sourceWidth = Number(viewport.dataset.powershowContainerFitSourceWidth);
  const sourceHeight = Number(viewport.dataset.powershowContainerFitSourceHeight);
  const targetWidth = getDimension(viewport.clientWidth);
  const targetHeight = getDimension(viewport.clientHeight);
  const geometry = resolveContainerFitGeometry({
    mode,
    sourceWidth,
    sourceHeight,
    targetWidth,
    targetHeight,
  });

  if (!geometry) {
    surface.style.transform = "";
    return;
  }

  surface.style.transform = `translate(${geometry.offsetX}px,${geometry.offsetY}px) scale(${geometry.scaleX},${geometry.scaleY})`;
}

export function hydrateContainerFits(root: ParentNode): void {
  for (const viewport of observedViewports) {
    if (typeof viewport.isConnected === "boolean" && !viewport.isConnected) {
      viewport.__powershowContainerFitObserver?.disconnect();
      observedViewports.delete(viewport);
    }
  }

  const viewports: FitViewport[] = [];
  const rootElement = root as ParentNode & {
    matches?: (selector: string) => boolean;
  };
  if (rootElement.matches?.("[data-powershow-container-fit]")) {
    viewports.push(rootElement as FitViewport);
  }
  viewports.push(
    ...Array.from(root.querySelectorAll<HTMLElement>("[data-powershow-container-fit]")) as FitViewport[],
  );

  for (const viewport of viewports) {
    hydrateViewport(viewport);

    if (typeof ResizeObserver === "undefined" || viewport.__powershowContainerFitObserver) {
      continue;
    }

    const observer = new ResizeObserver(() => hydrateViewport(viewport));
    observer.observe(viewport);
    viewport.__powershowContainerFitObserver = observer;
    observedViewports.add(viewport);
  }
}
