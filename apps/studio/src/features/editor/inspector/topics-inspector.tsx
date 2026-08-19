import type { TopicsElement } from "@powershow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../editor-workspace.module.css";

import { InspectorSection } from "./inspector-section";

import type {
  ElementInspectorUpdate,
  TopicsAuthoringControls,
} from "./inspector-types";

interface TopicsInspectorProps {
  element: TopicsElement;

  onUpdate: ElementInspectorUpdate;

  topicsAuthoringControls: TopicsAuthoringControls;
}

// ============================================================
// BEGIN: TOPICS INSPECTOR
//
// B2.1 edita somente o nível do TopicsElement:
//
// - kind (unordered / ordered)
// - contagem de itens de nível superior
// - adicionar um novo tópico de nível superior
//
// Nenhum ID bruto é renderizado. Nenhum TopicItem é tratado
// como se fosse um PowerShowElement.
// ============================================================

export function TopicsInspector({
  element,
  onUpdate,
  topicsAuthoringControls,
}: TopicsInspectorProps) {
  const { t } = useStudioI18n();

  return (
    <>
      <div className={styles.inspectorDivider} />

      <InspectorSection title={t("inspector.content")} defaultOpen>
        <label className={styles.field}>
          <span>{t("inspector.topics.kind")}</span>

          <select
            id="topics-kind"
            name="topicsKind"
            value={element.kind}
            onChange={(event) => {
              const kind = event.target.value as TopicsElement["kind"];

              onUpdate((current) => {
                if (current.type !== "topics") {
                  return current;
                }

                return {
                  ...current,

                  kind,
                };
              });
            }}
          >
            <option value="unordered">
              {t("inspector.topics.unordered")}
            </option>

            <option value="ordered">
              {t("inspector.topics.ordered")}
            </option>
          </select>
        </label>

        <span className={styles.fieldHint}>
          {t("inspector.topics.items", {
            count: element.items.length,
          })}
        </span>

        <button
          type="button"

          className={styles.secondaryButton}

          onClick={() => {
            topicsAuthoringControls.onAddTopLevelTopic(element.id);
          }}
        >
          <span>{t("inspector.topics.add")}</span>
        </button>
      </InspectorSection>
    </>
  );
}

// ============================================================
// END: TOPICS INSPECTOR
// ============================================================
