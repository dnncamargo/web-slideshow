import { createUniqueId } from "./preset-structure";

const DUPLICATE_SUFFIX = /-copy(?:-\d+)?$/;

function duplicateFamilyRoot(sourceId: string): string {
  let root = sourceId;

  while (DUPLICATE_SUFFIX.test(root)) {
    root = root.replace(DUPLICATE_SUFFIX, "");
  }

  return root;
}

/**
 * Allocates the next ID in the duplicate family rooted at sourceId.
 *
 * Only the trailing duplicate genealogy is normalized. Ordinary IDs such as
 * "copy-machine" and "topic-copy-value" remain untouched.
 */
export function allocateDuplicateId(
  sourceId: string,
  usedIds: Set<string>,
): string {
  return createUniqueId(`${duplicateFamilyRoot(sourceId)}-copy`, usedIds);
}
