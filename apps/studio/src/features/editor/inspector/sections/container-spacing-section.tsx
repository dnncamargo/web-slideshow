import type { ContainerElement, Presentation } from "@powershow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../../editor-workspace.module.css";

import type { UpdateContainer } from "../container-inspector-helpers";

import {
  parseOptionalNumber,
  readAbsoluteNumber,
} from "../inspector-helpers";

import { InspectorSection } from "../inspector-section";
import { getContainerShareablePropertySource } from "../linked-style-inspector";
import { ContainerLinkedPropertyMeta } from "./container-linked-property-meta";

type IndividualSpacingField =
  | "paddingTop"
  | "paddingRight"
  | "paddingBottom"
  | "paddingLeft"
  | "marginTop"
  | "marginRight"
  | "marginBottom"
  | "marginLeft";

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
  const local = localElement ?? element;
  const source = (property: Parameters<typeof getContainerShareablePropertySource>[2]) => getContainerShareablePropertySource(presentation, local, property);

  function updateStyleField(
    field: IndividualSpacingField,
    value: number | undefined,
  ) {
    onUpdate((container) => ({
      ...container,

      layout: { ...container.layout, [field]: value },
    }));
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
              onChange={(event) => {
                const number = parseOptionalNumber(event.target.value);

                onUpdate((container) => ({
                  ...container,

                  layout: { ...container.layout, padding: number },
                }));
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
              onChange={(event) => {
                const number = parseOptionalNumber(event.target.value);

                onUpdate((container) => ({
                  ...container, layout: { ...container.layout, children: { ...container.layout?.children, gap: number } },
                }));
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
                onChange={(event) => {
                  updateStyleField(
                    "paddingTop",

                    parseOptionalNumber(event.target.value),
                  );
                }}
              />

              <span>px</span>
            </div>
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
                onChange={(event) => {
                  updateStyleField(
                    "paddingRight",

                    parseOptionalNumber(event.target.value),
                  );
                }}
              />

              <span>px</span>
            </div>
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
                onChange={(event) => {
                  updateStyleField(
                    "paddingBottom",

                    parseOptionalNumber(event.target.value),
                  );
                }}
              />

              <span>px</span>
            </div>
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
                onChange={(event) => {
                  updateStyleField(
                    "paddingLeft",

                    parseOptionalNumber(event.target.value),
                  );
                }}
              />

              <span>px</span>
            </div>
          </label>
        </div>
      </details>
      <div>{(["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"] as const).map(spacingMeta)}</div>

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
            onChange={(event) => {
              const number = parseOptionalNumber(event.target.value);

              onUpdate((container) => ({
                ...container,

                layout: { ...container.layout, margin: number },
              }));
            }}
          />

          <span>px</span>
        </div>
      </label>
      <ContainerLinkedPropertyMeta source={source("layout.margin").source} linkedValue={source("layout.margin").linkedValue} onReset={source("layout.margin").source === "local" && source("layout.margin").linkedValue !== undefined ? () => onUpdate((container) => ({ ...container, layout: { ...container.layout, margin: undefined } })) : undefined} />

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
                onChange={(event) => {
                  updateStyleField(
                    "marginTop",

                    parseOptionalNumber(event.target.value),
                  );
                }}
              />

              <span>px</span>
            </div>
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
                onChange={(event) => {
                  updateStyleField(
                    "marginRight",

                    parseOptionalNumber(event.target.value),
                  );
                }}
              />

              <span>px</span>
            </div>
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
                onChange={(event) => {
                  updateStyleField(
                    "marginBottom",

                    parseOptionalNumber(event.target.value),
                  );
                }}
              />

              <span>px</span>
            </div>
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
                onChange={(event) => {
                  updateStyleField(
                    "marginLeft",

                    parseOptionalNumber(event.target.value),
                  );
                }}
              />

              <span>px</span>
            </div>
          </label>
        </div>
      </details>
      <div>{(["marginTop", "marginRight", "marginBottom", "marginLeft"] as const).map(spacingMeta)}</div>
    </InspectorSection>
  );
}

// ============================================================
// END: CONTAINER SPACING SECTION
// ============================================================
