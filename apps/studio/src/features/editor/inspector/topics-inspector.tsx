import { useEffect, useRef, useState } from "react";

import type {
  ElementInspectorUpdate,
  TopicsAuthoringControls,
} from "./inspector-types";

import type {
  PowerShowElement,
  TopicItem,
  TopicsElement,
  TopicMarkerStyle,
  FontResource,
  LinkedTopicsStyle,
  LinkedStyle,
  Presentation,
} from "@powershow/document-schema";
import { resolveLinkedTopicsStyle } from "@powershow/document-schema";

import {
  resolveEffectiveElementStyleDefaults,
  TOPICS_ITEM_GAP_DEFAULT_PX,
} from "@powershow/theme/element-style-defaults";

import { ELEMENT_TYPE_MESSAGE_KEYS } from "@/features/i18n/studio-i18n";
import { useStudioI18n } from "@/features/i18n/studio-i18n-context";
import type { StudioTranslate } from "@/features/i18n/studio-i18n";

import styles from "../editor-workspace.module.css";

import {
  MAX_TOPIC_STRUCTURAL_DEPTH,
  removeTopicItemFromTopicItems,
  updateTopicsTextColor,
  updateTopicItemTextContent,
} from "../element-operations";

import { getTextContentPlainText } from "../rich-text-authoring";

import { InspectorSection } from "./inspector-section";
import { ColorControl } from "./sections/color-control";
import { ElementTypographyControl } from "./sections/element-typography-control";
import { EffectiveNumberInput } from "./sections/effective-number-input";
import { ElementSpacingSection } from "./sections/element-spacing-section";

const UNORDERED_MARKER_STYLES: readonly TopicMarkerStyle[] = [
  "disc",
  "circle",
  "square",
  "none",
];

const ORDERED_MARKER_STYLES: readonly TopicMarkerStyle[] = [
  "decimal",
  "lower-alpha",
  "upper-alpha",
  "lower-roman",
  "upper-roman",
  "none",
];

interface TopicsInspectorProps {
  element: TopicsElement;

  onUpdate: ElementInspectorUpdate;

  topicsAuthoringControls: TopicsAuthoringControls;

  fontResources: readonly FontResource[];

  presentation?: Pick<Presentation, "linkedStyles">;

  onAttachLinkedTopicsStyle?: (linkedStyleId: string) => void;

  onDetachLinkedTopicsStyle?: () => void;
}

interface TopicRowProps {
  item: TopicItem;

  depth: number;

  addChildLabel: string;

  maxDepthAddChildLabel: string;

  removeLabel: string;

  onTextChange: (topicItemId: string, content: string) => void;

  onAddChild: (topicItemId: string) => void;

  onRemove: (topicItemId: string) => void;

  registerInputRef: (
    topicItemId: string,
    node: HTMLInputElement | null,
  ) => void;
}

function findDirectTextChild(
  item: TopicItem,
): Extract<PowerShowElement, { type: "text" }> | null {
  const textChild = item.content.children.find((child) => child.type === "text");

  return textChild?.type === "text" ? textChild : null;
}

function getTopicContentLabels(
  item: TopicItem,
  t: StudioTranslate,
): string[] {
  const labels: string[] = [];

  for (const child of item.content.children) {
    if (child.type === "text") {
      continue;
    }

    labels.push(t(ELEMENT_TYPE_MESSAGE_KEYS[child.type]));
  }

  return labels;
}

function summarizeTopicContent(labels: readonly string[]): string | null {
  if (labels.length === 0) {
    return null;
  }

  if (labels.length <= 3) {
    return labels.join(" · ");
  }

  return `${labels.slice(0, 3).join(" · ")} · +${labels.length - 3}`;
}

function normalizeTopicMarkerStyle(
  kind: NonNullable<TopicsElement["kind"]>,
  rootMarkerStyle: TopicMarkerStyle | undefined,
): TopicMarkerStyle | undefined {
  if (rootMarkerStyle === undefined || rootMarkerStyle === "none") {
    return rootMarkerStyle;
  }

  const allowedStyles =
    kind === "ordered" ? ORDERED_MARKER_STYLES : UNORDERED_MARKER_STYLES;

  return allowedStyles.includes(rootMarkerStyle)
    ? rootMarkerStyle
    : kind === "ordered"
      ? "decimal"
      : "disc";
}

function topicMarkerStyleOptions(
  kind: NonNullable<TopicsElement["kind"]>,
): readonly TopicMarkerStyle[] {
  return kind === "ordered" ? ORDERED_MARKER_STYLES : UNORDERED_MARKER_STYLES;
}

