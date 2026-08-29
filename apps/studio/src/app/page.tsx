"use client";

import { useRouter } from "next/navigation";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "./page.module.css";

export default function Home() {
  const { t } = useStudioI18n();
  const router = useRouter();

  return (
    <div className={styles.landing}>
      <main className={styles.main}>
        <div className={styles.brand}>
          <h1>PowerShow</h1>
          <p>{t("home.getStartedPrefix")}</p>
        </div>

        <div className={styles.liveArea}>
          <span>{t("public.noLive")}</span>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primary}
            onClick={() => router.push("/studio")}
          >
            {t("public.library")}
          </button>

          <button type="button" className={styles.secondary} disabled>
            {t("public.play")}
          </button>
        </div>
      </main>
    </div>
  );
}
