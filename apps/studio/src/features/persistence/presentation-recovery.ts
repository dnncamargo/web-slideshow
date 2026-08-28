import type { Presentation, PowerShowElement } from "@powershow/document-schema";
import {
  PowerShowElementSchema,
  PresentationSchema,
  resolveTextStyle,
  SlideSchema,
} from "@powershow/document-schema";

// ============================================================
// PRESENTATION RECOVERY ANALYSIS
//
// Safe recovery for persisted PowerShow presentations that fail
// canonical PresentationSchema validation.
//
// FROZEN PRINCIPLE: preserve canonical content, remove incompatible
// semantic units. This is NOT a migration system: incompatible fields
// are never invented, reinterpreted, synthesized, or migrated.
//
// Specifically for old/incompatible Blocks: if the current Blocks
// validates it is kept; if it fails validation the WHOLE Blocks
// element is removed. Blocks are never internally repaired.
// ============================================================

export type RecoveryIssueKind = "element" | "slide";

export type RecoveryIssueAction = "remove";

export interface RecoveryIssue {
  kind: RecoveryIssueKind;

  path: (string | number)[];

  action: RecoveryIssueAction;

  id?: string;

  elementType?: string;

  reason: string;
}

export type PresentationRecoveryStatus = "valid" | "recoverable" | "unrecoverable";

export interface PresentationRecoveryAnalysis {
  status: PresentationRecoveryStatus;

  presentation: Presentation | null;

  issues: RecoveryIssue[];
}

export const RECOVERY_REASON = {
  invalidPresentationStructure: "Invalid presentation structure",
  invalidSlideStructure: "Invalid slide structure",
  invalidElement: "Invalid element",
  invalidBlocksElement: "Invalid Blocks element",
  invalidContainerStructure: "Invalid container structure",
  invalidTopicsStructure: "Invalid Topics structure",
  invalidStructuredTable: "Invalid structured table",
  invalidTable: "Invalid table",
  finalPresentationInvalid: "Recovered presentation is still invalid",
} as const;

// ------------------------------------------------------------
// Small structural helpers
// ------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRecordArray(value: unknown): value is Record<string, unknown>[] {
  return (
    Array.isArray(value) &&
    value.every((entry) => isRecord(entry))
  );
}

// ------------------------------------------------------------
// Neutralization shells
//
// A shell preserves every structural field of a unit while replacing
// ONLY the "content" PowerShowElement arrays with []. The shell is
// validated to decide whether the surrounding structure itself is
// canonical; if it is not, the whole unit is removed.
// ------------------------------------------------------------

function withContainerShell(raw: Record<string, unknown>): Record<string, unknown> {
  return { ...raw, children: [] };
}

function withTopicsShell(items: Record<string, unknown>[]): Record<string, unknown>[] {
  return items.map((item) => ({
    ...item,
    content: {
      ...(item.content as Record<string, unknown>),
      children: [],
    },
    children: withTopicsShell(item.children as Record<string, unknown>[]),
  }));
}

function withStructuredTableShell(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...raw,
    columns: (raw.columns as Record<string, unknown>[]).map((column) => ({
      ...column,
      header: {
        ...(column.header as Record<string, unknown>),
        children: [],
      },
    })),
    rows: (raw.rows as Record<string, unknown>[]).map((row) => ({
      ...row,
      cells: (row.cells as Record<string, unknown>[]).map((cell) => ({
        ...cell,
        children: [],
      })),
    })),
  };
}

// ------------------------------------------------------------
// Element recovery
// ------------------------------------------------------------

/**
 * Recursively recovers a PowerShowElement array, removing incompatible
 * units and preserving structurally valid parents.
 *
 * The supplied value MUST be an array; callers validate the structural
 * requirement before invoking this helper.
 */
function recoverElements(
  rawElements: unknown,
  pathBase: (string | number)[],
  issues: RecoveryIssue[],
  typographyContext: Presentation,
): PowerShowElement[] {
  const recovered: PowerShowElement[] = [];

  if (!Array.isArray(rawElements)) {
    return recovered;
  }

  rawElements.forEach((rawElement, index) => {
    const path = [...pathBase, index];

    const element = recoverElement(rawElement, path, issues, typographyContext);

    if (element !== null) {
      recovered.push(element);
    }
  });

  return recovered;
}

function removeElementIssue(
  raw: unknown,
  path: (string | number)[],
  reason: string,
  issues: RecoveryIssue[],
): null {
  issues.push({
    kind: "element",
    path,
    action: "remove",
    ...(isRecord(raw) && typeof raw.id === "string" ? { id: raw.id } : {}),
    ...(isRecord(raw) && typeof raw.type === "string"
      ? { elementType: raw.type }
      : {}),
    reason,
  });

  return null;
}

