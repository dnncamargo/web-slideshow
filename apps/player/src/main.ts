import "@powershow/theme/index.css";
import "./player.css";

import { loadPublishedVersion } from "./published-presentation-loader";

import { getRealtimeDatabaseOrNull } from "./realtime-db";
import { parseEntrySearch, resolveLiveMount } from "./live-entry";
import { subscribeLiveSlideAck } from "./live-slide-ack";

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
let cleanupLiveSlideAck: (() => void) | undefined;

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
// SLIDE STATE LIVE (ACK)
// ============================================================

function attachLiveSlideAck(
  activationRevision: number,
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
          "[PowerShow][live-slide-ack] RTDB unavailable – live slide ACK not attached",
        );
      }
      return;
    }

    cleanupLiveSlideAck = subscribeLiveSlideAck(
      database,
      activationRevision,
      activeController,
      logsEnabled,
    );
  } catch (error) {
    // Falha de inicialização do slide ACK nunca derruba o Player.
    console.error("Player: live slide ACK initialization failed", error);
  }
}

// ============================================================
// ENTRADA LIVE
//
// Fluxo:
//   1. lê live/current uma única vez;
//   2. valida publicationId / currentVersionId / revision;
//   3. carrega a versão exata em Firestore;
//   4. valida a Presentation com o schema canônico;
//   5. monta o Player e inicia o slide state (live ACK).
//
// Não resolve o pointer público. Não assina/polling live/current.
// Sem fallback para a demo ou para parâmetros legados.
// ============================================================

async function mountLive(): Promise<void> {
  renderLoadState("Loading presentation…");

  const database = getRealtimeDatabaseOrNull();

  if (!database) {
    renderLoadState("Could not load presentation.");

    return;
  }

  const result = await resolveLiveMount(database, loadPublishedVersion);

  if (result.kind === "no-active") {
    renderNoActive();

    return;
  }

  if (result.kind === "ok") {
    activeController = mountPlayer(root, result.presentation, { controls });

    attachLiveSlideAck(result.activationRevision, logsEnabled);

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
  cleanupLiveSlideAck?.();

  cleanupLiveSlideAck = undefined;

  activeController?.destroy();

  activeController = undefined;
});

// ============================================================
// INICIALIZAÇÃO
//
// A entrada padrão "/" resolve sempre a partir de live/current.
// Parâmetros legados (?publication=, ?version=) são ignorados.
// ============================================================

const { logsEnabled } = parseEntrySearch(window.location.search);

void mountLive();
