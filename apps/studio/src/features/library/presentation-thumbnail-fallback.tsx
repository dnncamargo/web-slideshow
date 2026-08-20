"use client";

import styles from "./presentation-library.module.css";

export function PresentationThumbnailFallback() {
  return (
    <div className={styles.thumbnail} aria-hidden="true">
      <span className={styles.thumbnailBar} />
      <span className={styles.thumbnailTitle} />
      <span className={styles.thumbnailLine} />
      <span className={styles.thumbnailLineShort} />
    </div>
  );
}
