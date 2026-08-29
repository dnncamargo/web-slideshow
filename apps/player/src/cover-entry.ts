import { getRealtimeDatabaseOrNull } from "./realtime-db";
import { loadPublishedVersion } from "./published-presentation-loader";
import { resolveLiveMount } from "./live-entry";
import {
  mountProjectionSurface,
  type ProjectionSurface,
} from "./projection-surface";

const COVER_COPY = {
  unavailable: "Nenhuma apresentação ao vivo",
  loading: "Carregando…",
  error: "Não foi possível carregar a apresentação.",
} as const;

export interface CoverController {
  destroy(): void;
}

function renderMessage(root: HTMLElement, message: string, loading = false): void {
  root.innerHTML = `
    <div class="powershow-player-load-state" data-loading="${loading}">
      <span>${message}</span>
      <span class="powershow-player-load-indicator" aria-hidden="true"></span>
    </div>
  `;
}

/** Boots a one-shot, read-only projection of the active presentation cover. */
export function startCover(root: HTMLElement): CoverController {
  let projection: ProjectionSurface | null = null;
  let destroyed = false;

  const database = getRealtimeDatabaseOrNull();
  if (database === null) {
    renderMessage(root, COVER_COPY.unavailable);
  } else {
    renderMessage(root, COVER_COPY.loading, true);
    void resolveLiveMount(database, loadPublishedVersion).then((result) => {
      if (destroyed) return;

      if (result.kind === "ok") {
        if (result.presentation.slides.length === 0) {
          renderMessage(root, COVER_COPY.unavailable);
          return;
        }
        projection = mountProjectionSurface(root, result.presentation, {
          transition: "none",
        });
        return;
      }

      renderMessage(
        root,
        result.kind === "no-active" ? COVER_COPY.unavailable : COVER_COPY.error,
      );
    });
  }

  let controller: CoverController;
  const handlePagehide = (): void => controller.destroy();
  window.addEventListener("pagehide", handlePagehide, { once: true });

  controller = {
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      window.removeEventListener("pagehide", handlePagehide);
      projection?.destroy();
      projection = null;
    },
  };

  return controller;
}
