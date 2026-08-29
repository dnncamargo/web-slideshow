"use client";

import type { Presentation } from "@powershow/document-schema";

import { HoverScrollText } from "@powershow/ui";

import styles from "./presenter-view.module.css";

export interface PresenterSlideListProps {
  presentation: Presentation;
  desiredPageIndex: number | null;
  navigationDisabled: boolean;
  onNavigate(index: number): void;
}

function slideLabel(slide: Presentation["slides"][number], index: number): string {
  return slide.title.trim().length > 0 ? slide.title : `Slide ${index + 1}`;
}

/**
 * Ordered slide summary for the Control's desired current slide.
 *
 * Highlights the desired slide (presentation.slides[desiredPageIndex]) and
 * delegates navigation to its owning Presenter. It does not own Live state,
 * send Live commands, or render slide previews.
 */
export function PresenterSlideList({
  presentation,
  desiredPageIndex,
  navigationDisabled,
  onNavigate,
}: PresenterSlideListProps) {
  return (
    <ol className={styles.slideList}>
      {presentation.slides.map((slide, index) => {
        const isCurrent = desiredPageIndex === index;

        return (
          <li
            key={slide.id}
            className={`${styles.slideListItem}${isCurrent ? ` ${styles.slideListItemCurrent}` : ""}`}
          >
            <button
              type="button"
              className={styles.slideListButton}
              disabled={navigationDisabled}
              onClick={() => onNavigate(index)}
              aria-current={isCurrent ? "step" : undefined}
            >
              <span className={styles.slideNumber}>{index + 1}</span>
              <HoverScrollText
                className={styles.slideTitle}
                text={slideLabel(slide, index)}
              />
            </button>
          </li>
        );
      })}
    </ol>
  );
}