function isLinkedTopicsStyle(style: LinkedStyle): style is LinkedTopicsStyle {
  return "target" in style && style.target === "topics";
}

function TopicRow({
  item,
  depth,
  addChildLabel,
  maxDepthAddChildLabel,
  removeLabel,
  onTextChange,
  onAddChild,
  onRemove,
  registerInputRef,
}: TopicRowProps) {
  const { t } = useStudioI18n();
  const textChild = findDirectTextChild(item);
  const hasDirectText = textChild !== null;
  const contentLabels = getTopicContentLabels(item, t);
  const contentSummary = summarizeTopicContent(contentLabels);
  const atMaxStructuralDepth =
    depth + 1 >= MAX_TOPIC_STRUCTURAL_DEPTH;

  const addChildTitle = atMaxStructuralDepth
    ? maxDepthAddChildLabel
    : addChildLabel;

  return (
    <li
      className={styles.topicsRow}
      data-powershow-topic-item-id={item.id}
      style={{ paddingInlineStart: depth * 18 }}
    >
      <div className={styles.topicsRowLine}>
        <span className={styles.topicsBullet} aria-hidden="true">
          •
        </span>

        {hasDirectText ? (
          <input
            ref={(node) => {
              registerInputRef(item.id, node);
            }}
            className={`${styles.inspectorControl} ${styles.topicsField} ${styles.topicsInput}`}
            data-powershow-topic-input="true"
            data-powershow-topic-content-state="editable"
            type="text"
            value={textChild ? getTextContentPlainText(textChild.content) : ""}
            onChange={(event) => {
              onTextChange(item.id, event.currentTarget.value);
            }}
          />
        ) : (
          <span
            className={`${styles.inspectorControl} ${styles.topicsField} ${styles.topicsReadOnlyField}`}
            data-powershow-topic-content-state={
              contentLabels.length > 0 ? "descriptor" : "empty"
            }
          >
            {contentSummary ?? t("inspector.topics.empty")}
          </span>
        )}

        <button
          type="button"
          className="ps-ui-action ps-ui-action--icon"
          data-powershow-topic-add-child="true"
          title={addChildTitle}
          aria-label={addChildTitle}
          disabled={atMaxStructuralDepth}
          onClick={() => {
            onAddChild(item.id);
          }}
        >
          ↳
        </button>

        <button
          type="button"
          className="ps-ui-action ps-ui-action--icon"
          data-powershow-topic-remove="true"
          title={removeLabel}
          aria-label={removeLabel}
          onClick={() => {
            onRemove(item.id);
          }}
        >
          ×
          </button>
      </div>

      {hasDirectText && contentSummary ? (
        <div
          className={styles.topicsSummary}
          data-powershow-topic-content-summary="true"
        >
          {contentSummary}
        </div>
      ) : null}

      {item.children.length > 0 && (
        <ul className={styles.topicsChildren}>
          {item.children.map((child) => (
            <TopicRow
              key={child.id}
              item={child}
              depth={depth + 1}
              addChildLabel={addChildLabel}
              maxDepthAddChildLabel={maxDepthAddChildLabel}
              removeLabel={removeLabel}
              onTextChange={onTextChange}
              onAddChild={onAddChild}
              onRemove={onRemove}
              registerInputRef={registerInputRef}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function TopicsInspector({
  element,
  onUpdate,
  topicsAuthoringControls,
  fontResources,
  presentation,
  onAttachLinkedTopicsStyle = () => {},
  onDetachLinkedTopicsStyle = () => {},
}: TopicsInspectorProps) {
  const { t } = useStudioI18n();
  const [pendingFocusTopicItemId, setPendingFocusTopicItemId] = useState<
    string | null
  >(null);
  const inputRefs = useRef(new Map<string, HTMLInputElement | null>());

  useEffect(() => {
    if (!pendingFocusTopicItemId) {
      return;
    }

    const input = inputRefs.current.get(pendingFocusTopicItemId);

    if (!input) {
      return;
    }

    input.focus();
    input.select();
    setPendingFocusTopicItemId(null);
  }, [element.items, pendingFocusTopicItemId]);

  function updateCurrentTopics(
    update: (topics: TopicsElement) => TopicsElement,
  ) {
    onUpdate((current) => {
      if (current.type !== "topics") {
        return current;
      }

      const next = update(current);

      return next === current ? current : next;
    });
  }

  function updateTopicsTypography(
    update: (typography: TopicsElement["typography"]) => TopicsElement["typography"],
  ) {
    updateCurrentTopics((current) => {
      const typography = update(current.typography);

      return typography === current.typography
        ? current
        : {
            ...current,
            typography,
          };
    });
  }

  function updateTopicContent(topicItemId: string, content: string) {
    updateCurrentTopics((current) => {
      const items = updateTopicItemTextContent(
        current.items,
        topicItemId,
        content,
      );

      return items === current.items
        ? current
        : {
            ...current,
            items,
          };
    });
  }

  function addTopLevelTopic() {
    const createdTopicItemId = topicsAuthoringControls.onAddTopLevelTopic(
      element.id,
    );

    if (createdTopicItemId) {
      setPendingFocusTopicItemId(createdTopicItemId);
    }
  }

function addChildTopic(topicItemId: string) {
  const createdTopicItemId = topicsAuthoringControls.onAddChildTopic(
    element.id,
    topicItemId,
  );

    if (createdTopicItemId) {
      setPendingFocusTopicItemId(createdTopicItemId);
    }
  }

  function removeTopic(topicItemId: string) {
    updateCurrentTopics((current) => {
      const items = removeTopicItemFromTopicItems(current.items, topicItemId);

      return items === current.items
        ? current
        : {
            ...current,
            items,
          };
    });
  }

  const topicStyleDefaults = resolveEffectiveElementStyleDefaults({
    type: "text",
    variant: "body",
  }).typography;

  const effectiveKind = presentation && element.linkedStyleId !== undefined
    ? resolveLinkedTopicsStyle(presentation, element).kind
    : element.kind ?? "unordered";
  const markerStyleOptions = topicMarkerStyleOptions(effectiveKind);
  const linkedTopicsStyles = (presentation?.linkedStyles ?? []).filter(isLinkedTopicsStyle);
  const linkedStyleName = linkedTopicsStyles.find((style) => style.id === element.linkedStyleId)?.name;

  return (
    <>
      <div className={styles.inspectorDivider} />

      <InspectorSection title={t("inspector.linkedTopicsStyle")} defaultOpen>
        <label className={styles.field}>
          <span>{t("inspector.linkedTopicsStyle")}</span>
          <select
            id="topics-linked-style"
            value={element.linkedStyleId ?? ""}
            onChange={(event) => {
              if (event.target.value) onAttachLinkedTopicsStyle(event.target.value);
              else if (element.linkedStyleId !== undefined) onDetachLinkedTopicsStyle();
            }}
          >
            <option value="">{t("inspector.noLinkedTopicsStyle")}</option>
            {linkedTopicsStyles.map((style) => (
              <option key={style.id} value={style.id}>{style.name}</option>
            ))}
          </select>
        </label>

        {element.linkedStyleId !== undefined ? (
          <div className={styles.colorLinkedStatus} role="status">
            <span>{t("inspector.linkedTopicsStyleNamed", { style: linkedStyleName ?? element.linkedStyleId })}</span>
            <button type="button" onClick={onDetachLinkedTopicsStyle}>
              {t("inspector.detachLinkedTopicsStyleNamed", { style: linkedStyleName ?? element.linkedStyleId })}
            </button>
          </div>
        ) : (
          <div className={styles.colorLinkedStatus} role="status">
            {t("inspector.noLinkedTopicsStyleAttached")}
          </div>
        )}
      </InspectorSection>

      <InspectorSection title={t("inspector.content")} defaultOpen>
        <span className={styles.fieldHint}>
          {t("inspector.topics.items", {
            count: element.items.length,
          })}
        </span>

        <ul className={styles.topicsList}>
          {element.items.map((item) => (
            <TopicRow
              key={item.id}
              item={item}
              depth={0}
              addChildLabel={t("inspector.topics.addChild")}
              maxDepthAddChildLabel={t("inspector.topics.maxDepth")}
              removeLabel={t("inspector.topics.remove")}
              onTextChange={updateTopicContent}
              onAddChild={addChildTopic}
              onRemove={removeTopic}
              registerInputRef={(topicItemId, node) => {
                if (node) {
                  inputRefs.current.set(topicItemId, node);
                } else {
                  inputRefs.current.delete(topicItemId);
                }
              }}
            />
          ))}
        </ul>

        <button
          type="button"
          className="ps-ui-action"
          onClick={addTopLevelTopic}
        >
          <span>{t("inspector.topics.add")}</span>
        </button>

        <div className={styles.fieldGrid}>
          <label className={styles.field}>
            <span>{t("inspector.topics.kind")}</span>

            <select
              id="topics-kind"
              name="topicsKind"
              value={effectiveKind}
              onChange={(event) => {
                const kind = event.target.value as NonNullable<TopicsElement["kind"]>;

                updateCurrentTopics((current) => {
                  const rootMarkerStyle = normalizeTopicMarkerStyle(
                    kind,
                    current.rootMarkerStyle,
                  );

                  if (
                    current.kind === kind &&
                    rootMarkerStyle === current.rootMarkerStyle
                  ) {
                    return current;
                  }

                  return {
                    ...current,
                    kind,
                    rootMarkerStyle,
                  };
                });
              }}
            >
              <option value="unordered">
                {t("inspector.topics.unordered")}
              </option>

              <option value="ordered">{t("inspector.topics.ordered")}</option>
            </select>
          </label>

          <div className={styles.field}>
            <span>{t("inspector.topics.itemGap")}</span>

            <EffectiveNumberInput
              id="topics-item-gap"
              name="topicsItemGap"
              value={element.itemGap ?? TOPICS_ITEM_GAP_DEFAULT_PX}
              inherited={element.itemGap === undefined}
              unit="px"
              min="0"
              onChange={(value) => {
                updateCurrentTopics((current) => ({
                  ...current,
                  itemGap: value === "" ? undefined : Number(value),
                }));
              }}
              onReset={() => {
                updateCurrentTopics((current) => ({
                  ...current,
                  itemGap: undefined,
                }));
              }}
            />
          </div>
        </div>
      </InspectorSection>

      <InspectorSection title={t("inspector.typography")}>
        {topicStyleDefaults && (
          <ElementTypographyControl
            typography={element.typography}
            effectiveDefaults={topicStyleDefaults}
            onUpdateTypography={(update) => {
              updateTopicsTypography((currentTypography) => update(currentTypography));
            }}
            controlPrefix="topics"
            fontResources={fontResources}
          />
        )}
      </InspectorSection>

      <ElementSpacingSection
        layout={element.layout}
        controlPrefix="topics"
        onUpdateLayout={(update) => {
          updateCurrentTopics((current) => ({
            ...current,
            layout: update(current.layout),
          }));
        }}
      />

      <InspectorSection title={t("inspector.appearance")}>
        <div className={styles.appearanceSubgroup}>
          <span className={styles.appearanceSubheading}>
            {t("inspector.topics.markers")}
          </span>

          <label className={styles.field}>
            <span>{t("inspector.topics.rootMarkerStyle")}</span>

            <select
              id="topics-marker-style"
              name="topicsMarkerStyle"
              value={element.rootMarkerStyle ?? ""}
              onChange={(event) => {
                const nextRootMarkerStyle =
                  event.target.value === ""
                    ? undefined
                    : (event.target.value as TopicMarkerStyle);

                updateCurrentTopics((current) => {
                  const normalized = normalizeTopicMarkerStyle(
                    effectiveKind,
                    nextRootMarkerStyle,
                  );

                  if (normalized === current.rootMarkerStyle) {
                    return current;
                  }

                  return {
                    ...current,
                    rootMarkerStyle: normalized,
                  };
                });
              }}
            >
              <option value="">{t("inspector.default")}</option>

              {markerStyleOptions.map((markerStyle) => (
                <option key={markerStyle} value={markerStyle}>
                  {t(`inspector.topics.rootMarkerStyle.${markerStyle}`)}
                </option>
              ))}
            </select>
          </label>

          <div className={styles.colorControl}>
            <label className={styles.field}>
              <span>{t("inspector.topics.markerColor")}</span>

              <ColorControl
                id="topics-marker-color"
                name="topicsMarkerColor"
                value={element.markerColor}
                onChange={(markerColor) => {
                  updateCurrentTopics((current) => ({
                    ...current,
                    markerColor,
                  }));
                }}
                secondaryAction={{ label: t("inspector.useThemeDefault"), onClick: () => updateCurrentTopics((current) => ({ ...current, markerColor: undefined })) }}
              />
            </label>
          </div>
        </div>

        <div className={styles.appearanceSubgroup}>
          <span className={styles.appearanceSubheading}>
            {t("inspector.text")}
          </span>

          <div className={styles.colorControl}>
            <label className={styles.field}>
              <span>{t("inspector.topics.textColor")}</span>

              <ColorControl
                id="topics-text-color"
                name="topicsTextColor"
                value={element.style?.color}
                onChange={(color, source) => {
                  const mode = source === "format" || source === "detach"
                    ? "preserve-overrides"
                    : "apply";
                  updateCurrentTopics((current) => updateTopicsTextColor(current, color, mode));
                }}
                secondaryAction={{ label: t("inspector.useThemeDefault"), onClick: () => updateCurrentTopics((current) => updateTopicsTextColor(current, undefined, "preserve-overrides")) }}
              />
            </label>
          </div>
        </div>
      </InspectorSection>

    </>
  );
}
