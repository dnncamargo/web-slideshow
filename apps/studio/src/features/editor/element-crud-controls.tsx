"use client";

import {
  useState,
} from "react";

import type {
  PowerShowElement,
} from "@powershow/document-schema";

import type {
  ElementCreateType,
} from "./element-operations";

import styles from
  "./editor-workspace.module.css";

// ============================================================
// BEGIN: PROPS
// ============================================================

interface ElementCrudControlsProps {
  selectedElement:
    PowerShowElement | null;

  canMoveUp:
    boolean;

  canMoveDown:
    boolean;

  onAdd: (
    type: ElementCreateType,
  ) => void;

  onMoveUp:
    () => void;

  onMoveDown:
    () => void;

  onDuplicate:
    () => void;

  onDelete:
    () => void;
}

// ============================================================
// END: PROPS
// ============================================================

// ============================================================
// BEGIN: ELEMENT CRUD CONTROLS
// ============================================================

export function ElementCrudControls({
  selectedElement,
  canMoveUp,
  canMoveDown,
  onAdd,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
}: ElementCrudControlsProps) {
  const [
    createType,
    setCreateType,
  ] =
    useState<ElementCreateType>(
      "text",
    );


  const insertionDescription =
    selectedElement?.type ===
      "container"
      ? "Adds inside selected container."
      : selectedElement
        ? "Adds after selected element."
        : "Adds to slide root.";


  return (
    <div
      className={
        styles.elementCrud
      }
    >
      {/* =====================================================
          BEGIN: CREATE
          ===================================================== */}

      <div
        className={
          styles.elementCrudCreate
        }
      >
        <select
          value={
            createType
          }

          onChange={
            (event) => {
              setCreateType(
                event.target
                  .value as
                  ElementCreateType,
              );
            }
          }
        >
          <option value="text">
            Text
          </option>

          <option value="textbox">
            Textbox
          </option>

          <option value="container">
            Container
          </option>

          <option value="image">
            Image
          </option>

          <option value="code">
            Code
          </option>

          <option value="terminal">
            Terminal
          </option>

          <option value="table">
            Table
          </option>
        </select>


        <button
          type="button"

          className={
            styles.elementCrudPrimary
          }

          onClick={
            () => {
              onAdd(
                createType,
              );
            }
          }
        >
          + Add
        </button>
      </div>

      {/* =====================================================
          END: CREATE
          ===================================================== */}


      <small
        className={
          styles.elementCrudHint
        }
      >
        {insertionDescription}
      </small>

            {/* =====================================================
          BEGIN: MOVE ELEMENT
          ===================================================== */}

      <div
        className={
          styles.elementCrudActions
        }
      >
        <button
          type="button"

          disabled={
            !canMoveUp
          }

          onClick={
            onMoveUp
          }

          title="Move element up"
        >
          ↑ Up
        </button>


        <button
          type="button"

          disabled={
            !canMoveDown
          }

          onClick={
            onMoveDown
          }

          title="Move element down"
        >
          ↓ Down
        </button>
      </div>

      {/* =====================================================
          END: MOVE ELEMENT
          ===================================================== */}


      {/* =====================================================
          BEGIN: DUPLICATE + DELETE
          ===================================================== */}

      <div
        className={
          styles.elementCrudActions
        }
      >
        <button
          type="button"

          disabled={
            !selectedElement
          }

          onClick={
            onDuplicate
          }
        >
          Duplicate
        </button>


        <button
          type="button"

          className={
            styles.elementCrudDanger
          }

          disabled={
            !selectedElement
          }

          onClick={
            onDelete
          }
        >
          Delete
        </button>
      </div>

      {/* =====================================================
          END: DUPLICATE + DELETE
          ===================================================== */}
    </div>
  );
}

// ============================================================
// END: ELEMENT CRUD CONTROLS
// ============================================================