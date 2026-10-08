const LIVE_ROOT = "live";

function requireOwnerUid(ownerUid: string): string {
  const trimmed = ownerUid.trim();
  if (trimmed === "" || trimmed.includes("/") || trimmed.includes(".")) {
    throw new Error("Live owner UID is invalid.");
  }
  return trimmed;
}

export function buildLiveRoot(ownerUid: string): string {
  return `${LIVE_ROOT}/${requireOwnerUid(ownerUid)}`;
}

export function buildLivePath(ownerUid: string, child: string): string {
  const trimmedChild = child.replace(/^\/+|\/+$/g, "");
  if (trimmedChild === "" || trimmedChild.includes("..")) {
    throw new Error("Live child path is invalid.");
  }
  return `${buildLiveRoot(ownerUid)}/${trimmedChild}`;
}
