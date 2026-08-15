import { get, ref, type Database } from "firebase/database";

import type { PublishedLoadResult } from "./published-presentation-loader";
import type { Presentation } from "@powershow/document-schema";

// ============================================================
// BEGIN: RESULTADOS DA RESOLUÇÃO LIVE
// ============================================================

export interface LiveCurrent {
  publicationId: string;
  currentVersionId: string;
  revision: number;
}

export type ReadLiveCurrentResult =
  | { kind: "no-active" }
  | { kind: "error" }
  | { kind: "ok"; live: LiveCurrent };

// ============================================================
// END: RESULTADOS DA RESOLUÇÃO LIVE
// ============================================================

// ============================================================
// BEGIN: VALIDAÇÃO DE live/current
//
// Valida exatamente:
//   - publicationId: string não-vazia
//   - currentVersionId: string não-vazia
//   - revision: inteiro >= 0
//
// Retorna null para qualquer valor que não atenda ao contrato.
// ============================================================

export function parseLiveCurrent(value: unknown): LiveCurrent | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;

  const publicationId = record.publicationId;
  const currentVersionId = record.currentVersionId;
  const revision = record.revision;

  if (typeof publicationId !== "string" || publicationId.trim() === "") {
    return null;
  }

  if (typeof currentVersionId !== "string" || currentVersionId.trim() === "") {
    return null;
  }

  if (typeof revision !== "number" || !Number.isInteger(revision) || revision < 0) {
    return null;
  }

  return {
    publicationId: publicationId.trim(),
    currentVersionId: currentVersionId.trim(),
    revision,
  };
}

// ============================================================
// END: VALIDAÇÃO DE live/current
// ============================================================

// ============================================================
// BEGIN: LEITURA ÚNICA DE live/current
//
// Lê exatamente uma vez (get/once) — nunca assina nem faz polling.
//
// Semântica de resultado:
//   - snapshot ausente/nulo        → { kind: "no-active" }
//   - snapshot presente porém mal  → { kind: "error" }
//   - leitura/inicialização falha  → { kind: "error" }
//
// Nenhuma falha rejeita para fora do módulo.
// ============================================================

export async function readLiveCurrent(
  database: Database,
): Promise<ReadLiveCurrentResult> {
  try {
    const snapshot = await get(ref(database, "live/current"));

    if (!snapshot.exists()) {
      return { kind: "no-active" };
    }

    const live = parseLiveCurrent(snapshot.val());

    if (live === null) {
      console.error("Player: live/current is malformed.");

      return { kind: "error" };
    }

    return { kind: "ok", live };
  } catch (error) {
    console.error("Player: could not read live/current", error);

    return { kind: "error" };
  }
}

// ============================================================
// END: LEITURA ÚNICA DE live/current
// ============================================================

// ============================================================
// BEGIN: PARÂMETROS DE ENTRADA
//
// A entrada padrão "/" resolve SEMPRE a partir de live/current.
// Os parâmetros legados ?publication= e ?version= são
// deliberadamente ignorados e não afetam a resolução.
// O único parâmetro reconhecido é ?logs= (depuração).
// ============================================================

export interface EntrySearch {
  logsEnabled: boolean;
}

export function parseEntrySearch(search: string): EntrySearch {
  const params = new URLSearchParams(search);

  return { logsEnabled: params.get("logs") === "true" };
}

// ============================================================
// END: PARÂMETROS DE ENTRADA
// ============================================================

// ============================================================
// BEGIN: ORQUESTRAÇÃO DA ENTRADA LIVE
//
// Resultado final da resolução para a entrada padrão "/":
//   - no-active   → nenhuma apresentação ativa em live/current
//   - error       → leitura/inicialização/validação falhou
//   - not-found   → a versão exata não existe em Firestore
//   - ok          → apresentação carregada e validada
//
// Não resolve o pointer público e nunca chama fallback.
// ============================================================

export type LiveMountResult =
  | { kind: "no-active" }
  | { kind: "error" }
  | { kind: "not-found" }
  | { kind: "ok"; publicationId: string; presentation: Presentation };

export type LoadPublishedVersionFn = (
  publicationId: string,
  versionId: string,
) => Promise<PublishedLoadResult>;

export async function resolveLiveMount(
  database: Database,
  loadVersion: LoadPublishedVersionFn,
): Promise<LiveMountResult> {
  const liveResult = await readLiveCurrent(database);

  if (liveResult.kind === "no-active") {
    return { kind: "no-active" };
  }

  if (liveResult.kind === "error") {
    return { kind: "error" };
  }

  const { publicationId, currentVersionId } = liveResult.live;

  const versionResult = await loadVersion(publicationId, currentVersionId);

  if (versionResult.kind === "not-found") {
    return { kind: "not-found" };
  }

  if (versionResult.kind === "error") {
    return { kind: "error" };
  }

  return { kind: "ok", publicationId, presentation: versionResult.presentation };
}

// ============================================================
// END: ORQUESTRAÇÃO DA ENTRADA LIVE
// ============================================================
