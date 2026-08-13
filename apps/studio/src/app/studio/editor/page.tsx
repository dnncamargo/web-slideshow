"use client";

import { readOpenedPresentation } from "@/features/editor/opened-presentation-store";
import {
  EditorWorkspace,
} from "@/features/editor/editor-workspace";

// ============================================================
// BEGIN: STUDIO EDITOR PAGE
// ============================================================

export default function StudioEditorPage() {
  return (
    <EditorWorkspace
      initialPresentation={readOpenedPresentation() ?? undefined}
    />
  );
}

// ============================================================
// END: STUDIO EDITOR PAGE
// ============================================================
