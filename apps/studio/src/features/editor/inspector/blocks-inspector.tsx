import type { BlocksElement } from "@powershow/document-schema";
import { useStudioI18n } from "@/features/i18n/studio-i18n-context";
import styles from "../editor-workspace.module.css";
import type {
  BlocksAuthoringControls,
  ElementInspectorUpdate,
  UpdateElementStyle,
} from "./inspector-types";
import { InspectorSection } from "./inspector-section";
import { BlocksContentSection } from "./sections/blocks-content-section";
import { ElementAppearanceSection } from "./sections/element-appearance-section";
import { ElementEffectsSection } from "./sections/element-effects-section";

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
  const updateBlocksStyle: UpdateElementStyle = (update) => onUpdate((current) => {
    if (current.type !== "blocks") return current;
    const style = update(current.style);
    return style === current.style ? current : { ...current, style };
  });

  return <>
    <div className={styles.inspectorDivider} />
    <InspectorSection title={t("inspector.content")} defaultOpen>
      <BlocksContentSection
        element={element}
        onUpdate={onUpdate}
        blocksAuthoringControls={blocksAuthoringControls}
      />
    </InspectorSection>
    <ElementAppearanceSection element={element} onUpdateStyle={updateBlocksStyle} controlPrefix="blocks" showColor showBackground showBackgroundGradient showRoundedCorners showOpacity showBorder />
    <ElementEffectsSection style={element.style} onUpdateStyle={updateBlocksStyle} controlPrefix="blocks" />
  </>;
}
