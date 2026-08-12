import type { Color } from "@powershow/document-schema";
import {
  createContext,
  useContext,
  type ReactNode,
} from "react";

interface PresentationColorPaletteControls {
  colors: readonly Color[];
  onAddColor: (color: Color) => void;
  onRemoveColor: (index: number) => void;
}

const PresentationColorPaletteContext =
  createContext<PresentationColorPaletteControls | undefined>(undefined);

interface PresentationColorPaletteProviderProps
  extends PresentationColorPaletteControls {
  children: ReactNode;
}

export function PresentationColorPaletteProvider({
  colors,
  onAddColor,
  onRemoveColor,
  children,
}: PresentationColorPaletteProviderProps) {
  return (
    <PresentationColorPaletteContext.Provider
      value={{ colors, onAddColor, onRemoveColor }}
    >
      {children}
    </PresentationColorPaletteContext.Provider>
  );
}

export function usePresentationColorPalette():
  | PresentationColorPaletteControls
  | undefined {
  return useContext(PresentationColorPaletteContext);
}
