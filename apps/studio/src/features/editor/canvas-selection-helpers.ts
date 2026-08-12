export interface CanvasSelectionTarget {
  id: string;
  type: string;
}

export function resolveCanvasClickSelection(
  element: Element | null,
): CanvasSelectionTarget | null {
  if (!element) {
    return null;
  }

  const target = element.closest<HTMLElement>("[data-powershow-id]");

  if (!target) {
    return null;
  }

  const id = target.dataset.powershowId;
  const type = target.dataset.powershowType;

  if (!id || !type) {
    return null;
  }

  return { id, type };
}