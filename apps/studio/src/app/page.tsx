import { resolvePublicPlayerUrl } from "@/features/public-player/public-player-url";

import styles from "./page.module.css";

export default function Home() {
  const player = resolvePublicPlayerUrl();
  const demoUrl = player.baseUrl === null ? null : `${player.baseUrl}/demo`;

  return (
    <div className={styles.landing}>
      <main className={styles.main}>
        <h1 className={styles.brand}>PowerShow</h1>

        <div className={styles.content}>
          <div className={styles.presentation}>
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

          <div className={styles.actions}>
            <a className={styles.primary} href="/studio">
              Studio
            </a>

            {player.available && player.baseUrl !== null ? (
              <a className={styles.primary} href={player.baseUrl}>
                Player
              </a>
            ) : (
              <span className={styles.primary} aria-disabled="true">
                Player
              </span>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
