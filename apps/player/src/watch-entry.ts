import { onValue, ref, type Database } from "firebase/database";

import type { Presentation } from "@powershow/document-schema";

import {
  type LiveCurrent,
  subscribeLiveCurrent,
  type LiveCurrentEvent,
} from "./live-entry";
import {
  PLAYER_STATE_PATH,
  parseLivePlayerState,
  type LivePlayerState,
} from "./live-state";
import { loadPublishedVersion } from "./published-presentation-loader";
import { getRealtimeDatabaseOrNull } from "./realtime-db";
import {
  mountProjectionSurface,
  type ProjectionSurface,
} from "./projection-surface";

const WATCH_COPY = {
  noLive: "Nenhuma apresentação ao vivo",
  awaitingPlayer: "Aguardando Player",
  loading: "Carregando…",
  loadError: "Não foi possível carregar a apresentação.",
} as const;

type VersionState =
  | { identityKey: string; kind: "loading" }
  | { identityKey: string; kind: "error" }
  | { identityKey: string; kind: "ready"; presentation: Presentation };

export interface WatchController {
  destroy(): void;
}

function identityKey(live: LiveCurrent): string {
  return `${live.publicationId}|${live.currentVersionId}|${live.revision}`;
}

function matchesLiveIdentity(
  playerState: LivePlayerState,
  live: LiveCurrent,
): boolean {
  return (
    playerState.activationRevision === live.revision &&
    playerState.currentVersionId === live.currentVersionId
  );
}

function renderMessage(root: HTMLElement, message: string): void {
  root.innerHTML = `
    <div class="powershow-player-load-state">
      ${message}
    </div>
  `;
}

/** Boots the read-only Watch projection on the shared Player root. */
export function startWatch(root: HTMLElement): WatchController {
  let activeLive: LiveCurrent | null = null;
  let currentPlayerState: LivePlayerState | null = null;
  let versionState: VersionState | null = null;
  let versionLoadToken = 0;
  let cleanupLiveCurrent: (() => void) | undefined;
  let cleanupPlayerState: (() => void) | undefined;
  let projection: ProjectionSurface | null = null;
  let mountedPresentation: Presentation | null = null;
  let destroyed = false;

  function destroyProjection(): void {
    projection?.destroy();
    projection = null;
    mountedPresentation = null;
  }

  function renderCurrentState(): void {
    if (destroyed) return;

    if (activeLive === null) {
      destroyProjection();
      renderMessage(root, WATCH_COPY.noLive);
      return;
    }

    const currentIdentity = identityKey(activeLive);
    const playerState =
      currentPlayerState !== null &&
      matchesLiveIdentity(currentPlayerState, activeLive)
        ? currentPlayerState
        : null;

    if (playerState === null) {
      destroyProjection();
      renderMessage(root, WATCH_COPY.awaitingPlayer);
      return;
    }

    if (versionState?.identityKey !== currentIdentity) {
      destroyProjection();
      renderMessage(root, WATCH_COPY.loading);
      return;
    }

    if (versionState.kind === "loading") {
      destroyProjection();
      renderMessage(root, WATCH_COPY.loading);
      return;
    }

    if (versionState.kind === "error") {
      destroyProjection();
      renderMessage(root, WATCH_COPY.loadError);
      return;
    }

    const slideIndex = versionState.presentation.slides.findIndex(
      (slide) => slide.id === playerState.pageId,
    );

    if (slideIndex < 0) {
      destroyProjection();
      renderMessage(root, WATCH_COPY.awaitingPlayer);
      return;
    }

    if (
      projection === null ||
      mountedPresentation !== versionState.presentation
    ) {
      destroyProjection();
      projection = mountProjectionSurface(root, versionState.presentation, {
        transition: "fade",
      });
      mountedPresentation = versionState.presentation;
    }

    projection.goTo(slideIndex);
  }

  function subscribePlayerState(
    database: Database,
    expectedLive: LiveCurrent,
  ): void {
    const expectedIdentity = identityKey(expectedLive);

    cleanupPlayerState?.();
    cleanupPlayerState = onValue(
      ref(database, PLAYER_STATE_PATH),
      (snapshot) => {
        if (
          destroyed ||
          activeLive === null ||
          identityKey(activeLive) !== expectedIdentity
        ) {
          return;
        }

        const parsed = parseLivePlayerState(snapshot.val());
        currentPlayerState =
          parsed !== null && matchesLiveIdentity(parsed, expectedLive)
            ? parsed
            : null;
        renderCurrentState();
      },
      () => {
        if (
          !destroyed &&
          activeLive !== null &&
          identityKey(activeLive) === expectedIdentity
        ) {
          currentPlayerState = null;
          renderCurrentState();
        }
      },
    );
  }

  function loadVersion(expectedLive: LiveCurrent): void {
    const expectedIdentity = identityKey(expectedLive);
    versionLoadToken += 1;
    const token = versionLoadToken;
    versionState = { identityKey: expectedIdentity, kind: "loading" };
    renderCurrentState();

    void loadPublishedVersion(
      expectedLive.publicationId,
      expectedLive.currentVersionId,
    )
      .then((result) => {
        if (
          destroyed ||
          token !== versionLoadToken ||
          activeLive === null ||
          identityKey(activeLive) !== expectedIdentity
        ) {
          return;
        }

        versionState =
          result.kind === "ok"
            ? {
                identityKey: expectedIdentity,
                kind: "ready",
                presentation: result.presentation,
              }
            : { identityKey: expectedIdentity, kind: "error" };
        renderCurrentState();
      })
      .catch(() => {
        if (
          destroyed ||
          token !== versionLoadToken ||
          activeLive === null ||
          identityKey(activeLive) !== expectedIdentity
        ) {
          return;
        }

        versionState = { identityKey: expectedIdentity, kind: "error" };
        renderCurrentState();
      });
  }

  function handleLiveEvent(event: LiveCurrentEvent): void {
    if (event.kind !== "active") {
      activeLive = null;
      currentPlayerState = null;
      versionState = null;
      versionLoadToken += 1;
      cleanupPlayerState?.();
      cleanupPlayerState = undefined;
      renderCurrentState();
      return;
    }

    const nextIdentity = identityKey(event.live);
    if (activeLive !== null && identityKey(activeLive) === nextIdentity) {
      return;
    }

    activeLive = event.live;
    currentPlayerState = null;
    versionState = { identityKey: nextIdentity, kind: "loading" };
    cleanupPlayerState?.();
    cleanupPlayerState = undefined;

    const database = getRealtimeDatabaseOrNull();
    if (database !== null) {
      subscribePlayerState(database, event.live);
    }

    loadVersion(event.live);
  }

  const database = getRealtimeDatabaseOrNull();
  renderMessage(root, WATCH_COPY.noLive);
  if (database !== null) {
    cleanupLiveCurrent = subscribeLiveCurrent(database, handleLiveEvent);
  }

  let controller: WatchController;
  const handlePagehide = (): void => controller.destroy();

  controller = {
    destroy(): void {
      if (destroyed) return;

      destroyed = true;
      versionLoadToken += 1;
      window.removeEventListener("pagehide", handlePagehide);
      cleanupLiveCurrent?.();
      cleanupLiveCurrent = undefined;
      cleanupPlayerState?.();
      cleanupPlayerState = undefined;
      destroyProjection();
    },
  };

  window.addEventListener("pagehide", handlePagehide, { once: true });

  return controller;
}
