import type { ReactNode } from "react";

import { StudioAuthGate } from "@/features/auth/studio-auth-gate";

import { ControlPage } from "@/features/control/control-page";

export default function ControlRouteWrapper() {
  return (
    <StudioAuthGate>
      <ControlPage />
    </StudioAuthGate>
  );
}
