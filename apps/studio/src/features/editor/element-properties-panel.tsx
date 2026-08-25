"use client";

import type { PowerShowElement } from "@powershow/document-schema";

import {
  ELEMENT_TYPE_MESSAGE_KEYS,
  type StudioTranslate,
} from "@/features/i18n/studio-i18n";
import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "./editor-workspace.module.css";
import { getElementPropertyEntries } from "./element-properties";

interface ElementPropertiesPanelProps {
  selectedElement: PowerShowElement | null;
  isStructuralTopicSelection: boolean;
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
}: ElementPropertiesPanelProps) {
  const { t } = useStudioI18n();
  const entries = selectedElement
    ? getElementPropertyEntries(selectedElement)
    : [];

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
          <div className={styles.elementPropertiesList}>
            {entries.map((entry) => (
              <div className={styles.elementPropertyRow} key={entry.path}>
                <span className={styles.elementPropertyPath}>{entry.path}</span>
                <span
                  className={styles.elementPropertyValue}
                  title={entry.displayValue}
                >
                  {entry.displayValue}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className={styles.elementPropertiesEmpty}>{t("properties.noSelection")}</p>
      )}
    </section>
  );
}
