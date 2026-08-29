import { onValue, ref, type Database } from "firebase/database";

import type { PlayerController } from "./player";

export const FULLSCREEN_REQUEST_PATH = "live/fullscreenRequest";

export interface FullscreenRequest {
  activationRevision: number;
  currentVersionId: string;
  revision: number;
}

function isNonNegativeInteger(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0
  );
}

function isPositiveInteger(value: unknown): value is number {
  return isNonNegativeInteger(value) && value >= 1;
}

export function parseFullscreenRequest(value: unknown): FullscreenRequest | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (Object.keys(record).length !== 3) {
    return null;
  }

  if (
    !isNonNegativeInteger(record.activationRevision) ||
    typeof record.currentVersionId !== "string" ||
    record.currentVersionId.trim() === "" ||
    !isPositiveInteger(record.revision)
  ) {
    return null;
  }

  return {
    activationRevision: record.activationRevision,
    currentVersionId: record.currentVersionId.trim(),
    revision: record.revision,
  };
}

function requestButton(root: HTMLElement): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "powershow-player-fullscreen-request";
  button.textContent = "Enter fullscreen";
  button.setAttribute("aria-label", "Enter fullscreen");
  root.appendChild(button);
  return button;
}

/** Subscribes to an activation-scoped fullscreen intent without remotely invoking the Fullscreen API. */
export function subscribeLiveFullscreenRequest(
  database: Database,
  activationRevision: number,
  currentVersionId: string,
  controller: PlayerController,
  root: HTMLElement,
): () => void {
  let highestRevisionSeen = 0;
  let pendingRevision: number | null = null;
  let button: HTMLButtonElement | null = null;
  let tornDown = false;

  function dismiss(): void {
    button?.removeEventListener("click", handleButtonClick);
    button?.remove();
    button = null;
    pendingRevision = null;
  }

  function handleButtonClick(): void {
    const revision = pendingRevision;

    if (revision === null || tornDown) {
      return;
    }

    if (document.fullscreenElement !== null) {
      dismiss();
      return;
    }

    void controller.fullscreen()
      .then(() => {
        if (tornDown) {
          return;
        }

        if (pendingRevision === revision) {
          dismiss();
        }
      })
      .catch(() => {
        // Keep the request visible so a trusted local interaction can retry.
      });
  }

  function showRequest(revision: number): void {
    pendingRevision = revision;

    if (button === null) {
      button = requestButton(root);
      button.addEventListener("click", handleButtonClick);
    }
  }

  const unsubscribe = onValue(
    ref(database, FULLSCREEN_REQUEST_PATH),
    (snapshot) => {
      const request = parseFullscreenRequest(snapshot.val());

      if (
        request === null ||
        request.activationRevision !== activationRevision ||
        request.currentVersionId !== currentVersionId ||
        request.revision <= highestRevisionSeen
      ) {
        return;
      }

      highestRevisionSeen = request.revision;

      if (document.fullscreenElement !== null) {
        dismiss();
        return;
      }

      showRequest(request.revision);
    },
  );

  return () => {
    tornDown = true;
    dismiss();
    unsubscribe();
  };
}
