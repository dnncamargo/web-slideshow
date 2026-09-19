import type {
  NextConfig,
} from "next";
import { readInstanceDisplayName } from "../../tools/instance-config.mjs";


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
    "@web-slideshow/document-schema",
    "@web-slideshow/renderer",
    "@web-slideshow/theme",
    "@web-slideshow/ui",
    "@web-slideshow/instance-branding",
  ],
  env: {
    WEB_SLIDESHOW_DISPLAY_NAME: readInstanceDisplayName(),
  },
};

// ============================================================
// END: CONFIGURAÇÃO DO POWERSHOW STUDIO
// ============================================================


export default nextConfig;
