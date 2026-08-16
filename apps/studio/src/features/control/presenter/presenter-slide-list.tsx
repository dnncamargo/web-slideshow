"use client";

import type { Presentation } from "@powershow/document-schema";

import styles from "./presenter-view.module.css";

export interface PresenterSlideListProps {
  presentation: Presentation;
  confirmedIndex: number | null;
}

function slideLabel(slide: Presentation["slides"][number], index: number): string {
  return slide.title.trim().length > 0 ? slide.title : `Slide ${index + 1}`;
}

/**
 * Read-only ordered slide summary for the confirmed current slide.
 *
 * Highlights the ACK-confirmed slide (presentation.slides[confirmedIndex]) and
 * does nothing else: it does not navigate on click, send Live commands, own
 * Live state, or render slide previews.
 */
export function PresenterSlideList({
  presentation,
  confirmedIndex,
}: PresenterSlideListProps) {
  return (
    <ol className={styles.slideList}>
      {presentation.slides.map((slide, index) => {
        const isCurrent = confirmedIndex === index;

        return (
          <li
            key={slide.id}
            aria-current={isCurrent ? "step" : undefined}
            className={`${styles.slideListItem}${isCurrent ? ` ${styles.slideListItemCurrent}` : ""}`}
          >
            {slideLabel(slide, index)}
          </li>
        );
      })}
    </ol>
  );
}
