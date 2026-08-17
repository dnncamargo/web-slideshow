import {
  onValue,
  ref,
  set,
  type DataSnapshot,
  type Database,
} from "firebase/database";

import type { Presentation } from "@powershow/document-schema";
import type { PlayerController } from "./player";

const SLIDE_COMMAND_PATH = "live/slideCommand";

const SLIDE_ACK_PATH = "live/slideAck";

const BASELINE_REVISION = 0;

// ============================================================
// BEGIN: VALIDAÇÃO DE live/slideCommand
//
// Um comando válido exige:
//   - activationRevision: inteiro >= 0
//   - currentVersionId: string não-vazia
//   - revision: inteiro >= 1
//   - pageId: string não-vazia
//
// Retorna null para qualquer valor que não atenda ao contrato.
// ============================================================

export interface SlideCommand {
  activationRevision: number;
  currentVersionId: string;
  revision: number;
  pageId: string;
}

export function parseSlideCommand(value: unknown): SlideCommand | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (Object.keys(record).length !== 4) {
    return null;
  }

  const { activationRevision, currentVersionId, revision, pageId } = record;

  if (
    typeof currentVersionId !== "string" ||
    currentVersionId.trim() === ""
  ) {
    return null;
  }

  if (typeof pageId !== "string" || pageId.trim() === "") {
    return null;
  }

  if (
    typeof activationRevision !== "number" ||
    !Number.isInteger(activationRevision) ||
    activationRevision < 0
  ) {
    return null;
  }

  if (
    typeof revision !== "number" ||
    !Number.isInteger(revision) ||
    revision < 1
  ) {
    return null;
  }

  return {
    activationRevision,
    currentVersionId: currentVersionId.trim(),
    revision,
    pageId: pageId.trim(),
  };
}

// ============================================================
// END: VALIDAÇÃO DE live/slideCommand
// ============================================================

/**
 * Substitui o antigo fluxo de controlSpikes.
 *
 * Após a montagem grava um ACK baseline:
 *   live/slideAck = { activationRevision, currentVersionId, revision: 0,
 *                     pageId, pageIndex }
 *
 * Assina live/slideCommand e aplica comandos mais novos:
 *   - malformados / activationRevision incorreto / revisões antigas -> ignora;
 *   - revisão igual -> não navega de novo, apenas re-ACK do alvo atual;
 *   - revisão mais nova -> resolve pageId -> goTo(pageIndex), lembra a
 *     revisão e ACK no próximo requestAnimationFrame usando o índice real.
 *
 * Se um comando mais novo chegar antes do frame pendente, apenas a revisão
 * mais nova é ACKada (o frame lê o estado no momento em que dispara).
 */
export function subscribeLiveSlideAck(
  database: Database,
  activationRevision: number,
  currentVersionId: string,
  presentation: Presentation,
  controller: PlayerController,
  logsEnabled = false,
  onAckConfirmed: (pageIndex: number) => void = () => undefined,
): () => void {
  let lastAppliedRevision = BASELINE_REVISION;

  let pendingAckFrame: number | null = null;

  let tornDown = false;

  function writeAck(revision: number): void {
    const pageIndex = controller.getCurrentIndex();
    const pageId = presentation.slides[pageIndex]?.id ?? null;

    if (pageId === null) {
      console.error(
        "[PowerShow][live-slide-ack] could not resolve a pageId for the current page",
      );
      return;
    }

    set(ref(database, SLIDE_ACK_PATH), {
      activationRevision,
      currentVersionId,
      revision,
      pageId,
      pageIndex,
    })
      .then(() => {
        if (!tornDown) onAckConfirmed(pageIndex);
      })
      .catch((error: unknown) => {
        console.error("[PowerShow][live-slide-ack] ack write failed", error);
      });
  }

  function scheduleAck(): void {
    if (pendingAckFrame !== null) {
      return;
    }

    pendingAckFrame = requestAnimationFrame(() => {
      pendingAckFrame = null;

      if (tornDown) {
        return;
      }

      writeAck(lastAppliedRevision);
    });
  }

  if (logsEnabled) {
    console.log("[PowerShow][live-slide-ack] subscribing", {
      path: SLIDE_COMMAND_PATH,
      activationRevision,
      currentVersionId,
    });
  }

  writeAck(BASELINE_REVISION);

  const unsubscribe = onValue(
    ref(database, SLIDE_COMMAND_PATH),
    (snapshot: DataSnapshot) => {
      const command = parseSlideCommand(snapshot.val());

      if (command === null) {
        return;
      }

      if (command.activationRevision !== activationRevision) {
        return;
      }

      if (command.currentVersionId !== currentVersionId) {
        return;
      }

      if (command.revision < lastAppliedRevision) {
        return;
      }

      if (command.revision === lastAppliedRevision) {
        writeAck(command.revision);

        return;
      }

      const pageIndex = presentation.slides.findIndex(
        (slide) => slide.id === command.pageId,
      );

      if (pageIndex < 0) {
        console.warn(
          "[PowerShow][live-slide-ack] ignoring command for unknown pageId",
          command.pageId,
        );

        return;
      }

      controller.goTo(pageIndex);

      lastAppliedRevision = command.revision;

      scheduleAck();
    },
    (error: Error) => {
      console.error("[PowerShow][live-slide-ack] subscription error", error);
    },
  );

  return () => {
    tornDown = true;

    if (pendingAckFrame !== null) {
      cancelAnimationFrame(pendingAckFrame);

      pendingAckFrame = null;
    }

    unsubscribe();
  };
}
