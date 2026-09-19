import type { Metadata } from "next";
import { displayName } from "@web-slideshow/instance-branding";

import { DocsPage } from "./docs-page";

export const metadata: Metadata = {
  title: `${displayName} Docs`,
  description: "Documentação de arquitetura, contrato e runtime da aplicação.",
};

export default function Page() {
  return <DocsPage />;
}
