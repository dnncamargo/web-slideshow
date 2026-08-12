"use client";

import Image from "next/image";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "./page.module.css";

export default function Home() {
  const { t } = useStudioI18n();

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <Image
          className={styles.logo}
          src="/next.svg"
          alt={t("home.nextLogoAlt")}
          width={100}
          height={20}
          priority
        />
        <div className={styles.intro}>
          <h1>
            <span>{t("home.getStartedPrefix")}</span>{" "}
            <code className={styles.code}>page.tsx</code>
            <span>{t("home.getStartedSuffix")}</span>
          </h1>
          <p>
            <span>{t("home.instructionsPrefix")}</span>{" "}
            <a
              href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>{t("home.templates")}</span>
            </a>{" "}
            <span>{t("home.or")}</span>{" "}
            <a
              href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>{t("home.learning")}</span>
            </a>{" "}
            <span>{t("home.center")}</span>
          </p>
        </div>
        <div className={styles.ctas}>
          <a
            className={styles.primary}
            href="https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              className={styles.logo}
              src="/vercel.svg"
              alt={t("home.vercelLogoAlt")}
              width={16}
              height={14}
            />
            <span>{t("home.deploy")}</span>
          </a>
          <a
            className={styles.secondary}
            href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>{t("home.documentation")}</span>
          </a>
        </div>
      </main>
    </div>
  );
}
