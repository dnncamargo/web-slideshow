import "@powershow/theme/index.css";
import "./player.css";

import { demoPresentation } from "./demo-presentation";

import { loadPublishedPresentation } from "./published-presentation-loader";

import { mountPlayer } from "./player";

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

// ============================================================
// MODO DEMO (sem parâmetros de publicação)
//
// Preserva exatamente o comportamento antigo: renderiza a
// demoPresentation imediatamente.
// ============================================================

function mountDemo(): void {
  mountPlayer(root, demoPresentation, { controls });
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

async function mountPublished(publicationId: string, versionId: string): Promise<void> {
  renderLoadState("Loading presentation…");

  const result = await loadPublishedPresentation(publicationId, versionId);

  if (result.kind === "ok") {
    mountPlayer(root, result.presentation, { controls });

    return;
  }

  if (result.kind === "not-found") {
    renderLoadState("Presentation not found.");

    return;
  }

  renderLoadState("Could not load presentation.");
}

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
