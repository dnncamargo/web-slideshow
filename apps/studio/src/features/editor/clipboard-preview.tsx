"use client";

import { useMemo } from "react";

import { renderElement, resolveLogicalSlideSize } from "@web-slideshow/renderer";
import type { PresentationElement, Presentation } from "@web-slideshow/document-schema";

import styles from "./editor-workspace.module.css";

function makeInertMarkup(markup: string): string {
  return markup.replace(/(<iframe\b[^>]*?)\s(?:src|srcdoc)="[^"]*"/gi, "$1");
}

export function ClipboardPreview({
  element,
  presentation,
}: {
  element: PresentationElement;
  presentation: Presentation;
}) {
  const markup = useMemo(
    () => makeInertMarkup(renderElement(element, { presentation })),
    [element, presentation],
  );
  const logicalSize = resolveLogicalSlideSize(presentation.aspectRatio);
  const scale = Math.min(176 / logicalSize.logicalWidth, 96 / logicalSize.logicalHeight);

  return (
    <div
      className={styles.clipboardPreview}
      aria-hidden="true"
      inert
      style={{ pointerEvents: "none", userSelect: "none" }}
    >
      <div
        className={styles.clipboardPreviewStage}
        style={{
          width: logicalSize.logicalWidth,
          height: logicalSize.logicalHeight,
          transform: `scale(${scale})`,
        }}
        dangerouslySetInnerHTML={{ __html: markup }}
      />
    </div>
  );
}
