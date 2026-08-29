import type { Metadata } from "next";

import { ControlPage } from "@/features/control/control-page";

export const metadata: Metadata = {
  title: "PowerShow Control",
};

export default function StudioControlPage() {
  return <ControlPage />;
}
