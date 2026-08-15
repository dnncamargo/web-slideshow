import {
  onValue,
  ref,
  set,
  type DataSnapshot,
  type Database,
} from "firebase/database";

import type { PlayerController } from "./player";

const SLIDE_COMMAND_PATH = "live/slideCommand";

const SLIDE_ACK_PATH = "live/slideAck";

const BASELINE_REVISION = 0;

// ============================================================
// BEGIN: VALIDAÇÃO DE live/slideCommand
//
// Um comando válido exige:
//   - activationRevision: inteiro >= 0
//   - revision: inteiro >= 1
//   - slideIndex: inteiro >= 0
//
// Retorna null para qualquer valor que não atenda ao contrato.
// ============================================================

export interface SlideCommand {
  activationRevision: number;
  revision: number;
  slideIndex: number;
}

export function parseSlideCommand(value: unknown): SlideCommand | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (Object.keys(record).length !== 3) {
    return null;
  }

  const { activationRevision, revision, slideIndex } = record;

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

  if (
    typeof slideIndex !== "number" ||
    !Number.isInteger(slideIndex) ||
    slideIndex < 0
  ) {
    return null;
  }

  return { activationRevision, revision, slideIndex };
}

// ============================================================
// END: VALIDAÇÃO DE live/slideCommand
// ============================================================

/**
 * Substitui o antigo fluxo de controlSpikes.
 *
 * Após a montagem grava um ACK baseline:
 *   live/slideAck = { activationRevision, revision: 0, slideIndex: atual }
 *
 * Assina live/slideCommand e aplica comandos mais novos:
 *   - malformados / activationRevision incorreto / revisões antigas → ignora;
 *   - revisão igual → não navega de novo, apenas re-ACK do índice atual;
 *   - revisão mais nova → goTo(slideIndex), lembra a revisão e ACK no próximo
 *     requestAnimationFrame usando o índice real.
 *
 * Se um comando mais novo chegar antes do frame pendente, apenas a revisão
 * mais nova é ACKada (o frame lê o estado no momento em que dispara).
 */
export function subscribeLiveSlideAck(
  database: Database,
  activationRevision: number,
  controller: PlayerController,
  logsEnabled = false,
): () => void {
  let lastAppliedRevision = BASELINE_REVISION;

  let pendingAckFrame: number | null = null;

  let tornDown = false;

  function writeAck(revision: number): void {
    set(ref(database, SLIDE_ACK_PATH), {
      activationRevision,
      revision,
      slideIndex: controller.getCurrentIndex(),
    }).catch((error: unknown) => {
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

      if (command.revision < lastAppliedRevision) {
        return;
      }

      if (command.revision === lastAppliedRevision) {
        writeAck(command.revision);

        return;
      }

      controller.goTo(command.slideIndex);

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
