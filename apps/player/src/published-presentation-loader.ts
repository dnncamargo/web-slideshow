import { PresentationSchema, type Presentation } from "@powershow/document-schema";
import { getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { doc, getDoc, getFirestore } from "firebase/firestore/lite";

import { recordPlayerDiagnostic } from "./player-diagnostics";

// ============================================================
// BEGIN: RESULTADOS DA CARGA
// ============================================================

export type PublishedLoadResult =
  | { kind: "not-found" }
  | { kind: "error" }
  | { kind: "ok"; presentation: Presentation };

// ============================================================
// END: RESULTADOS DA CARGA
// ============================================================

// ============================================================
// BEGIN: CONFIGURAÇÃO FIREBASE DO PLAYER (VITE)
//
// Usamos variáveis de ambiente Vite (VITE_) e um único app Lite.
// Nenhum Firebase Auth é inicializado aqui.
// ============================================================

function getFirebaseConfig(): FirebaseOptions {
  const entries: Array<[string, string | undefined]> = [
    ["apiKey", import.meta.env.VITE_FIREBASE_API_KEY as string | undefined],
    ["authDomain", import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined],
    ["projectId", import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined],
    ["storageBucket", import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined],
    ["messagingSenderId", import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined],
    ["appId", import.meta.env.VITE_FIREBASE_APP_ID as string | undefined],
  ];

  const config: Record<string, string> = {};

  for (const [key, value] of entries) {
    if (value !== undefined && value.trim() !== "") {
      config[key] = value;
    }
  }

  return config as FirebaseOptions;
}

function isFirebaseConfigured(): boolean {
  const config = getFirebaseConfig();

  return Boolean(config.apiKey) && Boolean(config.authDomain) && Boolean(config.projectId);
}

// ============================================================
// BEGIN: OBTENÇÃO DO APP FIREBASE
// ============================================================

function getOrInitFirebaseApp(): FirebaseApp {
  const existing = getApps()[0];

  if (existing) {
    return existing;
  }

  return initializeApp(getFirebaseConfig());
}

// ============================================================
// END: OBTENÇÃO DO APP FIREBASE
// ============================================================

// ============================================================
// BEGIN: CARREGAMENTO DE VERSÃO PUBLICADA VIA POINTER
//
// Lê exatamente:
//
//   1. publishedPresentations/{publicationId}           (pointer)
//   2. publishedPresentations/{publicationId}/versions/{currentVersionId}
//
// usa getDoc() (sem listeners/query), extrai currentVersionId do
// pointer, resolve a versão imutável apontada e valida o campo
// `presentation` com PresentationSchema.
//
// Toda a inicialização/leitura está dentro do erro boundary:
// qualquer falha de SDK/config/runtime é capturada, registrada e
// convertida em { kind: "error" } — nunca rejeita para fora.
// ============================================================

// ============================================================
// BEGIN: CARREGAMENTO DE VERSÃO EXATA
//
// Lê exatamente:
//
//   publishedPresentations/{publicationId}/versions/{versionId}
//
// usa getDoc() (sem listeners/query), valida o campo `presentation`
// com PresentationSchema e reutiliza o erro boundary do loader.
//
// Toda a inicialização/leitura está dentro do erro boundary:
// qualquer falha de SDK/config/runtime é capturada, registrada e
// convertida em { kind: "error" } — nunca rejeita para fora.
// ============================================================

export async function loadPublishedVersion(
  publicationId: string,
  versionId: string,
): Promise<PublishedLoadResult> {
  const loadStartedAt = Date.now();

  recordPlayerDiagnostic("FIRESTORE_LOAD_START");

  try {
    if (!isFirebaseConfigured()) {
      console.error("Player: Firebase is not configured for published loading.");

      recordPlayerDiagnostic("FIRESTORE_CONFIG_MISSING");

      return { kind: "error" };
    }

    const app = getOrInitFirebaseApp();
    const firestore = getFirestore(app);

    const versionRef = doc(
      firestore,
      "publishedPresentations",
      publicationId,
      "versions",
      versionId,
    );
    const versionSnapshot = await getDoc(versionRef);

    if (!versionSnapshot.exists()) {
      recordPlayerDiagnostic("FIRESTORE_LOAD_NOT_FOUND", {
        durationMs: Date.now() - loadStartedAt,
      });

      return { kind: "not-found" };
    }

    const versionData = versionSnapshot.data();

    if (typeof versionData !== "object" || versionData === null) {
      recordPlayerDiagnostic("FIRESTORE_LOAD_NOT_FOUND", {
        durationMs: Date.now() - loadStartedAt,
      });

      return { kind: "not-found" };
    }

    const parsed = PresentationSchema.safeParse(
      (versionData as { presentation?: unknown }).presentation,
    );

    if (!parsed.success) {
      console.error("Player: published presentation failed schema validation.");

      recordPlayerDiagnostic("FIRESTORE_SCHEMA_ERROR", {
        durationMs: Date.now() - loadStartedAt,
      });

      return { kind: "error" };
    }

    recordPlayerDiagnostic("FIRESTORE_LOAD_OK", {
      durationMs: Date.now() - loadStartedAt,
    });

    return { kind: "ok", presentation: parsed.data };
  } catch (error) {
    console.error("Player: could not load published presentation", error);

    recordPlayerDiagnostic("FIRESTORE_LOAD_ERROR", {
      error,
      durationMs: Date.now() - loadStartedAt,
    });

    return { kind: "error" };
  }
}

// ============================================================
// END: CARREGAMENTO DE VERSÃO EXATA
// ============================================================

export async function loadPublishedPresentation(
  publicationId: string,
): Promise<PublishedLoadResult> {
  try {
    if (!isFirebaseConfigured()) {
      console.error("Player: Firebase is not configured for published loading.");

      return { kind: "error" };
    }

    const app = getOrInitFirebaseApp();
    const firestore = getFirestore(app);

    // 1. Resolve o pointer público
    const pointerRef = doc(
      firestore,
      "publishedPresentations",
      publicationId,
    );
    const pointerSnapshot = await getDoc(pointerRef);

    if (!pointerSnapshot.exists()) {
      return { kind: "not-found" };
    }

    const pointerData = pointerSnapshot.data();

    if (
      typeof pointerData !== "object" ||
      pointerData === null ||
      typeof (pointerData as { currentVersionId?: unknown }).currentVersionId !== "string" ||
      (pointerData as { currentVersionId: string }).currentVersionId.trim() === ""
    ) {
      console.error("Player: publication pointer is malformed.");

      return { kind: "error" };
    }

    const currentVersionId = (pointerData as { currentVersionId: string }).currentVersionId.trim();

    // 2. Lê a versão imutável apontada, reutilizando a validação exata.
    return loadPublishedVersion(publicationId, currentVersionId);
  } catch (error) {
    console.error("Player: could not load published presentation", error);

    return { kind: "error" };
  }
}

// ============================================================
// END: CARREGAMENTO DE VERSÃO PUBLICADA
// ============================================================
