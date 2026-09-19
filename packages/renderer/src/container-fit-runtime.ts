import { resolveContainerFitGeometry } from "./container-fit";

type FitViewport = HTMLElement & {
  __containerFitObserver?: ResizeObserver;
};

const observedViewports = new Set<FitViewport>();

function getDimension(value: number | undefined): number {
  return value !== undefined && Number.isFinite(value) ? value : 0;
}

function hydrateViewport(viewport: FitViewport): void {
  const surface = viewport.querySelector<HTMLElement>(
    ".presentation-container-fit-surface",
  );
  if (!surface) return;

  const mode = viewport.dataset.presentationContainerFitMode;
  if (mode !== "contain" && mode !== "cover" && mode !== "fill") return;

  const sourceWidth = Number(viewport.dataset.presentationContainerFitSourceWidth);
  const sourceHeight = Number(viewport.dataset.presentationContainerFitSourceHeight);
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
      viewport.__containerFitObserver?.disconnect();
      observedViewports.delete(viewport);
    }
  }

  const viewports: FitViewport[] = [];
  const rootElement = root as ParentNode & {
    matches?: (selector: string) => boolean;
  };
  if (rootElement.matches?.("[data-presentation-container-fit]")) {
    viewports.push(rootElement as FitViewport);
  }
  viewports.push(
    ...Array.from(root.querySelectorAll<HTMLElement>("[data-presentation-container-fit]")) as FitViewport[],
  );

  for (const viewport of viewports) {
    hydrateViewport(viewport);

    if (typeof ResizeObserver === "undefined" || viewport.__containerFitObserver) {
      continue;
    }

    const observer = new ResizeObserver(() => hydrateViewport(viewport));
    observer.observe(viewport);
    viewport.__containerFitObserver = observer;
    observedViewports.add(viewport);
  }
}
