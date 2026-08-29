import type { Presentation } from "@powershow/document-schema";

import { loadPublishedVersion } from "./published-presentation-loader";
import { getRealtimeDatabaseOrNull } from "./realtime-db";
import {
  parseEntrySearch,
  resolveLiveIdentityMount,
  subscribeLiveCurrent,
  type LiveCurrent,
  type LiveCurrentEvent,
} from "./live-entry";
import { mapPromotedSlideIndex } from "./live-version-mapping";
import { subscribeLiveProjectionState } from "./live-state";
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
  let cleanupLiveCurrent: (() => void) | undefined;
  let activePresentation: Presentation | undefined;
  let activeLive: LiveCurrent | undefined;
  let currentSessionKey: string | null = null;
  let loadToken = 0;

  function renderLoadState(message: string): void {
    root.innerHTML = `
      <div class="powershow-player-load-state">
        ${message}
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
    if (!activeController) {
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
        activeController,
        logsEnabled,
      );

      recordPlayerDiagnostic("LIVE_PROJECTION_ATTACH_OK", {
        revision: live.revision,
      });
    } catch (error) {
      console.error("Player: live projection state initialization failed", error);
      recordPlayerDiagnostic("LIVE_PROJECTION_ATTACH_ERROR", { error });
    }
  }

  function detachLiveSlideAck(): void {
    cleanupLiveProjection?.();
    cleanupLiveProjection = undefined;
  }

  function teardownLiveSession(): void {
    loadToken += 1;
    currentSessionKey = null;
    detachLiveSlideAck();
    activeController?.destroy();
    activeController = undefined;
    activePresentation = undefined;
    activeLive = undefined;
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
      detachLiveSlideAck();
      loadToken += 1;
    } else {
      teardownLiveSession();
    }

    currentSessionKey = key;
    loadToken += 1;
    const token = loadToken;

    if (!promotion) {
      renderLoadState("Loading presentation…");
    }

    const result = await resolveLiveIdentityMount(event.live, loadPublishedVersion);

    if (token !== loadToken) {
      return;
    }

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

      recordPlayerDiagnostic("PLAYER_MOUNT_START", {
        revision: event.live.revision,
      });

      try {
        activeController = mountPlayer(root, result.presentation, { controls });
      } catch (error) {
        recordPlayerDiagnostic("PLAYER_MOUNT_ERROR", { error });
        throw error;
      }

      recordPlayerDiagnostic("PLAYER_MOUNT_OK", {
        revision: event.live.revision,
      });

      if (promotion) activeController.goTo(promotedIndex);

      activePresentation = result.presentation;
      activeLive = event.live;
      attachLiveProjection(event.live, result.presentation, logsEnabled);
      return;
    }

    currentSessionKey = null;

    if (promotion) {
      console.error("Player: could not load promoted live version.");
      return;
    }

    if (result.kind === "not-found") {
      renderLoadState("Presentation not found.");
      return;
    }

    renderLoadState("Could not load presentation.");
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
    renderLoadState("Loading presentation…");
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
