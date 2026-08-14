import type {
  Metadata,
} from "next";

import type {
  ReactNode,
} from "react";


// ============================================================
// BEGIN: THEME COMPARTILHADO DO POWERSHOW
//
// O theme deve ser carregado antes do CSS específico
// do Studio, permitindo que globals.css faça overrides
// quando necessário.
// ============================================================

import "@powershow/theme/index.css";

import "./globals.css";

// ============================================================
// END: THEME COMPARTILHADO DO POWERSHOW
// ============================================================

// ============================================================
// BEGIN: STUDIO I18N PROVIDER
// ============================================================

import {
  StudioI18nProvider,
} from "@/features/i18n/studio-i18n-context";

import {
  StudioAuthProvider,
} from "@/features/auth/studio-auth-provider";

// ============================================================
// END: STUDIO I18N PROVIDER
// ============================================================


// ============================================================
// BEGIN: METADATA DO STUDIO
// ============================================================

export const metadata: Metadata = {
  title: "PowerShow Studio",

  description:
    "Create and edit interactive PowerShow presentations.",
};

// ============================================================
// END: METADATA DO STUDIO
// ============================================================


// ============================================================
// BEGIN: ROOT LAYOUT
//
// Não usamos LayoutProps.
//
// O contrato necessário aqui é simplesmente:
// children: ReactNode
// ============================================================

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <StudioI18nProvider>
          <StudioAuthProvider>
            {children}
          </StudioAuthProvider>
        </StudioI18nProvider>
      </body>
    </html>
  );
}

// ============================================================
// END: ROOT LAYOUT
// ============================================================
