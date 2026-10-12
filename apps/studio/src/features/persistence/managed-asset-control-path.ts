import { classifyManagedAssetExtension } from "./managed-asset-content-types";

const ASSET_LEAF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/;
const UUID_WITH_EXTENSION_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(\.[a-z0-9]+)$/i;

export function isManagedAssetControlPath(uid: string, storagePath: unknown): storagePath is string {
  if (typeof storagePath !== "string" || storagePath.length > 512 || /[\x00-\x1f\x7f]/.test(storagePath)) return false;
  const prefix = `users/${uid}/assets/`;
  if (!uid || uid.includes("/") || !storagePath.startsWith(prefix)) return false;
  const leaf = storagePath.slice(prefix.length);
  if (!ASSET_LEAF_PATTERN.test(leaf) || leaf === "." || leaf === ".." || storagePath !== `${prefix}${leaf}`) return false;
  if (leaf.includes(".")) {
    const match = UUID_WITH_EXTENSION_PATTERN.exec(leaf);
    if (!match?.[1] || !classifyManagedAssetExtension(match[1])) return false;
  }
  return true;
}
