import type { Presentation } from "@powershow/document-schema";

import { loadPublishedVersion } from "./published-presentation-loader";
import { getRealtimeDatabaseOrNull } from "./realtime-db";
import {
  parseEntrySearch,
  readLiveCurrent,
  resolveLiveIdentityMount,
  subscribeLiveCurrent,
  type LiveCurrent,
  type LiveCurrentEvent,
} from "./live-entry";
import { mapPromotedSlideIndex } from "./live-version-mapping";
import { subscribeLiveProjectionState } from "./live-state";
import { subscribeLiveFullscreenRequest } from "./live-fullscreen-request";
import { subscribeLiveGalleryControl } from "./live-gallery-control";
import {
  startPlayerPresence,
  type PlayerPresenceReporter,
  type PlayerPresenceTransition,
} from "./live-player-presence";
import { subscribePlayerRecoveryRequest } from "./live-player-recovery-request";
import {
  configurePlayerDiagnostics,
  recordPlayerDiagnostic,
} from "./player-diagnostics";
import { mountPlayer, type PlayerController } from "./player";

const controls = {
  position: "bottom-right",
  style: "compact",
  showCounter: true,
  animation: "fade",
} as const;

function liveSessionKey(live: LiveCurrent): string {
  return `${live.publicationId}|${live.currentVersionId}|${live.revision}`;
}

function isVersionPromotion(previous: LiveCurrent, next: LiveCurrent): boolean {
  return (
    previous.publicationId === next.publicationId &&
    previous.revision === next.revision &&
    previous.currentVersionId !== next.currentVersionId
  );
}

