import { createContext, useContext, type ReactNode } from "react";

import type { Color } from "@powershow/document-schema";

export interface PickedColorsControls {
  colors: readonly Color[];
  onPickColor: (color: Color) => void;
  onRemoveColor: (color: Color) => void;
}

const PickedColorsContext = createContext<PickedColorsControls | undefined>(undefined);

export function PickedColorsProvider({
  colors,
  onPickColor,
  onRemoveColor,
  children,
}: PickedColorsControls & { children: ReactNode }) {
  return (
    <PickedColorsContext.Provider value={{ colors, onPickColor, onRemoveColor }}>
      {children}
    </PickedColorsContext.Provider>
  );
}

export function usePickedColors(): PickedColorsControls | undefined {
  return useContext(PickedColorsContext);
}
