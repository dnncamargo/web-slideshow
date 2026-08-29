import { resolvePublicPlayerUrl } from "@/features/public-player/public-player-url";

import styles from "./page.module.css";

export default function Home() {
  const player = resolvePublicPlayerUrl();
  const demoUrl = player.baseUrl === null ? null : `${player.baseUrl}/demo`;

  return (
    <div className={styles.landing}>
      <div className={styles.background}>
        {demoUrl === null ? (
          <span className={styles.unavailable}>Player unavailable</span>
        ) : (
          <iframe
            className={styles.demo}
            src={demoUrl}
            title="PowerShow demo presentation"
            tabIndex={-1}
          />
        )}
      </div>
      <div className={styles.overlay} aria-hidden="true" />

      <main className={styles.main}>
        <h1 className={styles.brand}>PowerShow</h1>

        <div className={styles.actions}>
          <a className={`${styles.action} ${styles.studioAction}`} href="/studio">
            <span>Studio</span>
          </a>

          {player.available && player.baseUrl !== null ? (
            <a className={`${styles.action} ${styles.playerAction}`} href={player.baseUrl}>
              <span>Player</span>
            </a>
          ) : (
            <span className={`${styles.action} ${styles.playerAction}`} aria-disabled="true">
              <span>Player</span>
            </span>
          )}
        </div>
      </main>
    </div>
  );
}
