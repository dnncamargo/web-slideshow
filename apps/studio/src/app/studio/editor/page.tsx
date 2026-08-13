import { StudioEditorMount } from "@/features/editor/studio-editor-mount";

// ============================================================
// BEGIN: STUDIO EDITOR PAGE
//
// Server-safe wrapper. All sessionStorage access happens in the
// client-only StudioEditorMount component.
// ============================================================

export default function StudioEditorPage() {
  return <StudioEditorMount />;
}

// ============================================================
// END: STUDIO EDITOR PAGE
// ============================================================