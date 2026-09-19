import type { Metadata } from "next";
import { displayName } from "@web-slideshow/instance-branding";

import { ControlPage } from "@/features/control/control-page";

export const metadata: Metadata = {
  title: `${displayName} Control`,
};

export default function StudioControlPage() {
  return <ControlPage />;
}
