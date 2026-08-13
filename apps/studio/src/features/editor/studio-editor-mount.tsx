"use client";

import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import { readOpenedPresentation } from "@/features/editor/opened-presentation-store";
import { EditorWorkspace } from "@/features/editor/editor-workspace";
import { STUDIO_ROUTES } from "@/features/app/studio-routes";

/**
 * Client-only editor mount wrapper.
 *
 * Reads the opened Presentation from sessionStorage only after the component
 * mounts in the browser. Until then a loading shell is shown so the demo
 * Presentation is never substituted during server or initial render.
 *
 * If no handoff Presentation exists, the user is sent back to the Library.
 */
export function StudioEditorMount() {
  const router = useRouter();
  const [presentation, setPresentation] = useState<"loading" | "missing" | { value: import("@powershow/document-schema").Presentation }>(
    "loading",
  );

  useEffect(() => {
    const opened = readOpenedPresentation();

    if (opened) {
      setPresentation({ value: opened });
    } else {
      setPresentation("missing");
      router.replace(STUDIO_ROUTES.library);
    }
  }, [router]);

  if (presentation === "loading") {
    return <div>Loading…</div>;
  }

  if (presentation === "missing") {
    return <div>Loading…</div>;
  }

  return <EditorWorkspace initialPresentation={presentation.value} />;
}