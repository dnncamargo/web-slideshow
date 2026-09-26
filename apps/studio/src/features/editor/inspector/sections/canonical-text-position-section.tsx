import type { BlocksElement, PlotElement, CodeElement, ContainerElement, DividerElement, DividerLayout, ElementLayout, ImageElement, ImageLayout, InteractiveElement, PositionedElementLayout, ResizablePositionedLayout, TableElement, TerminalElement, TextElement, GalleryElement, EmbedElement, ScriptedElement, TopicsElement, TopicsLayout } from "@web-slideshow/document-schema";
import { useStudioI18n } from "@/features/i18n/studio-i18n-context";
import styles from "../../editor-workspace.module.css";
import { InspectorSection } from "../inspector-section";
import { shouldShowPositionLayerControls, type ElementLayerControls } from "./element-positioning-helpers";
import { useAuthoringHistory } from "../../authoring-history-context";

interface Props {
  element: TextElement | ImageElement | GalleryElement | EmbedElement | ScriptedElement | CodeElement | TerminalElement | TableElement | BlocksElement | DividerElement | TopicsElement | PlotElement | InteractiveElement;
  parent: ContainerElement | null;
  onUpdateLayout: (update: (layout: ElementLayout | ImageLayout | ResizablePositionedLayout | DividerLayout | TopicsLayout | PositionedElementLayout | undefined) => ElementLayout | ImageLayout | ResizablePositionedLayout | DividerLayout | TopicsLayout | PositionedElementLayout | undefined) => void;
  layerControls: ElementLayerControls;
  effectiveLayout?: ResizablePositionedLayout;
  disabledFields?: readonly ("position" | "top" | "right" | "bottom" | "left")[];
}

function edgeValue(value: string | number | undefined): string | number {
  return value ?? "";
}

const numberHistoryMeta = { kind: "number.change", labelKey: "history.number.change" } as const;

export function CanonicalElementPositionSection({ element, parent, onUpdateLayout, layerControls, effectiveLayout, disabledFields = [] }: Props) {
  const { t } = useStudioI18n();
  const layout = element.layout;
  const displayedLayout = { ...(layout ?? {}), ...(effectiveLayout ?? {}) };
  const authoringHistory = useAuthoringHistory();
  const isAbsolute = displayedLayout.position === "absolute";
  const layerVisible = shouldShowPositionLayerControls(isAbsolute, parent?.layout?.children?.mode);

  function runDiscrete(callback: () => void): void {
    const meta = {
      kind: "element.setting",
      labelKey: "history.element.setting",
      labelParams: { setting: "position.mode" },
    };

    if (authoringHistory) {
      authoringHistory.discrete(meta, callback);
    } else {
      callback();
    }
  }

  return (
    <InspectorSection title={t("inspector.placement")}>
      <label className={styles.field}>
        <span title={t("inspector.positionHelp")}>{t("inspector.position")}</span>
        <select
          id="element-canonical-position-mode"
          name="elementCanonicalPositionMode"
          value={isAbsolute ? "absolute" : "flow"}
          disabled={disabledFields.includes("position")}
          onChange={(event) => {
            if (disabledFields.includes("position")) return;
            if (event.target.value === "absolute") {
              if (isAbsolute) return;
              runDiscrete(() => onUpdateLayout((current) => ({ ...current, position: "absolute" })));
            } else {
              if (!isAbsolute) return;
              runDiscrete(() => onUpdateLayout((current) => {
                  if (!current) return undefined;
                  const { position: _position, top: _top, right: _right, bottom: _bottom, left: _left, ...flow } = current;
                  return flow;
                }));
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
                value={edgeValue(displayedLayout[edge])}
                disabled={disabledFields.includes(edge)}
                onFocus={() => authoringHistory?.begin(`number:element-canonical-${edge}`, numberHistoryMeta)}
                onBlur={() => authoringHistory?.finish(`number:element-canonical-${edge}`)}
                onChange={(event) => {
                  const value = event.target.value.trim();
                  const nextValue = value === "" ? undefined : /^-?\d+(?:\.\d+)?%$/.test(value) ? value : Number(value);
                  if (disabledFields.includes(edge) || Object.is(layout?.[edge], nextValue)) {
                    return;
                  }

                  const update = () => onUpdateLayout((current) => ({
                    ...current,
                    position: "absolute",
                    [edge]: nextValue,
                  }));

                  if (!authoringHistory) {
                    update();
                    return;
                  }

                  const historyKey = `number:element-canonical-${edge}`;
                  authoringHistory.begin(historyKey, numberHistoryMeta);
                  authoringHistory.update(historyKey, update);
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
