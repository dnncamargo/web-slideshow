"use client";

import { useEffect } from "react";

import { useRouter } from "next/navigation";

import type { ReactNode } from "react";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";
import { STUDIO_ROUTES } from "@/features/app/studio-routes";

import { useStudioAuth } from "./studio-auth-provider";

// ============================================================
// STUDIO AUTH GATE
//
// Protege as rotas do Studio:
//
//   loading          → estado neutro
//   unauthenticated  → redireciona para /login
//   authenticated    → renderiza children
// ============================================================

export function StudioAuthGate({ children }: { children: ReactNode }) {
  const { t } = useStudioI18n();
  const router = useRouter();
  const { status } = useStudioAuth();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(STUDIO_ROUTES.login);
    }
  }, [status, router]);

  if (status === "loading" || status === "unauthenticated") {
    return <div>{t("auth.loading")}</div>;
  }

  return <>{children}</>;
}
