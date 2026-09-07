import type { Metadata } from "next";

import { DocsPage } from "./docs-page";

export const metadata: Metadata = {
  title: "PowerShow Docs",
  description: "Documentação de arquitetura, contrato e runtime do PowerShow.",
};

export default function Page() {
  return <DocsPage />;
}
