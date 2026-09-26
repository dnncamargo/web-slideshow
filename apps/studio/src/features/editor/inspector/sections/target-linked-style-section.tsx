import type { LinkedStyle, Presentation, PresentationElement } from "@web-slideshow/document-schema";
import { useStudioI18n } from "@/features/i18n/studio-i18n-context";
import styles from "../../editor-workspace.module.css";
import { InspectorSection } from "../inspector-section";

type TargetElement = Extract<PresentationElement, { type: "code" | "terminal" | "table" | "divider" }>;
type Target = TargetElement["type"];

function isCompatible(style: LinkedStyle, element: TargetElement): boolean {
  if (!("target" in style) || style.target !== element.type) return false;
  return element.type !== "table" || ("mode" in style && style.mode === (element.mode === "structured" ? "structured" : "simple"));
}

export interface TargetLinkedStyleSectionProps {
  element: TargetElement;
  presentation?: Pick<Presentation, "linkedStyles">;
  onAttach: (linkedStyleId: string) => void;
  onDetach: () => void;
}

export function TargetLinkedStyleSection({ element, presentation, onAttach, onDetach }: TargetLinkedStyleSectionProps) {
  const { t } = useStudioI18n();
  const compatibleStyles = (presentation?.linkedStyles ?? []).filter((style) => isCompatible(style, element));
  const linkedStyleName = compatibleStyles.find((style) => style.id === element.linkedStyleId)?.name;
  const target: Target = element.type;

  return (
    <InspectorSection title={t("inspector.linkedStyle")} defaultOpen>
      <label className={styles.field}>
        <span>{t("inspector.linkedStyle")}</span>
        <select
          id={`${target}-linked-style`}
          value={element.linkedStyleId ?? ""}
          onChange={(event) => {
            if (event.target.value) onAttach(event.target.value);
            else if (element.linkedStyleId !== undefined) onDetach();
          }}
        >
          <option value="">{t("inspector.noLinkedStyle")}</option>
          {compatibleStyles.map((style) => <option key={style.id} value={style.id}>{style.name}</option>)}
        </select>
      </label>
      {element.linkedStyleId !== undefined ? (
        <div className={styles.colorLinkedStatus} role="status">
          <span>{t("inspector.linkedStyleNamed", { style: linkedStyleName ?? element.linkedStyleId })}</span>
          <button type="button" onClick={onDetach}>
            {t("inspector.detachLinkedStyleNamed", { style: linkedStyleName ?? element.linkedStyleId })}
          </button>
        </div>
      ) : <div className={styles.colorLinkedStatus} role="status">{t("inspector.noLinkedStyleAttached")}</div>}
    </InspectorSection>
  );
}
