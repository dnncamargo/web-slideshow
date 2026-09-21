import type { Length } from "@web-slideshow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../../editor-workspace.module.css";

import { useAuthoringHistory } from "../../authoring-history-context";

import {
  parseOptionalNumber,
  readAbsoluteNumber,
} from "../inspector-helpers";

import { InspectorSection } from "../inspector-section";

export interface ElementSpacingLayout {
  margin?: Length | undefined;
  marginTop?: Length | undefined;
  marginRight?: Length | undefined;
  marginBottom?: Length | undefined;
  marginLeft?: Length | undefined;
}

type ElementSpacingField = keyof ElementSpacingLayout;

const ELEMENT_MARGIN_SIDE_FIELDS: readonly (
  | "marginTop"
  | "marginRight"
  | "marginBottom"
  | "marginLeft"
)[] = ["marginTop", "marginRight", "marginBottom", "marginLeft"];

const ELEMENT_MARGIN_SIDE_LABELS: Record<
  (typeof ELEMENT_MARGIN_SIDE_FIELDS)[number],
  "inspector.top" | "inspector.right" | "inspector.bottom" | "inspector.left"
> = {
  marginTop: "inspector.top",
  marginRight: "inspector.right",
  marginBottom: "inspector.bottom",
  marginLeft: "inspector.left",
};

const ELEMENT_MARGIN_HISTORY_FIELDS: Record<ElementSpacingField, string> = {
  margin: "margin",
  marginTop: "margin-top",
  marginRight: "margin-right",
  marginBottom: "margin-bottom",
  marginLeft: "margin-left",
};

interface ElementSpacingSectionProps {
  layout: ElementSpacingLayout | undefined;
  controlPrefix: string;

  onUpdateLayout: (
    update: (
      layout: ElementSpacingLayout | undefined,
    ) => ElementSpacingLayout | undefined,
  ) => void;
  effectiveLayout?: ElementSpacingLayout;
  disabledFields?: readonly ElementSpacingField[];
}

function updateMarginField(
  layout: ElementSpacingLayout | undefined,
  field: ElementSpacingField,
  value: number | undefined,
): ElementSpacingLayout | undefined {
  if (layout === undefined && value === undefined) {
    return undefined;
  }

  const next = { ...(layout ?? {}) };

  if (value === undefined) {
    delete next[field];
  } else {
    next[field] = value;
  }

  return Object.keys(next).length === 0 ? undefined : next;
}

// ============================================================
// BEGIN: ELEMENT SPACING SECTION
//
// Semantic SPACING section shared by canonical elements. It mirrors
// the Container spacing section shape (all-sides control plus a
// per-side details group) and reuses the same editor styles and
// control convention. Only the canonical spacing properties actually
// supported by these elements are written — currently the
// `layout.margin*` family. Every other layout property is preserved.
// ============================================================

export function ElementSpacingSection({
  layout,
  controlPrefix,
  onUpdateLayout,
  effectiveLayout,
  disabledFields = [],
}: ElementSpacingSectionProps) {
  const { t } = useStudioI18n();
  const authoringHistory = useAuthoringHistory();
  const numberHistoryMeta = { kind: "number.change", labelKey: "history.number.change" } as const;
  const displayedLayout = { ...(layout ?? {}), ...(effectiveLayout ?? {}) };
  const isDisabled = (field: ElementSpacingField): boolean => disabledFields.includes(field);

  function updateField(field: ElementSpacingField, value: number | undefined) {
    if (isDisabled(field)) return;
    if (Object.is(layout?.[field], value)) {
      return;
    }

    const update = () => onUpdateLayout((current) => updateMarginField(current, field, value));
    const historyKey = `number:${controlPrefix}-${ELEMENT_MARGIN_HISTORY_FIELDS[field]}`;

    if (!authoringHistory) {
      update();
      return;
    }

    authoringHistory.begin(historyKey, numberHistoryMeta);
    authoringHistory.update(historyKey, update);
  }

  return (
    <InspectorSection title={t("inspector.spacing")}>
      <label className={styles.field}>
        <span title={t("inspector.marginTooltip")}>{t("inspector.margin")}</span>

        <div className={styles.unitInput}>
          <input
            id={`${controlPrefix}-margin`}
            name={`${controlPrefix}Margin`}
            type="number"
            min="0"
            value={readAbsoluteNumber(displayedLayout.margin)}
            disabled={isDisabled("margin")}
            onFocus={() => { if (!isDisabled("margin")) authoringHistory?.begin(`number:${controlPrefix}-margin`, numberHistoryMeta); }}
            onBlur={() => { if (!isDisabled("margin")) authoringHistory?.finish(`number:${controlPrefix}-margin`); }}
            onChange={(event) => {
              updateField("margin", parseOptionalNumber(event.target.value));
            }}
          />

          <span>px</span>
        </div>
      </label>

      <details className={styles.spacingDetails}>
        <summary>
          <span>{t("inspector.marginSides")}</span>
        </summary>

        <div className={styles.spacingSides}>
          {ELEMENT_MARGIN_SIDE_FIELDS.map((field) => {
            const side = field.slice("margin".length).toLowerCase();

            return (
              <label className={styles.field} key={field}>
                <span>{t(ELEMENT_MARGIN_SIDE_LABELS[field])}</span>

                <div className={styles.unitInput}>
                  <input
                    id={`${controlPrefix}-margin-${side}`}
                    name={`${controlPrefix}Margin${side[0].toUpperCase()}${side.slice(1)}`}
                    type="number"
                    min="0"
                    value={readAbsoluteNumber(displayedLayout[field])}
                    disabled={isDisabled(field)}
                    onFocus={() => { if (!isDisabled(field)) authoringHistory?.begin(`number:${controlPrefix}-${ELEMENT_MARGIN_HISTORY_FIELDS[field]}`, numberHistoryMeta); }}
                    onBlur={() => { if (!isDisabled(field)) authoringHistory?.finish(`number:${controlPrefix}-${ELEMENT_MARGIN_HISTORY_FIELDS[field]}`); }}
                    onChange={(event) => {
                      updateField(
                        field,

                        parseOptionalNumber(event.target.value),
                      );
                    }}
                  />

                  <span>px</span>
                </div>
              </label>
            );
          })}
        </div>
      </details>
    </InspectorSection>
  );
}

// ============================================================
// END: ELEMENT SPACING SECTION
// ============================================================
