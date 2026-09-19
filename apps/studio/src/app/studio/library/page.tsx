import type { Metadata } from "next";
import { displayName } from "@web-slideshow/instance-branding";

import { PresentationLibrary } from "@/features/library/presentation-library";

export const metadata: Metadata = {
  title: `${displayName} Library`,
};

export default function StudioLibraryPage() {
  return <PresentationLibrary />;
}
