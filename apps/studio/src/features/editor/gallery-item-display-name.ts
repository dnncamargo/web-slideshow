import type { GalleryElement } from "@powershow/document-schema";

export function getGalleryItemDisplayName(
  item: GalleryElement["items"][number],
  fallback: string,
): string {
  return item.alt.trim() || fallback;
}
