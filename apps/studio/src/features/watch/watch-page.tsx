"use client";

import { useEffect, useRef, useState } from "react";

import {
  fitLogicalSlideGeometry,
  paletteColorCssVariableName,
  renderFontResources,
  renderSlide,
  resolveLogicalSlideSize,
} from "@powershow/renderer";

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
  const logicalSize = resolveLogicalSlideSize(presentation.aspectRatio);
  const paletteStyle = Object.fromEntries(
    (presentation.palette?.colors ?? []).map((color) => [
      paletteColorCssVariableName(color.id),
      color.value,
    ]),
  );
  const viewportRef = useRef<HTMLElement | null>(null);
  const [geometry, setGeometry] = useState(() =>
    fitLogicalSlideGeometry(presentation.aspectRatio, 0, 0),
  );

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    const measure = () => {
      const width = Math.max(0, viewport.clientWidth - 48);
      const height = Math.max(0, viewport.clientHeight - 48);

      setGeometry(
        fitLogicalSlideGeometry(presentation.aspectRatio, width, height),
      );
    };

    measure();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(measure);
      observer.observe(viewport);

      return () => observer.disconnect();
    }

    window.addEventListener("resize", measure);

    return () => window.removeEventListener("resize", measure);
  }, [presentation.aspectRatio]);

  return (
    <main ref={viewportRef} className={styles.center}>
      <div
        className={styles.stage}
        style={{
          width: geometry.physicalWidth,
          height: geometry.physicalHeight,
        }}
      >
        {fontResourcesCss !== "" && (
          <style data-powershow-font-resources>{fontResourcesCss}</style>
        )}
        <div
          className={styles.slideSurface}
          style={{
            width: logicalSize.logicalWidth,
            height: logicalSize.logicalHeight,
            transform: `scale(${geometry.scale})`,
            ...paletteStyle,
          }}
          dangerouslySetInnerHTML={{ __html: renderSlide(slide, { presentation }) }}
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
