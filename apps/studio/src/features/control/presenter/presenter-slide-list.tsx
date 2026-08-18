"use client";

import type { Presentation } from "@powershow/document-schema";

import styles from "./presenter-view.module.css";

export interface PresenterSlideListProps {
  presentation: Presentation;
  desiredPageIndex: number | null;
}

function slideLabel(slide: Presentation["slides"][number], index: number): string {
  return slide.title.trim().length > 0 ? slide.title : `Slide ${index + 1}`;
}

/**
 * Read-only ordered slide summary for the Control's desired current slide.
 *
 * Highlights the desired slide (presentation.slides[desiredPageIndex]) and
 * does nothing else: it does not navigate on click, send Live commands, own
 * Live state, or render slide previews.
 */
export function PresenterSlideList({
  presentation,
  desiredPageIndex,
}: PresenterSlideListProps) {
  return (
    <ol className={styles.slideList}>
      {presentation.slides.map((slide, index) => {
        const isCurrent = desiredPageIndex === index;

        return (
          <li
            key={slide.id}
            aria-current={isCurrent ? "step" : undefined}
            className={`${styles.slideListItem}${isCurrent ? ` ${styles.slideListItemCurrent}` : ""}`}
          >
            <span className={styles.slideNumber}>{index + 1}</span>
            <span className={styles.slideTitle}>{slideLabel(slide, index)}</span>
          </li>
        );
      })}
    </ol>
  );
}
