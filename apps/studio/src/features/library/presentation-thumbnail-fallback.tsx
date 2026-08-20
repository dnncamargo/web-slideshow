"use client";

import styles from "./presentation-library.module.css";

interface PresentationThumbnailFallbackProps {
  label: string;
}

export function PresentationThumbnailFallback({
  label,
}: PresentationThumbnailFallbackProps) {
  return (
    <div className={styles.thumbnail} aria-label={label} role="img">
      <span className={styles.thumbnailBar} />
      <span className={styles.thumbnailTitle}>{label}</span>
      <span className={styles.thumbnailLine} />
      <span className={styles.thumbnailLineShort} />
    </div>
  );
}