function recoverElement(
  raw: unknown,
  path: (string | number)[],
  issues: RecoveryIssue[],
  typographyContext: Presentation,
): PowerShowElement | null {
  // 1. Keep anything that is already canonical.
  const parsed = PowerShowElementSchema.safeParse(raw);

  if (parsed.success) {
    if (parsed.data.type === "text") {
      try {
        resolveTextStyle(typographyContext, parsed.data);
      } catch {
        return removeElementIssue(raw, path, RECOVERY_REASON.invalidElement, issues);
      }
    }
    if (parsed.data.type === "container" && isRecord(raw)) {
      return recoverContainer(raw, path, issues, typographyContext);
    }
    if (parsed.data.type === "topics" && isRecord(raw)) {
      return recoverTopics(raw, path, issues, typographyContext);
    }
    if (parsed.data.type === "table" && parsed.data.mode === "structured" && isRecord(raw)) {
      return recoverTable(raw, path, issues, typographyContext);
    }
    return parsed.data;
  }

  if (!isRecord(raw)) {
    return removeElementIssue(raw, path, RECOVERY_REASON.invalidElement, issues);
  }

  switch (raw.type) {
    case "container":
      return recoverContainer(raw, path, issues, typographyContext);

    case "topics":
      return recoverTopics(raw, path, issues, typographyContext);

    case "table":
      return recoverTable(raw, path, issues, typographyContext);

    case "blocks":
      // Old/incompatible Blocks are removed whole; never repaired.
      return removeElementIssue(
        raw,
        path,
        RECOVERY_REASON.invalidBlocksElement,
        issues,
      );

    default:
      return removeElementIssue(raw, path, RECOVERY_REASON.invalidElement, issues);
  }
}

function recoverContainer(
  raw: Record<string, unknown>,
  path: (string | number)[],
  issues: RecoveryIssue[],
  typographyContext: Presentation,
): PowerShowElement | null {
  if (!Array.isArray(raw.children)) {
    return removeElementIssue(
      raw,
      path,
      RECOVERY_REASON.invalidContainerStructure,
      issues,
    );
  }

  const shell = withContainerShell(raw);
  const shellParsed = PowerShowElementSchema.safeParse(shell);

  if (!shellParsed.success) {
    return removeElementIssue(
      raw,
      path,
      RECOVERY_REASON.invalidContainerStructure,
      issues,
    );
  }

  const children = recoverElements(
    raw.children,
    [...path, "children"],
    issues,
    typographyContext,
  );
  const rebuilt = { ...raw, children };

  const rebuiltParsed = PowerShowElementSchema.safeParse(rebuilt);

  if (!rebuiltParsed.success) {
    return removeElementIssue(
      raw,
      path,
      RECOVERY_REASON.invalidContainerStructure,
      issues,
    );
  }

  return rebuiltParsed.data;
}

/**
 * Structural preconditions for Topics recovery.
 *
 * Recovery may neutralize ONLY nested PowerShowElement arrays. Every
 * structural Topic container must already exist with the correct shape
 * recursively:
 *
 * - item is an object
 * - item.content is an object
 * - item.content.children is an array
 * - item.children is an array
 *
 * Missing or wrong-typed structural containers make the WHOLE Topics
 * element incompatible; no {} / [] fallbacks may be synthesized.
 */
function topicItemsStructureIsValid(rawItems: unknown): boolean {
  if (!isRecordArray(rawItems)) {
    return false;
  }

  for (const item of rawItems) {
    if (!isRecord(item.content) || !Array.isArray(item.content.children)) {
      return false;
    }

    if (!Array.isArray(item.children)) {
      return false;
    }

    if (!topicItemsStructureIsValid(item.children)) {
      return false;
    }
  }

  return true;
}

/**
 * Structural preconditions for structured-table recovery.
 *
 * The original structure must already contain:
 *
 * - columns array
 * - every column an object with a header object with a children array
 * - rows array
 * - every row an object with a cells array
 * - every cell an object with a children array
 *
 * Missing or wrong-typed containers remove the WHOLE structured table.
 * Only existing header.children / cell.children PowerShowElement arrays
 * may be neutralized to [] for shell validation and recursion.
 */
function structuredTableStructureIsValid(raw: Record<string, unknown>): boolean {
  if (!Array.isArray(raw.columns)) {
    return false;
  }

  for (const column of raw.columns) {
    if (
      !isRecord(column) ||
      !isRecord(column.header) ||
      !Array.isArray(column.header.children)
    ) {
      return false;
    }
  }

  if (!Array.isArray(raw.rows)) {
    return false;
  }

  for (const row of raw.rows) {
    if (!isRecord(row) || !Array.isArray(row.cells)) {
      return false;
    }

    for (const cell of row.cells) {
      if (!isRecord(cell) || !Array.isArray(cell.children)) {
        return false;
      }
    }
  }

  return true;
}

