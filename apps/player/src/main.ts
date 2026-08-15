import "@powershow/theme/index.css";
import "./player.css";

import { loadPublishedVersion } from "./published-presentation-loader";

import { getRealtimeDatabaseOrNull } from "./realtime-db";
import { parseEntrySearch, resolveLiveMount } from "./live-entry";
import { subscribeRemoteControl } from "./remote-control";

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
let cleanupRemoteControl: (() => void) | undefined;

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
// CONTROLE REMOTO
// ============================================================

function attachRemoteControl(publicationId: string, logsEnabled: boolean): void {
  if (!activeController) {
    return;
  }

  try {
    const database = getRealtimeDatabaseOrNull();

    if (!database) {
      if (logsEnabled) {
        console.warn(
          "[PowerShow][remote-control] RTDB unavailable – remote control not attached",
        );
      }
      return;
    }

    if (logsEnabled) {
      console.log(
        "[PowerShow][remote-control] attaching",
        { publicationId },
      );
    }

    cleanupRemoteControl = subscribeRemoteControl(
      database,
      publicationId,
      activeController,
      logsEnabled,
    );
  } catch (error) {
    // Falha de inicialização do controle remoto nunca derruba o Player.
    console.error("Player: remote control initialization failed", error);
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
//   5. monta o Player e inicia o controle remoto.
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

    attachRemoteControl(result.publicationId, logsEnabled);

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
  cleanupRemoteControl?.();

  cleanupRemoteControl = undefined;

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
