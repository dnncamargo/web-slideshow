import type { ContainerElement, Presentation } from "@powershow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../../editor-workspace.module.css";
import { InspectorSection } from "../inspector-section";

interface ContainerLinkedStyleSectionProps {
  element: ContainerElement;
  presentation?: Pick<Presentation, "linkedStyles">;
  onAttach: (linkedStyleId: string) => void;
  onDetach: () => void;
}

export function ContainerLinkedStyleSection({
  element,
  presentation,
  onAttach,
  onDetach,
}: ContainerLinkedStyleSectionProps) {
  const { t } = useStudioI18n();
  const linkedStyleName = (presentation?.linkedStyles ?? []).find((style) => style.id === element.linkedStyleId)?.name;

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
          {(presentation?.linkedStyles ?? []).map((style) => (
            <option key={style.id} value={style.id}>{style.name}</option>
          ))}
        </select>
      </label>

      {element.linkedStyleId !== undefined ? (
        <>
          <div className={styles.colorLinkedStatus} role="status">{t("inspector.linkedContainerStyleNamed", { style: linkedStyleName ?? element.linkedStyleId })}</div>
          <button type="button" className={styles.resourceAction} onClick={onDetach}>
            {t("inspector.detachLinkedContainerStyleNamed", { style: linkedStyleName ?? element.linkedStyleId })}
          </button>
        </>
      ) : <div className={styles.colorLinkedStatus} role="status">{t("inspector.noLinkedContainerStyleAttached")}</div>}

    </InspectorSection>
  );
}
