import type { Metadata } from "next";

import { PresentationLibrary } from "@/features/library/presentation-library";

export const metadata: Metadata = {
  title: "PowerShow Library",
};

export default function StudioLibraryPage() {
  return <PresentationLibrary />;
}
