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
  createLiveScriptedActionTracker,
  subscribeLiveScriptedAction,
} from "./live-scripted-action";
import { createLiveScriptedStatePublisher } from "./live-scripted-state";
import { createLiveScriptedInputTracker, subscribeLiveScriptedInput } from "./live-scripted-input";
import {
  startPlayerPresence,
  type PlayerPresenceReporter,
  type PlayerPresenceTransition,
} from "./live-player-presence";
import {
  buildPlayerCacheClearUrl,
  buildPlayerReloadUrl,
  subscribePlayerRecoveryRequest,
} from "./live-player-recovery-request";
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
  let cleanupLiveScriptedAction: (() => void) | undefined;
  let cleanupLiveScriptedInput: (() => void) | undefined;
  let cleanupPlayerRecoveryRequest: (() => void) | undefined;
  let cleanupLiveCurrent: (() => void) | undefined;
  let presenceReporter: PlayerPresenceReporter | undefined;
  let activePresentation: Presentation | undefined;
  let activeLive: LiveCurrent | undefined;
  let currentSessionKey: string | null = null;
  let loadToken = 0;
  let localRecoveryRevision = 0;
  let localRecoveryInFlight = false;
  let mountRevision = 0;
  const liveScriptedActionTracker = createLiveScriptedActionTracker();
  const liveScriptedInputTracker = createLiveScriptedInputTracker();
  let getCurrentScriptedMount: ((slot: number) => { pageId: string; elementId: string; mountRevision: number } | null) | undefined;
  let markAppliedScriptedInput: ((input: { scriptedSlot: number; portIndex: number; pageId: string; elementId: string; portId: string; mountRevision: number; revision: number }) => void) | undefined;

  interface LoadFailureEvidence {
    code?: "FIRESTORE_LOAD_ERROR";
    stage?: "Published presentation";
    lastAttempt?: string;
  }

  let loadFailureEvidence: LoadFailureEvidence = {};

  function recordPresenceWriteError(
    transition: PlayerPresenceTransition,
    error: unknown,
  ): void {
    recordPlayerDiagnostic("PLAYER_PRESENCE_WRITE_ERROR", {
      transition,
      error,
    });
  }

  function renderLoadState(
    message: string,
    loading = false,
    recoverable = false,
  ): void {
    root.innerHTML = `
      <div class="powershow-player-load-state" data-loading="${loading}">
        <span>${message}</span>
        <span class="powershow-player-load-indicator" aria-hidden="true"></span>
      </div>
    `;

    if (!recoverable) return;

    const state = root.querySelector<HTMLElement>(".powershow-player-load-state");
    if (!state) return;

    const moreButton = document.createElement("button");
    moreButton.className = "powershow-player-recovery-toggle";
    moreButton.type = "button";
    moreButton.textContent = "See more";
    moreButton.setAttribute("aria-expanded", "false");
    state.appendChild(moreButton);

    moreButton.addEventListener("click", () => {
      if (moreButton.getAttribute("aria-expanded") === "true") {
        renderLoadFailure();
      } else {
        renderRecoveryExpanded();
      }
    });
  }

  function renderRecoveryExpanded(): void {
    const state = root.querySelector<HTMLElement>(".powershow-player-load-state");
    if (!state) return;

    const moreButton = state.querySelector<HTMLButtonElement>(
      ".powershow-player-recovery-toggle",
    );
    if (moreButton) {
      moreButton.setAttribute("aria-expanded", "true");
      moreButton.textContent = "See less";
    }

    const options = document.createElement("div");
    options.className = "powershow-player-recovery-options";
    options.setAttribute("role", "group");
    options.setAttribute("aria-label", "Local recovery options");

    const retryButton = document.createElement("button");
    retryButton.type = "button";
    retryButton.textContent = "Try presentation again";
    retryButton.addEventListener("click", () => {
      void retryPresentation();
    });

    const reloadButton = document.createElement("button");
    reloadButton.type = "button";
    reloadButton.textContent = "Reload Player";
    reloadButton.addEventListener("click", () => {
      navigateLocalReload();
    });

    const clearCacheButton = document.createElement("button");
    clearCacheButton.type = "button";
    clearCacheButton.textContent = "Clear cache and reload";
    clearCacheButton.addEventListener("click", () => {
      navigateLocalCacheClear();
    });

    options.append(retryButton, reloadButton, clearCacheButton);

    for (const [label, value] of [
      ["Error code", loadFailureEvidence.code],
      ["Stage", loadFailureEvidence.stage],
      ["Last attempt", loadFailureEvidence.lastAttempt],
    ] as const) {
      if (value === undefined) continue;
      const row = document.createElement("span");
      row.textContent = `${label}: ${value}`;
      options.appendChild(row);
    }

    state.appendChild(options);
  }

  function renderLoadFailure(): void {
    renderLoadState("Could not load presentation.", false, activeLive !== undefined);
  }

  function markLoadFailure(): void {
    loadFailureEvidence = {
      code: "FIRESTORE_LOAD_ERROR",
      stage: "Published presentation",
      lastAttempt: new Date().toTimeString().slice(0, 8),
    };
  }

  function nextLocalRecoveryRevision(): number {
    localRecoveryRevision += 1;
    return localRecoveryRevision;
  }

  function navigateLocalReload(): void {
    const activationRevision = activeLive?.revision ?? 0;
    window.location.replace(
      buildPlayerReloadUrl(
        window.location.href,
        activationRevision,
        nextLocalRecoveryRevision(),
      ),
    );
  }

  function navigateLocalCacheClear(): void {
    if (!window.confirm("Clear the Player cache and reload?")) return;

    const activationRevision = activeLive?.revision ?? 0;
    window.location.replace(
      buildPlayerCacheClearUrl(
        window.location.href,
        activationRevision,
        nextLocalRecoveryRevision(),
      ),
    );
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
      if (presenceReporter?.bootId) {
        cleanupLiveScriptedAction = subscribeLiveScriptedAction(
          database,
          live.revision,
          live.currentVersionId,
          presenceReporter.bootId,
          presentation,
          controller,
          liveScriptedActionTracker,
        );
        if (getCurrentScriptedMount) cleanupLiveScriptedInput = subscribeLiveScriptedInput(
          database, live.revision, live.currentVersionId, presenceReporter.bootId,
          presentation, controller, getCurrentScriptedMount, liveScriptedInputTracker, markAppliedScriptedInput,
        );
      }
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

  function detachLiveScriptedAction(): void {
    cleanupLiveScriptedAction?.();
    cleanupLiveScriptedAction = undefined;
  }
  function detachLiveScriptedInput(): void { cleanupLiveScriptedInput?.(); cleanupLiveScriptedInput = undefined; }

  function detachLiveProjectionSubscriptions(): void {
    detachLiveSlideAck();
    detachLiveFullscreenRequest();
    detachLiveGalleryControl();
    detachLiveScriptedAction();
    detachLiveScriptedInput();
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
    getCurrentScriptedMount = undefined;
    markAppliedScriptedInput = undefined;
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
        const publisher = presenceReporter?.bootId && database
          ? createLiveScriptedStatePublisher({
              database,
              activationRevision: requestedLive.revision,
              currentVersionId: requestedLive.currentVersionId,
              bootId: presenceReporter.bootId,
              presentation: result.presentation,
              allocateMountRevision: () => ++mountRevision,
              isCurrent: () => activePresentation === result.presentation &&
                activeLive === requestedLive,
              getCurrentPageId: () => {
                const controller = activeController;
                const presentation = activePresentation;
                return controller && presentation
                  ? presentation.slides[controller.getCurrentIndex()]?.id ?? null
                  : null;
              },
              onRuntimeWriteError: () => recordPlayerDiagnostic("SCRIPTED_RUNTIME_WRITE_ERROR"),
              onReportWriteError: () => recordPlayerDiagnostic("SCRIPTED_REPORT_WRITE_ERROR"),
            })
          : undefined;
        activePresentation = result.presentation;
        activeLive = requestedLive;
        activeController = mountPlayer(root, result.presentation, {
          controls,
          ...(publisher === undefined ? {} : {
            onScriptedMount: publisher.onScriptedMount,
            onScriptedReport: publisher.onScriptedReport,
          }),
        });
        getCurrentScriptedMount = publisher?.getCurrentMount;
        markAppliedScriptedInput = publisher?.markAppliedInput;
      } catch (error) {
        recordPlayerDiagnostic("PLAYER_MOUNT_ERROR", { error });
        presenceReporter?.failed("player-mount-failed");
        throw error;
      }

      recordPlayerDiagnostic("PLAYER_MOUNT_OK", {
        revision: requestedLive.revision,
      });

      if (promotion) activeController.goTo(promotedIndex);

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
    markLoadFailure();
    renderLoadFailure();
  }

  async function retryPresentation(): Promise<void> {
    if (localRecoveryInFlight || database === null) return;

    loadToken += 1;
    const token = loadToken;
    const retryingLive = activeLive;

    if (retryingLive === undefined) {
      return;
    }

    localRecoveryInFlight = true;

    detachLiveProjectionSubscriptions();
    activeController?.destroy();
    activeController = undefined;
    activePresentation = undefined;
    presenceReporter?.starting();
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
        presenceReporter?.failed("presentation-load-failed");
        markLoadFailure();
        renderLoadFailure();
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
      presenceReporter?.failed("presentation-load-failed");
      markLoadFailure();
      renderLoadFailure();
    } finally {
      localRecoveryInFlight = false;
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
        markLoadFailure();
        renderLoadFailure();
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