function recoverTopics(
  raw: Record<string, unknown>,
  path: (string | number)[],
  issues: RecoveryIssue[],
  typographyContext: Presentation,
): PowerShowElement | null {
  if (!topicItemsStructureIsValid(raw.items)) {
    return removeElementIssue(
      raw,
      path,
      RECOVERY_REASON.invalidTopicsStructure,
      issues,
    );
  }

  // The structure gate guarantees every item/content/children container
  // already exists with the canonical shape.
  const rawItems = raw.items as Record<string, unknown>[];

  const shell = { ...raw, items: withTopicsShell(rawItems) };
  const shellParsed = PowerShowElementSchema.safeParse(shell);

  if (!shellParsed.success) {
    return removeElementIssue(
      raw,
      path,
      RECOVERY_REASON.invalidTopicsStructure,
      issues,
    );
  }

  const items = recoverTopicItems(rawItems, [...path, "items"], issues, typographyContext);
  const rebuilt = { ...raw, items };

  const rebuiltParsed = PowerShowElementSchema.safeParse(rebuilt);

  if (!rebuiltParsed.success) {
    return removeElementIssue(
      raw,
      path,
      RECOVERY_REASON.invalidTopicsStructure,
      issues,
    );
  }

  return rebuiltParsed.data;
}

/**
 * Recurses through TopicItem.content.children (PowerShowElements) and
 * TopicItem.children (nested TopicItems), preserving structurally valid
 * ContentSlots and TopicItems when only nested content fails.
 *
 * Structural preconditions are guaranteed by the caller's
 * topicItemsStructureIsValid gate: every item/content/children container
 * already exists with the canonical shape.
 */
function recoverTopicItems(
  rawItems: Record<string, unknown>[],
  pathBase: (string | number)[],
  issues: RecoveryIssue[],
  typographyContext: Presentation,
): unknown[] {
  const recoveredItems: unknown[] = [];

  rawItems.forEach((rawItem, index) => {
    const itemPath = [...pathBase, index];

    const content = rawItem.content as Record<string, unknown>;
    const contentChildren = recoverElements(
      content.children,
      [...itemPath, "content", "children"],
      issues,
      typographyContext,
    );

    const children = recoverTopicItems(
      rawItem.children as Record<string, unknown>[],
      [...itemPath, "children"],
      issues,
      typographyContext,
    );

    recoveredItems.push({
      ...rawItem,
      content: { ...content, children: contentChildren },
      children,
    });
  });

  return recoveredItems;
}

function recoverTable(
  raw: Record<string, unknown>,
  path: (string | number)[],
  issues: RecoveryIssue[],
  typographyContext: Presentation,
): PowerShowElement | null {
  // Structured tables preserve structurally valid headers/cells while
  // pruning incompatible nested content. Simple tables have no nested
  // PowerShow content to recover: any invalid simple table is removed.
  if (raw.mode !== "structured") {
    return removeElementIssue(
      raw,
      path,
      RECOVERY_REASON.invalidTable,
      issues,
    );
  }

  if (!structuredTableStructureIsValid(raw)) {
    return removeElementIssue(
      raw,
      path,
      RECOVERY_REASON.invalidStructuredTable,
      issues,
    );
  }

  const shell = withStructuredTableShell(raw);
  const shellParsed = PowerShowElementSchema.safeParse(shell);

  if (!shellParsed.success) {
    return removeElementIssue(
      raw,
      path,
      RECOVERY_REASON.invalidStructuredTable,
      issues,
    );
  }

  // The structure gate above guarantees these arrays and nested
  // containers already exist with the canonical shapes.
  const rawColumns = raw.columns as Record<string, unknown>[];
  const rawRows = raw.rows as Record<string, unknown>[];

  const columns = rawColumns.map((column, columnIndex) => {
    const header = column.header as Record<string, unknown>;
    const headerChildren = recoverElements(
      header.children,
      [...path, "columns", columnIndex, "header", "children"],
      issues,
      typographyContext,
    );

    return {
      ...column,
      header: { ...header, children: headerChildren },
    };
  });

  const rows = rawRows.map((row, rowIndex) => {
    const cells = (row.cells as Record<string, unknown>[]).map(
      (cell, cellIndex) => ({
        ...cell,
        children: recoverElements(
          cell.children,
          [...path, "rows", rowIndex, "cells", cellIndex, "children"],
          issues,
          typographyContext,
        ),
      }),
    );

    return { ...row, cells };
  });

  const rebuilt = { ...raw, columns, rows };
  const rebuiltParsed = PowerShowElementSchema.safeParse(rebuilt);

  if (!rebuiltParsed.success) {
    return removeElementIssue(
      raw,
      path,
      RECOVERY_REASON.invalidStructuredTable,
      issues,
    );
  }

  return rebuiltParsed.data;
}

