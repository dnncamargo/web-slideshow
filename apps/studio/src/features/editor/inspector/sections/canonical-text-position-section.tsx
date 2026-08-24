import type { ContainerElement, ElementLayout, ImageElement, ImageLayout, ResizablePositionedLayout, TextElement, TextboxElement, GalleryElement, EmbedElement, ScriptedElement } from "@powershow/document-schema";
import { useStudioI18n } from "@/features/i18n/studio-i18n-context";
import styles from "../../editor-workspace.module.css";
import { InspectorSection } from "../inspector-section";
import { shouldShowPlacementLayerControls, type ElementLayerControls } from "./element-placement-helpers";

interface Props {
  element: TextElement | TextboxElement | ImageElement | GalleryElement | EmbedElement | ScriptedElement;
  parent: ContainerElement | null;
  onUpdateLayout: (update: (layout: ElementLayout | ImageLayout | ResizablePositionedLayout | undefined) => ElementLayout | ImageLayout | ResizablePositionedLayout | undefined) => void;
  layerControls: ElementLayerControls;
}

function edgeValue(value: string | number | undefined): string | number {
  return value ?? "";
}

export function CanonicalElementPositionSection({ element, parent, onUpdateLayout, layerControls }: Props) {
  const { t } = useStudioI18n();
  const layout = element.layout;
  const isAbsolute = layout?.position === "absolute";
  const layerVisible = shouldShowPlacementLayerControls(isAbsolute, parent?.layout?.children?.mode);

  return (
    <InspectorSection title={t("inspector.placement")}>
      <label className={styles.field}>
        <span title={t("inspector.positionHelp")}>{t("inspector.position")}</span>
        <select
          id="element-canonical-position-mode"
          name="elementCanonicalPositionMode"
          value={isAbsolute ? "absolute" : "flow"}
          onChange={(event) => {
            if (event.target.value === "absolute") {
              onUpdateLayout((current) => ({ ...current, position: "absolute" }));
            } else {
              onUpdateLayout((current) => {
                if (!current) return undefined;
                const { position: _position, top: _top, right: _right, bottom: _bottom, left: _left, ...flow } = current;
                return flow;
              });
            }
          }}
        >
          <option value="flow">{t("inspector.flow")}</option>
          <option value="absolute">{t("inspector.absolute")}</option>
        </select>
      </label>

      {isAbsolute && (
        <div className={styles.fieldGrid}>
          {(["top", "right", "bottom", "left"] as const).map((edge) => (
            <label className={styles.field} key={edge}>
              <span>{edge[0].toUpperCase() + edge.slice(1)}</span>
              <input
                id={`element-canonical-${edge}`}
                name={`elementCanonical${edge[0].toUpperCase()}${edge.slice(1)}`}
                type="text"
                inputMode="decimal"
                value={edgeValue(layout?.[edge])}
                onChange={(event) => {
                  const value = event.target.value.trim();
                  onUpdateLayout((current) => ({
                    ...current,
                    position: "absolute",
                    [edge]: value === "" ? undefined : /^-?\d+(?:\.\d+)?%$/.test(value) ? value : Number(value),
                  }));
                }}
              />
            </label>
          ))}
        </div>
      )}

      {layerVisible && (
        <div className={styles.positionLayerActions}>
          <button type="button" disabled={layerControls.index === 0} onClick={() => layerControls.onMoveTo(0)}>
            {t("inspector.sendToBack")}
          </button>
          <button type="button" disabled={layerControls.index === layerControls.count - 1} onClick={() => layerControls.onMoveTo(layerControls.count - 1)}>
            {t("inspector.bringToFront")}
          </button>
        </div>
      )}
    </InspectorSection>
  );
}

export const CanonicalTextPositionSection = CanonicalElementPositionSection;
