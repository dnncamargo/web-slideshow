import type { ContainerElement, Presentation } from "@powershow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../../editor-workspace.module.css";

import { useAuthoringHistory } from "../../authoring-history-context";
import type { UpdateContainer } from "../container-inspector-helpers";

import {
  parseOptionalNumber,
  readAbsoluteNumber,
} from "../inspector-helpers";

import { InspectorSection } from "../inspector-section";
import { getContainerShareablePropertySource } from "../linked-style-inspector";
import { ContainerLinkedPropertyMeta } from "./container-linked-property-meta";

type SpacingField =
  | "padding"
  | "paddingTop"
  | "paddingRight"
  | "paddingBottom"
  | "paddingLeft"
  | "gap"
  | "margin"
  | "marginTop"
  | "marginRight"
  | "marginBottom"
  | "marginLeft";

type IndividualSpacingField = Exclude<SpacingField, "padding" | "gap" | "margin">;

interface ContainerSpacingSectionProps {
  element: ContainerElement;
  localElement?: ContainerElement;
  presentation?: Pick<Presentation, "linkedStyles">;

  onUpdate: UpdateContainer;
}

// ============================================================
// BEGIN: CONTAINER SPACING SECTION
// ============================================================

export function ContainerSpacingSection({
  element,
  localElement,
  presentation,
  onUpdate,
}: ContainerSpacingSectionProps) {
  const { t } = useStudioI18n();
  const authoringHistory = useAuthoringHistory();
  const numberHistoryMeta = { kind: "number.change", labelKey: "history.number.change" } as const;
  const local = localElement ?? element;
  const source = (property: Parameters<typeof getContainerShareablePropertySource>[2]) => getContainerShareablePropertySource(presentation, local, property);

  function historyKeyFor(field: SpacingField): string {
    return `number:container-${field === "gap" ? "gap" : field.replace(/([A-Z])/g, "-$1").toLowerCase()}`;
  }

  function updateStyleField(
    field: SpacingField,
    value: number | undefined,
  ) {
    const localValue = field === "gap"
      ? local.layout?.children?.gap
      : local.layout?.[field];

    if (Object.is(localValue, value)) {
      return;
    }

    const update = () => onUpdate((container) => field === "gap"
      ? {
          ...container,
          layout: {
            ...container.layout,
            children: { ...container.layout?.children, gap: value },
          },
        }
      : {
          ...container,
          layout: { ...container.layout, [field]: value },
        });
    const historyKey = historyKeyFor(field);

    if (!authoringHistory) {
      update();
      return;
    }

    authoringHistory.begin(historyKey, numberHistoryMeta);
    authoringHistory.update(historyKey, update);
  }

  function spacingMeta(field: IndividualSpacingField) {
    const property = `layout.${field}` as Parameters<typeof getContainerShareablePropertySource>[2];
    const state = source(property);
    return <ContainerLinkedPropertyMeta key={field} source={state.source} linkedValue={state.linkedValue} onReset={state.source === "local" && state.linkedValue !== undefined ? () => onUpdate((container) => ({ ...container, layout: { ...container.layout, [field]: undefined } })) : undefined} />;
  }

  return (
    <InspectorSection title={t("inspector.spacing")}>
      <div className={styles.fieldGrid}>
        <label className={styles.field}>
          <span title={t("inspector.paddingTooltip")}>
            {t("inspector.padding")}
          </span>

          <div className={styles.unitInput}>
            <input
              id="container-padding"
              name="containerPadding"
              type="number"
              min="0"
              value={readAbsoluteNumber(element.layout?.padding)}
              onFocus={() => authoringHistory?.begin(historyKeyFor("padding"), numberHistoryMeta)}
              onBlur={() => authoringHistory?.finish(historyKeyFor("padding"))}
              onChange={(event) => {
                updateStyleField("padding", parseOptionalNumber(event.target.value));
              }}
            />

            <span>px</span>
          </div>
          <ContainerLinkedPropertyMeta source={source("layout.padding").source} linkedValue={source("layout.padding").linkedValue} onReset={source("layout.padding").source === "local" && source("layout.padding").linkedValue !== undefined ? () => onUpdate((container) => ({ ...container, layout: { ...container.layout, padding: undefined } })) : undefined} />
        </label>

        <label className={styles.field}>
          <span title={t("inspector.gapTooltip")}>{t("inspector.gap")}</span>

          <div className={styles.unitInput}>
            <input
              id="container-gap"
              name="containerGap"
              type="number"
              min="0"
              value={readAbsoluteNumber(element.layout?.children?.gap)}
              onFocus={() => authoringHistory?.begin(historyKeyFor("gap"), numberHistoryMeta)}
              onBlur={() => authoringHistory?.finish(historyKeyFor("gap"))}
              onChange={(event) => {
                updateStyleField("gap", parseOptionalNumber(event.target.value));
              }}
            />

            <span>px</span>
          </div>
          <ContainerLinkedPropertyMeta source={source("layout.children.gap").source} linkedValue={source("layout.children.gap").linkedValue} onReset={source("layout.children.gap").source === "local" && source("layout.children.gap").linkedValue !== undefined ? () => onUpdate((container) => ({ ...container, layout: { ...container.layout, children: { ...container.layout?.children, gap: undefined } } })) : undefined} />
        </label>
      </div>

      <details className={styles.spacingDetails}>
        <summary>
          <span>{t("inspector.paddingSides")}</span>
        </summary>

        <div className={styles.spacingSides}>
          <label className={styles.field}>
            <span>{t("inspector.top")}</span>

            <div className={styles.unitInput}>
              <input
                id="container-padding-top"
                name="containerPaddingTop"
                type="number"
                min="0"
                value={readAbsoluteNumber(element.layout?.paddingTop)}
                onFocus={() => authoringHistory?.begin(historyKeyFor("paddingTop"), numberHistoryMeta)}
                onBlur={() => authoringHistory?.finish(historyKeyFor("paddingTop"))}
                onChange={(event) => {
                  updateStyleField(
                    "paddingTop",

                    parseOptionalNumber(event.target.value),
                  );
                }}
              />

              <span>px</span>
            </div>
            {spacingMeta("paddingTop")}
          </label>

          <label className={styles.field}>
            <span>{t("inspector.right")}</span>

            <div className={styles.unitInput}>
              <input
                id="container-padding-right"
                name="containerPaddingRight"
                type="number"
                min="0"
                value={readAbsoluteNumber(element.layout?.paddingRight)}
                onFocus={() => authoringHistory?.begin(historyKeyFor("paddingRight"), numberHistoryMeta)}
                onBlur={() => authoringHistory?.finish(historyKeyFor("paddingRight"))}
                onChange={(event) => {
                  updateStyleField(
                    "paddingRight",

                    parseOptionalNumber(event.target.value),
                  );
                }}
              />

              <span>px</span>
            </div>
            {spacingMeta("paddingRight")}
          </label>

          <label className={styles.field}>
            <span>{t("inspector.bottom")}</span>

            <div className={styles.unitInput}>
              <input
                id="container-padding-bottom"
                name="containerPaddingBottom"
                type="number"
                min="0"
                value={readAbsoluteNumber(element.layout?.paddingBottom)}
                onFocus={() => authoringHistory?.begin(historyKeyFor("paddingBottom"), numberHistoryMeta)}
                onBlur={() => authoringHistory?.finish(historyKeyFor("paddingBottom"))}
                onChange={(event) => {
                  updateStyleField(
                    "paddingBottom",

                    parseOptionalNumber(event.target.value),
                  );
                }}
              />

              <span>px</span>
            </div>
            {spacingMeta("paddingBottom")}
          </label>

          <label className={styles.field}>
            <span>{t("inspector.left")}</span>

            <div className={styles.unitInput}>
              <input
                id="container-padding-left"
                name="containerPaddingLeft"
                type="number"
                min="0"
                value={readAbsoluteNumber(element.layout?.paddingLeft)}
                onFocus={() => authoringHistory?.begin(historyKeyFor("paddingLeft"), numberHistoryMeta)}
                onBlur={() => authoringHistory?.finish(historyKeyFor("paddingLeft"))}
                onChange={(event) => {
                  updateStyleField(
                    "paddingLeft",

                    parseOptionalNumber(event.target.value),
                  );
                }}
              />

              <span>px</span>
            </div>
            {spacingMeta("paddingLeft")}
          </label>
        </div>
      </details>

      <label className={styles.field}>
          <span title={t("inspector.marginTooltip")}>
            {t("inspector.margin")}
          </span>

        <div className={styles.unitInput}>
          <input
            id="container-margin"
            name="containerMargin"
            type="number"
            min="0"
            value={readAbsoluteNumber(element.layout?.margin)}
            onFocus={() => authoringHistory?.begin(historyKeyFor("margin"), numberHistoryMeta)}
            onBlur={() => authoringHistory?.finish(historyKeyFor("margin"))}
            onChange={(event) => {
              updateStyleField("margin", parseOptionalNumber(event.target.value));
            }}
          />

          <span>px</span>
        </div>
        <ContainerLinkedPropertyMeta source={source("layout.margin").source} linkedValue={source("layout.margin").linkedValue} onReset={source("layout.margin").source === "local" && source("layout.margin").linkedValue !== undefined ? () => onUpdate((container) => ({ ...container, layout: { ...container.layout, margin: undefined } })) : undefined} />
      </label>

      <details className={styles.spacingDetails}>
        <summary>
          <span>{t("inspector.marginSides")}</span>
        </summary>

        <div className={styles.spacingSides}>
          <label className={styles.field}>
            <span>{t("inspector.top")}</span>

            <div className={styles.unitInput}>
              <input
                id="container-margin-top"
                name="containerMarginTop"
                type="number"
                min="0"
                value={readAbsoluteNumber(element.layout?.marginTop)}
                onFocus={() => authoringHistory?.begin(historyKeyFor("marginTop"), numberHistoryMeta)}
                onBlur={() => authoringHistory?.finish(historyKeyFor("marginTop"))}
                onChange={(event) => {
                  updateStyleField(
                    "marginTop",

                    parseOptionalNumber(event.target.value),
                  );
                }}
              />

              <span>px</span>
            </div>
            {spacingMeta("marginTop")}
          </label>

          <label className={styles.field}>
            <span>{t("inspector.right")}</span>

            <div className={styles.unitInput}>
              <input
                id="container-margin-right"
                name="containerMarginRight"
                type="number"
                min="0"
                value={readAbsoluteNumber(element.layout?.marginRight)}
                onFocus={() => authoringHistory?.begin(historyKeyFor("marginRight"), numberHistoryMeta)}
                onBlur={() => authoringHistory?.finish(historyKeyFor("marginRight"))}
                onChange={(event) => {
                  updateStyleField(
                    "marginRight",

                    parseOptionalNumber(event.target.value),
                  );
                }}
              />

              <span>px</span>
            </div>
            {spacingMeta("marginRight")}
          </label>

          <label className={styles.field}>
            <span>{t("inspector.bottom")}</span>

            <div className={styles.unitInput}>
              <input
                id="container-margin-bottom"
                name="containerMarginBottom"
                type="number"
                min="0"
                value={readAbsoluteNumber(element.layout?.marginBottom)}
                onFocus={() => authoringHistory?.begin(historyKeyFor("marginBottom"), numberHistoryMeta)}
                onBlur={() => authoringHistory?.finish(historyKeyFor("marginBottom"))}
                onChange={(event) => {
                  updateStyleField(
                    "marginBottom",

                    parseOptionalNumber(event.target.value),
                  );
                }}
              />

              <span>px</span>
            </div>
            {spacingMeta("marginBottom")}
          </label>

          <label className={styles.field}>
            <span>{t("inspector.left")}</span>

            <div className={styles.unitInput}>
              <input
                id="container-margin-left"
                name="containerMarginLeft"
                type="number"
                min="0"
                value={readAbsoluteNumber(element.layout?.marginLeft)}
                onFocus={() => authoringHistory?.begin(historyKeyFor("marginLeft"), numberHistoryMeta)}
                onBlur={() => authoringHistory?.finish(historyKeyFor("marginLeft"))}
                onChange={(event) => {
                  updateStyleField(
                    "marginLeft",

                    parseOptionalNumber(event.target.value),
                  );
                }}
              />

              <span>px</span>
            </div>
            {spacingMeta("marginLeft")}
          </label>
        </div>
      </details>
    </InspectorSection>
  );
}

// ============================================================
// END: CONTAINER SPACING SECTION
// ============================================================
