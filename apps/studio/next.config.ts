import type {
  NextConfig,
} from "next";


// ============================================================
// BEGIN: CONFIGURAÇÃO DO POWERSHOW STUDIO
// ============================================================

const nextConfig: NextConfig = {
  // ----------------------------------------------------------
  // Packages internos do monorepo.
  //
  // O Studio usa diretamente o código TypeScript desses
  // packages, portanto deixamos isso explícito para o Next.
  // ----------------------------------------------------------

  transpilePackages: [
    "@powershow/document-schema",
    "@powershow/renderer",
    "@powershow/theme",
    "@powershow/ui",
  ],
};

// ============================================================
// END: CONFIGURAÇÃO DO POWERSHOW STUDIO
// ============================================================


export default nextConfig;
