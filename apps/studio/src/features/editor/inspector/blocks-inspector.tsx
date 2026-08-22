import type { BlocksElement } from "@powershow/document-schema";
import { useStudioI18n } from "@/features/i18n/studio-i18n-context";
import styles from "../editor-workspace.module.css";
import type { BlocksAuthoringControls, ElementInspectorUpdate, UpdateElementStyle } from "./inspector-types";
import { InspectorSection } from "./inspector-section";
import { ElementAppearanceSection } from "./sections/element-appearance-section";
import { ElementEffectsSection } from "./sections/element-effects-section";

interface BlocksInspectorProps {
  element: BlocksElement;
  onUpdate: ElementInspectorUpdate;
  blocksAuthoringControls: BlocksAuthoringControls;
}

function countBlocks(items: BlocksElement["items"]): number {
  return items.reduce((count, item) => count + 1 + countBlocks(item.children), 0);
}

export function BlocksInspector({ element, onUpdate }: BlocksInspectorProps) {
  const { t } = useStudioI18n();
  const updateBlocksStyle: UpdateElementStyle = (update) => onUpdate((current) => {
    if (current.type !== "blocks") return current;
    const style = update(current.style);
    return style === current.style ? current : { ...current, style };
  });

  return <>
    <div className={styles.inspectorDivider} />
    <InspectorSection title={t("inspector.content")} defaultOpen>
      <small className={styles.fieldHint}>
        <span>Visual block structure is present. Detailed block authoring controls are coming in the next checkpoint.</span>
      </small>
      <small className={styles.fieldHint}>
        <span>{element.categories.length} categories · {countBlocks(element.items)} root/nested blocks</span>
      </small>
    </InspectorSection>
    <ElementAppearanceSection element={element} onUpdateStyle={updateBlocksStyle} controlPrefix="blocks" showColor showBackground showBackgroundGradient showRoundedCorners showOpacity showBorder />
    <ElementEffectsSection style={element.style} onUpdateStyle={updateBlocksStyle} controlPrefix="blocks" />
  </>;
}
