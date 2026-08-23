import type {
  ElementStyle,
} from "@powershow/document-schema";

import type { UpdateElementStyle } from "../inspector-types";

import { ElementGradientControl } from "./element-gradient-control";

interface ElementBackgroundGradientControlProps {
  style: ElementStyle | undefined;

  onUpdateStyle: UpdateElementStyle;

  controlPrefix: string;
}

// ============================================================
// BEGIN: ELEMENT BACKGROUND GRADIENT CONTROL
// ============================================================

export function ElementBackgroundGradientControl({
  style,
  onUpdateStyle,
  controlPrefix,
}: ElementBackgroundGradientControlProps) {
  return (
    <ElementGradientControl
      gradient={style?.backgroundGradient}
      controlPrefix={controlPrefix}
      onChange={(gradient) => {
        onUpdateStyle((currentStyle) => ({
          ...currentStyle,

          backgroundGradient: gradient,

          ...(gradient === undefined
            ? {}
            : { backgroundPattern: undefined }),
        }));
      }}
    />
  );
}

// ============================================================
// END: ELEMENT BACKGROUND GRADIENT CONTROL
// ============================================================
