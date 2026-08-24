import type { BlocksElement, ElementEffect } from "@powershow/document-schema";
import { useStudioI18n } from "@/features/i18n/studio-i18n-context";
import styles from "../editor-workspace.module.css";
import type {
  BlocksAuthoringControls,
  ElementInspectorUpdate,
} from "./inspector-types";
import { InspectorSection } from "./inspector-section";
import { BlocksContentSection } from "./sections/blocks-content-section";
import { CanonicalDataAppearanceSection, type CanonicalDataStyle } from "./sections/canonical-data-appearance-section";
import { CanonicalElementEffectsSection } from "./sections/canonical-element-effects-section";

interface BlocksInspectorProps {
  element: BlocksElement;
  onUpdate: ElementInspectorUpdate;
  blocksAuthoringControls: BlocksAuthoringControls;
}

export function BlocksInspector({
  element,
  onUpdate,
  blocksAuthoringControls,
}: BlocksInspectorProps) {
  const { t } = useStudioI18n();
  const updateBlocksStyle = (update: (style: CanonicalDataStyle | undefined) => CanonicalDataStyle) => onUpdate((current) => {
    if (current.type !== "blocks") return current;
    const style = update(current.style);
    return style === current.style ? current : { ...current, style };
  });
  const updateBlocksEffect = (update: (effect: ElementEffect | undefined) => ElementEffect) => onUpdate((current) => current.type === "blocks" ? { ...current, effect: update(current.effect) } : current);

  return <>
    <div className={styles.inspectorDivider} />
    <InspectorSection title={t("inspector.content")} defaultOpen>
      <BlocksContentSection
        element={element}
        onUpdate={onUpdate}
        blocksAuthoringControls={blocksAuthoringControls}
      />
    </InspectorSection>
    <CanonicalDataAppearanceSection element={element} style={element.style} effect={element.effect} onUpdateStyle={updateBlocksStyle} onUpdateEffect={updateBlocksEffect} controlPrefix="blocks" showColor />
    <CanonicalElementEffectsSection effect={element.effect} onUpdateEffect={updateBlocksEffect} controlPrefix="blocks" />
  </>;
}
