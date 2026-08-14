import type { ReactNode } from "react";

import { StudioAuthGate } from "@/features/auth/studio-auth-gate";

// ============================================================
// STUDIO PROTECTED LAYOUT
//
// Protege todas as rotas sob /studio (library, editor, ...) via
// StudioAuthGate. Root "/" continua público.
// ============================================================

export default function StudioLayout({ children }: { children: ReactNode }) {
  return <StudioAuthGate>{children}</StudioAuthGate>;
}
