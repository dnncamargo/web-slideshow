import type { Presentation, PowerShowElement } from "@powershow/document-schema";
import {
  PowerShowElementSchema,
  PresentationSchema,
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
      ...(isRecord(item.content) ? item.content : {}),
      children: [],
    },
    children: withTopicsShell(
      isRecordArray(item.children) ? item.children : [],
    ),
  }));
}

function withStructuredTableShell(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...raw,
    columns: isRecordArray(raw.columns)
      ? raw.columns.map((column) => ({
          ...column,
          header: {
            ...(isRecord(column.header) ? column.header : {}),
            children: [],
          },
        }))
      : [],
    rows: isRecordArray(raw.rows)
      ? raw.rows.map((row) => ({
          ...row,
          cells: isRecordArray(row.cells)
            ? row.cells.map((cell) => ({
                ...cell,
                children: [],
              }))
            : [],
        }))
      : [],
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
): PowerShowElement[] {
  const recovered: PowerShowElement[] = [];

  if (!Array.isArray(rawElements)) {
    return recovered;
  }

  rawElements.forEach((rawElement, index) => {
    const path = [...pathBase, index];

    const element = recoverElement(rawElement, path, issues);

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
): PowerShowElement | null {
  // 1. Keep anything that is already canonical.
  const parsed = PowerShowElementSchema.safeParse(raw);

  if (parsed.success) {
    return parsed.data;
  }

  if (!isRecord(raw)) {
    return removeElementIssue(raw, path, RECOVERY_REASON.invalidElement, issues);
  }

  switch (raw.type) {
    case "container":
      return recoverContainer(raw, path, issues);

    case "topics":
      return recoverTopics(raw, path, issues);

    case "table":
      return recoverTable(raw, path, issues);

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

function recoverTopics(
  raw: Record<string, unknown>,
  path: (string | number)[],
  issues: RecoveryIssue[],
): PowerShowElement | null {
  if (!isRecordArray(raw.items)) {
    return removeElementIssue(
      raw,
      path,
      RECOVERY_REASON.invalidTopicsStructure,
      issues,
    );
  }

  const shell = { ...raw, items: withTopicsShell(raw.items) };
  const shellParsed = PowerShowElementSchema.safeParse(shell);

  if (!shellParsed.success) {
    return removeElementIssue(
      raw,
      path,
      RECOVERY_REASON.invalidTopicsStructure,
      issues,
    );
  }

  const items = recoverTopicItems(raw.items, [...path, "items"], issues);
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
 */
function recoverTopicItems(
  rawItems: Record<string, unknown>[],
  pathBase: (string | number)[],
  issues: RecoveryIssue[],
): unknown[] {
  const recoveredItems: unknown[] = [];

  rawItems.forEach((rawItem, index) => {
    const itemPath = [...pathBase, index];

    const content = isRecord(rawItem.content) ? rawItem.content : null;
    const contentChildren = content
      ? recoverElements(content.children, [...itemPath, "content", "children"], issues)
      : [];

    const children = recoverTopicItems(
      isRecordArray(rawItem.children) ? rawItem.children : [],
      [...itemPath, "children"],
      issues,
    );

    recoveredItems.push({
      ...rawItem,
      ...(content ? { content: { ...content, children: contentChildren } } : {}),
      children,
    });
  });

  return recoveredItems;
}

function recoverTable(
  raw: Record<string, unknown>,
  path: (string | number)[],
  issues: RecoveryIssue[],
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

  if (!isRecordArray(raw.columns) || !isRecordArray(raw.rows)) {
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

  const columns = raw.columns.map((column, columnIndex) => {
    const header = isRecord(column.header) ? column.header : null;
    const headerChildren = header
      ? recoverElements(
          header.children,
          [...path, "columns", columnIndex, "header", "children"],
          issues,
        )
      : [];

    return {
      ...column,
      header: header ? { ...header, children: headerChildren } : column.header,
    };
  });

  const rows = raw.rows.map((row, rowIndex) => {
    const cells = isRecordArray(row.cells)
      ? row.cells.map((cell, cellIndex) => ({
          ...cell,
          children: recoverElements(
            cell.children,
            [...path, "rows", rowIndex, "cells", cellIndex, "children"],
            issues,
          ),
        }))
      : [];

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
): SlideRecoveryResult {
  const slides: unknown[] = [];

  if (!Array.isArray(rawSlides)) {
    return { slides, issues };
  }

  rawSlides.forEach((rawSlide, index) => {
    const path = ["slides", index];

    const slide = recoverSlide(rawSlide, path, issues);

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
): unknown | null {
  const parsed = SlideSchema.safeParse(raw);

  if (parsed.success) {
    return parsed.data;
  }

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

  const { slides } = recoverSlides(rawPresentation.slides, issues);

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