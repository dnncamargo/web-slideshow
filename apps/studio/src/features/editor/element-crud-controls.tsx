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

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from
  "./editor-workspace.module.css";

// ============================================================
// BEGIN: PROPS
// ============================================================

interface ElementCrudControlsProps {
  selectedElement:
    PowerShowElement | null;

  selectedContentSlotId?: string | null;

  onAdd: (
    type: ElementCreateType,
  ) => void;

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
  selectedContentSlotId,
  onAdd,
  onDuplicate,
  onDelete,
}: ElementCrudControlsProps) {
  const { t } = useStudioI18n();

  const [
    createType,
    setCreateType,
  ] =
    useState<ElementCreateType>(
      "text",
    );

const insertionDescription =
  selectedElement?.type === "container"
    ? t("elementCrud.addInsideContainer")
    : selectedElement?.type === "topics" &&
        selectedContentSlotId
      ? t("elementCrud.addInsideTopicContent")
      : selectedElement?.type === "table" &&
          selectedContentSlotId
        ? t("elementCrud.addInsideContentSlot")
        : selectedElement
          ? t("elementCrud.addAfterElement")
          : t("elementCrud.addToSlideRoot");


  // ============================================================
  // BEGIN: FIREFOX FORM STATE RESTORATION GUARD
  //
  // Firefox restores dynamic button disabled states on a soft
  // reload before React hydrates. Opting this control form out of
  // restoration keeps the server DOM and first client render equal.
  // ============================================================

  return (
    <form
      autoComplete="off"

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
            {t("element.text")}
          </option>

          <option value="textbox">
            {t("element.textbox")}
          </option>

          <option value="container">
            {t("element.container")}
          </option>

          <option value="image">
            {t("element.image")}
          </option>

          <option value="code">
            {t("element.code")}
          </option>

          <option value="terminal">
            {t("element.terminal")}
          </option>

          <option value="table">
            {t("element.table")}
          </option>

          <option value="topics">
            {t("element.topics")}
          </option>

          <option value="divider">
            {t("element.divider")}
          </option>

          <option value="gallery">
            {t("element.gallery")}
          </option>

          <option value="embed">
            {t("element.embed")}
          </option>

          <option value="scripted">
            {t("element.scripted")}
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
          <span>
            {t("elementCrud.add")}
          </span>
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
        <span>
          {insertionDescription}
        </span>
      </small>

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
          <span>
            {t("elementCrud.duplicate")}
          </span>
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
          <span>
            {t("elementCrud.delete")}
          </span>
        </button>
      </div>

      {/* =====================================================
          END: DUPLICATE + DELETE
          ===================================================== */}
    </form>
  );

  // ============================================================
  // END: FIREFOX FORM STATE RESTORATION GUARD
  // ============================================================
}

// ============================================================
// END: ELEMENT CRUD CONTROLS
// ============================================================
