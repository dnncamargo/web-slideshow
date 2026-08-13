import { StudioEditorMount } from "@/features/editor/studio-editor-mount";

interface StudioEditorPageProps {
  searchParams: Promise<{ id?: string | string[] }>;
}

// ============================================================
// BEGIN: STUDIO EDITOR PAGE
//
// Server-safe wrapper. Resolves the persisted Presentation id from the URL
// and hands it to the client-only StudioEditorMount, which loads the
// Presentation through the repository.
// ============================================================

export default async function StudioEditorPage({
  searchParams,
}: StudioEditorPageProps) {
  const params = await searchParams;
  const rawId = params.id;
  const presentationId = Array.isArray(rawId) ? rawId[0] : rawId;

  if (!presentationId) {
    return <StudioEditorMount presentationId={null} />;
  }

  return <StudioEditorMount presentationId={presentationId} />;
}

// ============================================================
// END: STUDIO EDITOR PAGE
// ============================================================