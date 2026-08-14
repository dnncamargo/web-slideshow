import "@powershow/theme/index.css";
import "./player.css";

import { demoPresentation } from "./demo-presentation";

import { loadPublishedPresentation } from "./published-presentation-loader";

import { getRealtimeDatabaseOrNull } from "./realtime-db";
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
  // ======================================================
  // TESTE VISUAL TEMPORÁRIO
  // ======================================================

  position: "bottom-right",

  style: "compact",

  showCounter: true,

  animation: "fade",
} as const;

let activeController: PlayerController | undefined;
let cleanupRemoteControl: (() => void) | undefined;

// ============================================================
// MODO DEMO (sem parâmetros de publicação)
//
// Preserva exatamente o comportamento antigo: renderiza a
// demoPresentation imediatamente.
// ============================================================

function mountDemo(): void {
  activeController = mountPlayer(root, demoPresentation, { controls });
}

// ============================================================
// CARGA DE VERSÃO PUBLICADA
// ============================================================

function renderLoadState(message: string): void {
  root.innerHTML = `
    <div class="powershow-player-load-state">
      ${message}
    </div>
  `;
}

function attachRemoteControl(publicationId: string): void {
  if (!activeController) {
    return;
  }

  try {
    const database = getRealtimeDatabaseOrNull();

    if (!database) {
      console.warn(
        "[PowerShow][remote-control] RTDB unavailable – remote control not attached",
      );
      return;
    }

    console.log(
      "[PowerShow][remote-control] attaching",
      { publicationId },
    );

    cleanupRemoteControl = subscribeRemoteControl(
      database,
      publicationId,
      activeController,
    );
  } catch (error) {
    // Falha de inicialização do controle remoto nunca derruba o Player.
    console.error("Player: remote control initialization failed", error);
  }
}

async function mountPublished(publicationId: string, versionId: string): Promise<void> {
  renderLoadState("Loading presentation…");

  const result = await loadPublishedPresentation(publicationId, versionId);

  if (result.kind === "ok") {
    activeController = mountPlayer(root, result.presentation, { controls });

    attachRemoteControl(publicationId);

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
// SELEÇÃO DE URL
// ============================================================

const params = new URLSearchParams(window.location.search);

const publicationId = params.get("publication");
const versionId = params.get("version");

if (publicationId !== null && versionId !== null) {
  void mountPublished(publicationId, versionId);
} else {
  mountDemo();
}
