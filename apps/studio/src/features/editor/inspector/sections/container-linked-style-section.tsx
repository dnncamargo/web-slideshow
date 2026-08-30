import { useState } from "react";

import type { ContainerElement, Presentation } from "@powershow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import { canCreateLinkedStyleFromContainer } from "../../linked-style-authoring";
import styles from "../../editor-workspace.module.css";
import { InspectorSection } from "../inspector-section";

interface ContainerLinkedStyleSectionProps {
  element: ContainerElement;
  presentation: Pick<Presentation, "linkedStyles">;
  onAttach: (linkedStyleId: string) => void;
  onDetach: () => void;
  onCreate: (name: string) => void;
}

export function ContainerLinkedStyleSection({
  element,
  presentation,
  onAttach,
  onDetach,
  onCreate,
}: ContainerLinkedStyleSectionProps) {
  const { t } = useStudioI18n();
  const [name, setName] = useState("");
  const canCreate = canCreateLinkedStyleFromContainer(element);

  return (
    <InspectorSection title={t("inspector.linkedContainerStyle")} defaultOpen>
      <label className={styles.field}>
        <span>{t("inspector.linkedContainerStyle")}</span>
        <select
          id="container-linked-style"
          value={element.linkedStyleId ?? ""}
          onChange={(event) => {
            if (event.target.value) onAttach(event.target.value);
            else if (element.linkedStyleId !== undefined) onDetach();
          }}
        >
          <option value="">{t("inspector.noLinkedContainerStyle")}</option>
          {(presentation.linkedStyles ?? []).map((style) => (
            <option key={style.id} value={style.id}>{style.name}</option>
          ))}
        </select>
      </label>

      {element.linkedStyleId !== undefined ? (
        <button type="button" className={styles.resourceAction} onClick={onDetach}>
          {t("inspector.detachLinkedContainerStyle")}
        </button>
      ) : null}

      {element.linkedStyleId === undefined ? (
        <div className={styles.fieldGrid}>
          <label className={styles.field}>
            <span>{t("inspector.newLinkedContainerStyleName")}</span>
            <input
              id="container-linked-style-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <button
            type="button"
            className={styles.resourceAction}
            disabled={!canCreate || !name.trim()}
            title={canCreate ? undefined : t("inspector.emptyLinkedContainerStyle")}
            onClick={() => {
              onCreate(name);
              setName("");
            }}
          >
            {t("inspector.createLinkedContainerStyle")}
          </button>
        </div>
      ) : null}
    </InspectorSection>
  );
}
