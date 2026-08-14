import { PresentationSchema, type Presentation } from "@powershow/document-schema";
import { initializeApp, type FirebaseOptions } from "firebase/app";
import { doc, getDoc, getFirestore } from "firebase/firestore/lite";

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

function getFirebaseConfig() {
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
// BEGIN: CARREGAMENTO DE VERSÃO PUBLICADA
//
// Lê exatamente:
//
//   publishedPresentations/{publicationId}/versions/{versionId}
//
// usa getDoc() (sem listeners/query), valida o campo `presentation`
// com PresentationSchema e devolve a Presentation canônica.
// ============================================================

export async function loadPublishedPresentation(
  publicationId: string,
  versionId: string,
): Promise<PublishedLoadResult> {
  if (!isFirebaseConfigured()) {
    console.error("Player: Firebase is not configured for published loading.");

    return { kind: "error" };
  }

  const app = initializeApp(getFirebaseConfig());
  const firestore = getFirestore(app);

  try {
    const ref = doc(
      firestore,
      "publishedPresentations",
      publicationId,
      "versions",
      versionId,
    );
    const snapshot = await getDoc(ref);

    if (!snapshot.exists()) {
      return { kind: "not-found" };
    }

    const data = snapshot.data();

    if (typeof data !== "object" || data === null) {
      return { kind: "not-found" };
    }

    const parsed = PresentationSchema.safeParse(
      (data as { presentation?: unknown }).presentation,
    );

    if (!parsed.success) {
      console.error("Player: published presentation failed schema validation.");

      return { kind: "error" };
    }

    return { kind: "ok", presentation: parsed.data };
  } catch (error) {
    console.error("Player: could not load published presentation", error);

    return { kind: "error" };
  }
}

// ============================================================
// END: CARREGAMENTO DE VERSÃO PUBLICADA
// ============================================================
