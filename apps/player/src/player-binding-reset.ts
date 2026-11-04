function bindingUnchanged(current: unknown, expected: unknown): boolean {
  if (typeof current !== "object" || current === null) return false;
  if (typeof expected !== "object" || expected === null) return false;
  const currentRecord = current as Record<string, unknown>;
  const expectedRecord = expected as Record<string, unknown>;
  const currentKeys = Object.keys(currentRecord).sort();
  const expectedKeys = Object.keys(expectedRecord).sort();
  return currentKeys.length === expectedKeys.length &&
    currentKeys.every((key, index) => key === expectedKeys[index]) &&
    currentRecord.ownerUid === expectedRecord.ownerUid &&
    currentRecord.displayName === expectedRecord.displayName;
}

/** Shared updater for Player's conditional binding removal transaction. */
export function playerBindingRemovalUpdater(
  expectedBinding: unknown,
  onDecision?: (decision: "local-cache-empty" | "remove" | "changed") => void,
): (current: unknown) => null | undefined {
  return (current) => {
    // RTDB transactions may first call the updater with null before this
    // client has cached the server value, even after a one-shot get(). Propose
    // deletion in that case so the server hash check reloads the current value
    // and retries this same comparison before accepting the write.
    if (current === null && typeof expectedBinding === "object" && expectedBinding !== null) {
      onDecision?.("local-cache-empty");
      return null;
    }
    if (bindingUnchanged(current, expectedBinding)) {
      onDecision?.("remove");
      return null;
    }
    onDecision?.("changed");
    return undefined;
  };
}
