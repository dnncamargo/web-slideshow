import type { Color } from "@powershow/document-schema";
import {
  createContext,
  useContext,
  type ReactNode,
} from "react";

interface RecentColorsControls {
  colors: readonly Color[];
  onAddColor: (color: Color) => void;
  onClearColors: () => void;
  onMoveColor: (index: number, direction: -1 | 1) => void;
}

const RecentColorsContext =
  createContext<RecentColorsControls | undefined>(undefined);

interface RecentColorsProviderProps
  extends RecentColorsControls {
  children: ReactNode;
}

export function RecentColorsProvider({
  colors,
  onAddColor,
  onClearColors,
  onMoveColor,
  children,
}: RecentColorsProviderProps) {
  return (
    <RecentColorsContext.Provider
      value={{ colors, onAddColor, onClearColors, onMoveColor }}
    >
      {children}
    </RecentColorsContext.Provider>
  );
}

export function useRecentColors():
  | RecentColorsControls
  | undefined {
  return useContext(RecentColorsContext);
}