import type { ElementPropertySelectionMap } from "../custom-library/custom-library-recipe";

export type ElementPropertySelectionState = Readonly<
  Record<string, Readonly<Record<string, boolean>>>
>;

export function toElementPropertySelectionMap(
  state: ElementPropertySelectionState,
): ElementPropertySelectionMap {
  return new Map(
    Object.entries(state).map(([elementId, paths]) => [
      elementId,
      new Set(
        Object.entries(paths)
          .filter(([, selected]) => selected)
          .map(([path]) => path),
      ),
    ]),
  );
}
