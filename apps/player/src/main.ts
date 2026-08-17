import "@powershow/theme/index.css";
import "./player.css";

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

import { mountPlayer, type PlayerController } from "./player";

const rootElement = document.querySelector<HTMLElement>("#app");

if (!rootElement) {
  throw new Error("PowerShow Player root element was not found.");
}

const root = rootElement;

// ============================================================
// CONTROLES DO PLAYER
// ============================================================

const controls = {
  position: "bottom-right",

  style: "compact",

  showCounter: true,

  animation: "fade",
} as const;

let activeController: PlayerController | undefined;
let cleanupLiveProjection: (() => void) | undefined;
let cleanupLiveCurrent: (() => void) | undefined;
let activePresentation: Presentation | undefined;
let activeLive: LiveCurrent | undefined;

// Identidade da sessão Live atualmente montada e token de carga.
// O token invalida cargas assíncronas obsoletas quando a sessão muda.
let currentSessionKey: string | null = null;
let loadToken = 0;

// ============================================================
// ESTADOS DE CARGA / ERRO
// ============================================================

function renderLoadState(message: string): void {
  root.innerHTML = `
    <div class="powershow-player-load-state">
      ${message}
    </div>
  `;
}

function renderNoActive(): void {
  root.innerHTML = `
    <div class="powershow-player-load-state">
      No active presentation.
    </div>
  `;
}

// ============================================================
// SLIDE STATE LIVE
// ============================================================

function attachLiveProjection(
  live: LiveCurrent,
  presentation: Presentation,
  logsEnabled: boolean,
): void {
  if (!activeController) {
    return;
  }

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
  } catch (error) {
    // Falha de inicialização da projeção live nunca derruba o Player.
    console.error("Player: live projection state initialization failed", error);
  }
}

// ============================================================
// ENTRADA LIVE
//
// Fluxo:
//   1. assina live/current continuamente (fonte canônica de sessão);
//   2. a cada snapshot valida publicationId / currentVersionId / revision;
//   3. carrega a versão exata em Firestore;
//   4. valida a Presentation com o schema canônico;
//   5. monta o Player e inicia o slide state (live ACK).
//
// Uma sessão ativa nova re-monta o Player com a activationRevision atual.
// Quando live/current fica ausente, a sessão é encerrada imediatamente.
// Não resolve o pointer público. Sem fallback para a demo.
// ============================================================

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

function detachLiveSlideAck(): void {
  cleanupLiveProjection?.();
  cleanupLiveProjection = undefined;
}

function teardownLiveSession(): void {
  // Invalida qualquer carga assíncrona ainda em andamento.
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
    teardownLiveSession();

    renderNoActive();

    return;
  }

  if (event.kind === "error") {
    // Em erro transitório de leitura/validação, mantém uma sessão saudável.
    // Sem sessão montada, mostra o estado de carga/erro como na entrada one-shot.
    if (activeController === undefined) {
      renderLoadState("Could not load presentation.");
    }

    return;
  }

  const key = liveSessionKey(event.live);

  // Mesma identidade reemitida → não remonta nem duplica subscriptions.
  if (key === currentSessionKey) {
    return;
  }

  const promotion =
    activeController !== undefined &&
    activePresentation !== undefined &&
    activeLive !== undefined &&
    isVersionPromotion(activeLive, event.live);

  if (promotion) {
    // Stop V1 commands/ACKs immediately, but keep its rendered frame visible
    // while the promoted immutable version is loading.
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
    activeController = mountPlayer(root, result.presentation, { controls });
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

// ============================================================
// LIMPEZA DE CICLO DE VIDA DA PÁGINA
// ============================================================

window.addEventListener("pagehide", () => {
  cleanupLiveCurrent?.();
  cleanupLiveCurrent = undefined;

  teardownLiveSession();
});

// ============================================================
// INICIALIZAÇÃO
//
// A entrada padrão "/" resolve sempre a partir de live/current,
// agora de forma reativa (assinatura contínua).
// Parâmetros legados (?publication=, ?version=) são ignorados.
// ============================================================

const { logsEnabled } = parseEntrySearch(window.location.search);

const database = getRealtimeDatabaseOrNull();

if (!database) {
  renderLoadState("Could not load presentation.");
} else {
  renderLoadState("Loading presentation…");

  cleanupLiveCurrent = subscribeLiveCurrent(database, (event) => {
    void handleLiveEvent(event);
  });
}