// ------------------------------------------------------------
// Slide recovery
// ------------------------------------------------------------

interface SlideRecoveryResult {
  slides: unknown[];

  issues: RecoveryIssue[];
}

function recoverSlides(
  rawSlides: unknown,
  issues: RecoveryIssue[],
  typographyContext: Presentation,
): SlideRecoveryResult {
  const slides: unknown[] = [];

  if (!Array.isArray(rawSlides)) {
    return { slides, issues };
  }

  rawSlides.forEach((rawSlide, index) => {
    const path = ["slides", index];

    const slide = recoverSlide(rawSlide, path, issues, typographyContext);

    if (slide !== null) {
      slides.push(slide);
    }
  });

  return { slides, issues };
}

function removeSlideIssue(
  raw: unknown,
  path: (string | number)[],
  reason: string,
  issues: RecoveryIssue[],
): null {
  issues.push({
    kind: "slide",
    path,
    action: "remove",
    ...(isRecord(raw) && typeof raw.id === "string" ? { id: raw.id } : {}),
    reason,
  });

  return null;
}

function recoverSlide(
  raw: unknown,
  path: (string | number)[],
  issues: RecoveryIssue[],
  typographyContext: Presentation,
): unknown | null {
  if (!isRecord(raw) || !Array.isArray(raw.elements)) {
    return removeSlideIssue(raw, path, RECOVERY_REASON.invalidSlideStructure, issues);
  }

  const shell = { ...raw, elements: [] };
  const shellParsed = SlideSchema.safeParse(shell);

  if (!shellParsed.success) {
    return removeSlideIssue(raw, path, RECOVERY_REASON.invalidSlideStructure, issues);
  }

  const elements = recoverElements(
    raw.elements,
    [...path, "elements"],
    issues,
    typographyContext,
  );
  const rebuilt = { ...raw, elements };

  const rebuiltParsed = SlideSchema.safeParse(rebuilt);

  if (!rebuiltParsed.success) {
    return removeSlideIssue(raw, path, RECOVERY_REASON.invalidSlideStructure, issues);
  }

  return rebuiltParsed.data;
}

// ------------------------------------------------------------
// Root analysis
// ------------------------------------------------------------

/**
 * Analyzes a raw persisted presentation object (the value stored under
 * `presentation` in the Firestore envelope).
 *
 * - invalid root-level required structure -> unrecoverable
 * - valid document -> valid (kept unchanged)
 * - recoverable document -> recoverable with the pruned candidate
 * - pruned candidate that still fails -> unrecoverable
 */
export function analyzePresentationRecovery(
  rawPresentation: unknown,
): PresentationRecoveryAnalysis {
  const issues: RecoveryIssue[] = [];

  if (!isRecord(rawPresentation)) {
    issues.push({
      kind: "element",
      path: [],
      action: "remove",
      reason: RECOVERY_REASON.invalidPresentationStructure,
    });

    return { status: "unrecoverable", presentation: null, issues };
  }

  // slides MUST already be an array. A missing or non-array slides
  // value is never turned into []: the root shell may neutralize
  // slides only AFTER the original slides field has been confirmed to
  // be an array.
  if (!Array.isArray(rawPresentation.slides)) {
    issues.push({
      kind: "element",
      path: [],
      action: "remove",
      reason: RECOVERY_REASON.invalidPresentationStructure,
    });

    return { status: "unrecoverable", presentation: null, issues };
  }

  // Validate the root shell by neutralizing ONLY slides to [].
  const rootShellParsed = PresentationSchema.safeParse({
    ...rawPresentation,
    slides: [],
  });

  if (!rootShellParsed.success) {
    issues.push({
      kind: "element",
      path: [],
      action: "remove",
      reason: RECOVERY_REASON.invalidPresentationStructure,
    });

    return { status: "unrecoverable", presentation: null, issues };
  }

  // Fast path: the whole document is already canonical.
  const fullParsed = PresentationSchema.safeParse(rawPresentation);

  if (fullParsed.success) {
    return { status: "valid", presentation: fullParsed.data, issues };
  }

  const { slides } = recoverSlides(rawPresentation.slides, issues, rootShellParsed.data);

  const candidate = { ...rawPresentation, slides };
  const finalParsed = PresentationSchema.safeParse(candidate);

  if (!finalParsed.success) {
    issues.push({
      kind: "element",
      path: [],
      action: "remove",
      reason: RECOVERY_REASON.finalPresentationInvalid,
    });

    return { status: "unrecoverable", presentation: null, issues };
  }

  return {
    status: issues.length > 0 ? "recoverable" : "valid",
    presentation: finalParsed.data,
    issues,
  };
}
