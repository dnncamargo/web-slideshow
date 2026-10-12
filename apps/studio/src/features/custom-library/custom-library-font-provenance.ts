import type { FontFaceResource } from "@web-slideshow/document-schema";

import type { CustomLibraryFontFace } from "./custom-library-font";

const MANAGED_ASSET_PATH = /^\/users\/([^/]+)\/assets\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.(ttf|otf|woff|woff2)$/i;

export type FontFaceRemovalSafety = "removable" | "managed" | "ambiguous-managed";

export function managedFontPathFromUrl(value: string, ownerId: string): { pathname: string; assetId: string } | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !url.hostname.endsWith(".public.blob.vercel-storage.com")) return null;
    const match = MANAGED_ASSET_PATH.exec(url.pathname);
    if (!match || decodeURIComponent(match[1] ?? "") !== ownerId) return null;
    return { pathname: url.pathname.slice(1), assetId: match[2] ?? "" };
  } catch {
    return null;
  }
}

export function fontFaceRemovalSafety(face: CustomLibraryFontFace, ownerId: string): FontFaceRemovalSafety {
  if (face.provenance?.kind === "managed-upload") return "managed";
  try {
    const url = new URL(face.source.url);
    const decodedPath = decodeURIComponent(url.pathname);
    if (url.protocol === "https:" && url.hostname.endsWith(".public.blob.vercel-storage.com")) {
      const pathOwner = /^\/users\/([^/]+)\/assets\//.exec(decodedPath)?.[1];
      if (!pathOwner) return "removable";
      if (pathOwner !== ownerId) return "ambiguous-managed";
      return managedFontPathFromUrl(face.source.url, ownerId) ? "managed" : "ambiguous-managed";
    }
  } catch {
    return "ambiguous-managed";
  }
  return "removable";
}

export function toPresentationFontFace(face: CustomLibraryFontFace): FontFaceResource {
  const resource = { ...face };
  Reflect.deleteProperty(resource, "provenance");
  return resource;
}

export function hasSameFontFaceIdentity(first: CustomLibraryFontFace, second: CustomLibraryFontFace): boolean {
  return first.source.url === second.source.url
    && first.weight === second.weight
    && first.style === second.style
    && first.subset === second.subset
    && first.unicodeRange === second.unicodeRange;
}
