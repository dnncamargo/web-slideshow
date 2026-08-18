"use client";

import type { CSSProperties } from "react";

import { renderFontResources, renderSlide } from "@powershow/renderer";

import { useWatchSession, type WatchViewState } from "./use-watch-session";

import styles from "./watch-view.module.css";

/**
 * Watch-specific copy. Watch is an empirical validator of the Live state
 * contract and is intentionally not wired to Studio i18n yet: the required
 * visible strings are kept verbatim here.
 */
const WATCH_COPY = {
  noLive: "Nenhuma apresentação ao vivo",
  awaitingPlayer: "Aguardando Player",
  loading: "Carregando…",
  loadError: "Não foi possível carregar a apresentação.",
} as const;

function WatchMessage({ text }: { text: string }) {
  return (
    <main className={styles.center}>
      <p className={styles.message}>{text}</p>
    </main>
  );
}

function WatchSlide({
  state,
}: {
  state: Extract<WatchViewState, { kind: "ready" }>;
}) {
  const { presentation, slide } = state;
  const fontResourcesCss = renderFontResources(presentation.resources?.fonts);
  const ratio = presentation.aspectRatio === "4:3" ? 4 / 3 : 16 / 9;

  // Scale the slide to the available area while preserving the presentation
  // aspect ratio: width fits 100% unless the height would overflow.
  const stageStyle: CSSProperties = {
    aspectRatio: `${ratio}`,
    width: `min(100%, calc(100svh * ${1 / ratio}))`,
  };

  return (
    <main className={styles.center}>
      <div className={styles.stage} style={stageStyle}>
        {fontResourcesCss !== "" && (
          <style data-powershow-font-resources>{fontResourcesCss}</style>
        )}
        <div
          className={styles.slideHost}
          dangerouslySetInnerHTML={{ __html: renderSlide(slide) }}
        />
      </div>
    </main>
  );
}

export function WatchPage() {
  const state = useWatchSession();

  if (state.kind === "no-live") {
    return <WatchMessage text={WATCH_COPY.noLive} />;
  }

  if (state.kind === "waiting-player") {
    return <WatchMessage text={WATCH_COPY.awaitingPlayer} />;
  }

  if (state.kind === "loading-version") {
    return <WatchMessage text={WATCH_COPY.loading} />;
  }

  if (state.kind === "version-error") {
    return <WatchMessage text={WATCH_COPY.loadError} />;
  }

  return <WatchSlide state={state} />;
}
