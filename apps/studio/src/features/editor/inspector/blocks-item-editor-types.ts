import type { BlocksElement } from "@powershow/document-schema";

import type {
  BlocksAuthoringControls,
  ElementInspectorUpdate,
} from "./inspector-types";

/**
 * Human-facing labels for the recursive BlocksItemEditor.
 *
 * The editor is intentionally i18n-free: Studio i18n keys belong to the
 * BlocksInspector shell (owned by another checkpoint). Consumers pass a
 * complete English fixture or localized labels through this contract.
 */
export interface BlocksItemEditorLabels {
  /** Label for the block category select. */
  category: string;

  /** Label for the block shape select. */
  shape: string;

  /** Shape option for statement blocks. */
  statement: string;

  /** Shape option for scope blocks. */
  scope: string;

  /** Fixed shape label for socket-contained value blocks. */
  value: string;

  /** Move a block/part earlier (up) in its stack. */
  moveEarlier: string;

  /** Move a block/part later (down) in its stack. */
  moveLater: string;

  /** Remove a block or part. */
  remove: string;

  /** Add a text part to a block. */
  addTextPart: string;

  /** Add a socket part to a block. */
  addSocketPart: string;

  /** Add a child block inside a scope. */
  addChild: string;

  /** Title shown when adding a scope child is blocked by the depth limit. */
  addChildAtMaxDepth: string;

  /** Label for the socket content-mode select. */
  socketContent: string;

  /** Socket content mode: empty. */
  socketEmpty: string;

  /** Socket content mode: literal. */
  socketLiteral: string;

  /** Socket content mode: value block. */
  socketValue: string;

  /** Label for the literal value input of a literal socket. */
  literalValue: string;

  /** Title shown when creating a socket value is blocked by the depth limit. */
  valueAtMaxDepth: string;

  /** Accessible label for a text-part input. */
  textPartLabel: string;
}

export interface BlocksItemEditorProps {
  /** Canonical BlocksElement being authored. */
  element: BlocksElement;

  /** Inspector update path; the component writes through this only. */
  onUpdate: ElementInspectorUpdate;

  /** Creation callbacks (these allocate presentation-wide ids). */
  blocksAuthoringControls: BlocksAuthoringControls;

  /** Human-facing labels; never read from Studio i18n here. */
  labels: BlocksItemEditorLabels;
}