/** Boots the existing Player runtime on the shared root element. */
export function startPlayer(root: HTMLElement): () => void {
  let activeController: PlayerController | undefined;
  let cleanupLiveProjection: (() => void) | undefined;
  let cleanupLiveFullscreenRequest: (() => void) | undefined;
  let cleanupLiveGalleryControl: (() => void) | undefined;
  let cleanupPlayerRecoveryRequest: (() => void) | undefined;
  let cleanupLiveCurrent: (() => void) | undefined;
  let presenceReporter: PlayerPresenceReporter | undefined;
  let activePresentation: Presentation | undefined;
  let activeLive: LiveCurrent | undefined;
  let currentSessionKey: string | null = null;
  let loadToken = 0;

  function recordPresenceWriteError(
    transition: PlayerPresenceTransition,
    error: unknown,
  ): void {
    recordPlayerDiagnostic("PLAYER_PRESENCE_WRITE_ERROR", {
      transition,
      error,
    });
  }

  function renderLoadState(message: string, loading = false): void {
    root.innerHTML = `
      <div class="powershow-player-load-state" data-loading="${loading}">
        <span>${message}</span>
        <span class="powershow-player-load-indicator" aria-hidden="true"></span>
      </div>
    `;
  }

  function renderNoActive(): void {
    renderLoadState("No active presentation.");
  }

  function attachLiveProjection(
    live: LiveCurrent,
    presentation: Presentation,
    logsEnabled: boolean,
  ): void {
    const controller = activeController;

    if (!controller) {
      return;
    }

    recordPlayerDiagnostic("LIVE_PROJECTION_ATTACH_START", {
      revision: live.revision,
    });

    try {
      const database = getRealtimeDatabaseOrNull();

      if (!database) {
        if (logsEnabled) {
          console.warn(
            "[PowerShow][live-state] RTDB unavailable – live projection state not attached",
          );
        }
        return;
      }

      cleanupLiveProjection = subscribeLiveProjectionState(
        database,
        live.revision,
        live.currentVersionId,
        presentation,
        controller,
        logsEnabled,
      );

      recordPlayerDiagnostic("LIVE_PROJECTION_ATTACH_OK", {
        revision: live.revision,
      });

      cleanupLiveFullscreenRequest = subscribeLiveFullscreenRequest(
        database,
        live.revision,
        live.currentVersionId,
        controller,
        root,
      );
      cleanupLiveGalleryControl = subscribeLiveGalleryControl(
        database,
        live.revision,
        live.currentVersionId,
        presentation,
        controller,
      );
    } catch (error) {
      console.error("Player: live projection state initialization failed", error);
      recordPlayerDiagnostic("LIVE_PROJECTION_ATTACH_ERROR", { error });
    }
  }

  function detachLiveSlideAck(): void {
    cleanupLiveProjection?.();
    cleanupLiveProjection = undefined;
  }

  function detachLiveFullscreenRequest(): void {
    cleanupLiveFullscreenRequest?.();
    cleanupLiveFullscreenRequest = undefined;
  }

  function detachLiveGalleryControl(): void {
    cleanupLiveGalleryControl?.();
    cleanupLiveGalleryControl = undefined;
  }

  function detachLiveProjectionSubscriptions(): void {
    detachLiveSlideAck();
    detachLiveFullscreenRequest();
    detachLiveGalleryControl();
  }

  function detachPlayerRecoveryRequest(): void {
    cleanupPlayerRecoveryRequest?.();
    cleanupPlayerRecoveryRequest = undefined;
  }

  function teardownLiveSession(): void {
    loadToken += 1;
    currentSessionKey = null;
    detachLiveProjectionSubscriptions();
    detachPlayerRecoveryRequest();
    activeController?.destroy();
    activeController = undefined;
    activePresentation = undefined;
    activeLive = undefined;
    presenceReporter?.stop();
    presenceReporter = undefined;
  }

  async function loadAndMount(
    requestedLive: LiveCurrent,
    token: number,
    load: () => Promise<Awaited<ReturnType<typeof resolveLiveIdentityMount>>>,
    promotion: boolean,
  ): Promise<void> {
    const result = await load();

    if (token !== loadToken) return;

    if (result.kind === "ok") {
      const promotedIndex =
        promotion && activePresentation && activeController
          ? mapPromotedSlideIndex(
              activePresentation,
              result.presentation,
              activeController.getCurrentIndex(),
            )
          : 0;

      activeController?.destroy();
      activeController = undefined;

      recordPlayerDiagnostic("PLAYER_MOUNT_START", {
        revision: requestedLive.revision,
      });

      try {
        activeController = mountPlayer(root, result.presentation, { controls });
      } catch (error) {
        recordPlayerDiagnostic("PLAYER_MOUNT_ERROR", { error });
        presenceReporter?.failed("player-mount-failed");
        throw error;
      }

      recordPlayerDiagnostic("PLAYER_MOUNT_OK", {
        revision: requestedLive.revision,
      });

      if (promotion) activeController.goTo(promotedIndex);

      activePresentation = result.presentation;
      activeLive = requestedLive;
      attachLiveProjection(requestedLive, result.presentation, logsEnabled);
      presenceReporter?.ready();
      return;
    }

    currentSessionKey = null;

    if (result.kind === "not-found") {
      presenceReporter?.failed("presentation-not-found");
      renderLoadState("Presentation not found.");
      return;
    }

    presenceReporter?.failed("presentation-load-failed");
    renderLoadState("Could not load presentation.");
  }

  async function retryPresentation(): Promise<void> {
    if (presenceReporter === undefined || database === null) return;

    loadToken += 1;
    const token = loadToken;
    const retryingLive = activeLive;

    if (retryingLive === undefined) {
      return;
    }

    detachLiveProjectionSubscriptions();
    activeController?.destroy();
    activeController = undefined;
    activePresentation = undefined;
    activeLive = undefined;
    presenceReporter.starting();
    renderLoadState("Loading presentation…", true);

    try {
      const liveResult = await readLiveCurrent(database);
      if (token !== loadToken) return;
      if (
        liveResult.kind !== "ok" ||
        liveResult.live.revision !== retryingLive.revision ||
        liveResult.live.currentVersionId !== retryingLive.currentVersionId ||
        liveResult.live.publicationId !== retryingLive.publicationId
      ) {
        presenceReporter.failed("presentation-load-failed");
        renderLoadState("Could not load presentation.");
        return;
      }

      await loadAndMount(
        liveResult.live,
        token,
        () => resolveLiveIdentityMount(liveResult.live, loadPublishedVersion),
        false,
      );
    } catch (error) {
      if (token !== loadToken) return;
      recordPlayerDiagnostic("PLAYER_RECOVERY_RETRY_ERROR", { error });
      presenceReporter.failed("presentation-load-failed");
      renderLoadState("Could not load presentation.");
    }
  }

  async function handleLiveEvent(event: LiveCurrentEvent): Promise<void> {
    if (event.kind === "no-active") {
      recordPlayerDiagnostic("LIVE_EVENT_NO_ACTIVE");
      teardownLiveSession();
      renderNoActive();
      return;
    }

    if (event.kind === "error") {
      recordPlayerDiagnostic("LIVE_EVENT_ERROR");
      if (activeController === undefined) {
        renderLoadState("Could not load presentation.");
      }
      return;
    }

    recordPlayerDiagnostic("LIVE_EVENT_ACTIVE", {
      revision: event.live.revision,
    });

    const key = liveSessionKey(event.live);

    if (key === currentSessionKey) {
      return;
    }

    const promotion =
      activeController !== undefined &&
      activePresentation !== undefined &&
      activeLive !== undefined &&
      isVersionPromotion(activeLive, event.live);

    if (promotion) {
      detachLiveProjectionSubscriptions();
      detachPlayerRecoveryRequest();
      loadToken += 1;
    } else {
      teardownLiveSession();
    }

    currentSessionKey = key;
    activeLive = event.live;
    loadToken += 1;
    const token = loadToken;

    try {
      presenceReporter?.stop();
      presenceReporter = await startPlayerPresence(
        database!,
        event.live.revision,
        event.live.currentVersionId,
        recordPresenceWriteError,
      );
    } catch (error) {
      recordPresenceWriteError("starting", error);
    }

    if (presenceReporter !== undefined) {
      try {
        cleanupPlayerRecoveryRequest = subscribePlayerRecoveryRequest(
          database!,
          event.live.revision,
          event.live.currentVersionId,
          presenceReporter.bootId,
          window.location,
          window.location,
          () => retryPresentation(),
        );
      } catch (error) {
        recordPlayerDiagnostic("PLAYER_RECOVERY_SUBSCRIBE_ERROR", { error });
      }
    }

    if (token !== loadToken) return;

    if (!promotion) {
      renderLoadState("Loading presentation…", true);
    }

    try {
      await loadAndMount(
        event.live,
        token,
        () => resolveLiveIdentityMount(event.live, loadPublishedVersion),
        promotion,
      );
    } catch (error) {
      if (promotion) {
        console.error("Player: could not load promoted live version.");
      }
    }
  }

  const { logsEnabled } = parseEntrySearch(window.location.search);
  configurePlayerDiagnostics(logsEnabled);
  recordPlayerDiagnostic("BOOT");

  let database: ReturnType<typeof getRealtimeDatabaseOrNull> | null = null;

  recordPlayerDiagnostic("RTDB_INIT_START");

  try {
    database = getRealtimeDatabaseOrNull();

    if (database === null) {
      recordPlayerDiagnostic("RTDB_INIT_MISSING");
    } else {
      recordPlayerDiagnostic("RTDB_INIT_OK");
    }
  } catch (error) {
    recordPlayerDiagnostic("RTDB_INIT_ERROR", { error });
    throw error;
  }

  if (!database) {
    renderLoadState("Could not load presentation.");
  } else {
    renderLoadState("Loading presentation…", true);
    cleanupLiveCurrent = subscribeLiveCurrent(database, (event) => {
      void handleLiveEvent(event);
    });
  }

  const cleanup = (): void => {
    cleanupLiveCurrent?.();
    cleanupLiveCurrent = undefined;
    teardownLiveSession();
  };

  window.addEventListener("pagehide", cleanup, { once: true });

  return cleanup;
}
