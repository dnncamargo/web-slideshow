import type { PresentationPaletteColor } from "@powershow/document-schema";
import {
  createContext,
  useContext,
  type ReactNode,
} from "react";

interface PresentationColorPaletteControls {
  colors: readonly PresentationPaletteColor[];
}

const PresentationColorPaletteContext =
  createContext<PresentationColorPaletteControls | undefined>(undefined);

interface PresentationColorPaletteProviderProps
  extends PresentationColorPaletteControls {
  children: ReactNode;
}

export function PresentationColorPaletteProvider({
  colors,
  children,
}: PresentationColorPaletteProviderProps) {
  return (
    <PresentationColorPaletteContext.Provider
      value={{ colors }}
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
