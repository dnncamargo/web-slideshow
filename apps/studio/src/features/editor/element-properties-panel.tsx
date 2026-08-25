"use client";

import type { PowerShowElement } from "@powershow/document-schema";
import { useEffect, useMemo, useState } from "react";

import type { CustomLibraryRepository } from "@/features/custom-library/custom-library-repository";
import { CustomLibrarySaveForm } from "@/features/custom-library/custom-library-save-form";
import {
  ELEMENT_TYPE_MESSAGE_KEYS,
  type StudioTranslate,
} from "@/features/i18n/studio-i18n";
import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "./editor-workspace.module.css";
import {
  getSelectableElementProperties,
  type SelectableElementProperty,
} from "./element-property-selection";
import { toElementPropertySelectionMap } from "./element-property-selection-state";

interface ElementPropertiesPanelProps {
  selectedElement: PowerShowElement | null;
  isStructuralTopicSelection: boolean;
  customLibraryRepository?: CustomLibraryRepository;
}

function getElementIdentity(
  element: PowerShowElement,
  t: StudioTranslate,
): string {
  return `${t(ELEMENT_TYPE_MESSAGE_KEYS[element.type])} · ${element.id}`;
}

export function ElementPropertiesPanel({
  selectedElement,
  isStructuralTopicSelection,
  customLibraryRepository,
}: ElementPropertiesPanelProps) {
  const { t } = useStudioI18n();
  const selectableProperties = useMemo(
    () => (selectedElement ? getSelectableElementProperties(selectedElement) : []),
    [selectedElement],
  );
  const [selectedPathsByElement, setSelectedPathsByElement] = useState<
    Record<string, Record<string, boolean>>
  >({});
  const [saveFormElementId, setSaveFormElementId] = useState<string | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<"saved" | null>(null);

  useEffect(() => {
    if (!selectedElement) return;
    setSelectedPathsByElement((current) => ({
      ...current,
      [selectedElement.id]: Object.fromEntries(
        selectableProperties.map((property) => [
          property.path,
          current[selectedElement.id]?.[property.path] ?? property.defaultSelected,
        ]),
      ),
    }));
  }, [selectedElement, selectableProperties]);

  useEffect(() => {
    setSaveFormElementId(null);
    setSaveFeedback(null);
  }, [selectedElement?.id]);

  const selectedPaths = selectedElement
    ? selectedPathsByElement[selectedElement.id] ?? {}
    : {};
  const selections = useMemo(
    () => toElementPropertySelectionMap(selectedPathsByElement),
    [selectedPathsByElement],
  );

  return (
    <section className={styles.elementProperties} aria-label={t("properties.title")}>
      <h2 className={styles.elementPropertiesTitle}>{t("properties.title")}</h2>
      {isStructuralTopicSelection ? (
        <p className={styles.elementPropertiesEmpty}>
          <strong>{t("properties.contentSlot")}</strong>
          <span>{t("properties.structuralContext")}</span>
        </p>
      ) : selectedElement ? (
        <>
          <div className={styles.elementPropertiesIdentity}>
            {getElementIdentity(selectedElement, t)}
          </div>
          {saveFormElementId !== selectedElement.id && (
            <button
              className={styles.customLibrarySaveButton}
              type="button"
              onClick={() => {
                setSaveFeedback(null);
                setSaveFormElementId(selectedElement.id);
              }}
            >
              {t("customLibrary.save")}
            </button>
          )}
          {saveFormElementId === selectedElement.id && (
            <CustomLibrarySaveForm
              key={selectedElement.id}
              root={selectedElement}
              selections={selections}
              repository={customLibraryRepository}
              onSaved={() => {
                setSaveFormElementId(null);
                setSaveFeedback("saved");
              }}
              onCancel={() => setSaveFormElementId(null)}
            />
          )}
          {saveFeedback === "saved" && (
            <p className={styles.customLibrarySaveStatus} role="status">
              {t("customLibrary.saved")}
            </p>
          )}
          <div className={styles.elementPropertiesList}>
            {selectableProperties.map((entry: SelectableElementProperty) => (
              <label className={styles.elementPropertyRow} key={entry.path}>
                <input
                  type="checkbox"
                  checked={selectedPaths[entry.path] ?? entry.defaultSelected}
                  onChange={(event) => {
                    if (!selectedElement) return;
                    setSelectedPathsByElement((current) => ({
                      ...current,
                      [selectedElement.id]: {
                        ...(current[selectedElement.id] ?? {}),
                        [entry.path]: event.target.checked,
                      },
                    }));
                  }}
                />
                <span className={styles.elementPropertyPath}>{entry.path}</span>
                <span
                  className={styles.elementPropertyValue}
                  title={entry.displayValue}
                >
                  {entry.displayValue}
                </span>
              </label>
            ))}
          </div>
        </>
      ) : (
        <p className={styles.elementPropertiesEmpty}>{t("properties.noSelection")}</p>
      )}
    </section>
  );
}
