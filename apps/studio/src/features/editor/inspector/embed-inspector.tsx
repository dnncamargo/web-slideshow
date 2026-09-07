import { useState } from "react";

import type { KeyboardEvent as ReactKeyboardEvent } from "react";

import {
  isAbsoluteHttpHref,
  type EmbedViewport,
  type EmbedElement,
} from "@powershow/document-schema";

import { useStudioI18n } from "@/features/i18n/studio-i18n-context";

import styles from "../editor-workspace.module.css";

import { InspectorSection } from "./inspector-section";

import type {
  TypedInspectorProps,
  UpdateSurfaceStyle,
} from "./inspector-types";

import { CanonicalSurfaceAppearanceSection } from "./sections/canonical-surface-appearance-section";
import { CanonicalElementEffectsSection } from "./sections/canonical-element-effects-section";

// ============================================================
// BEGIN: EMBED INSPECTOR
//
// Embed is external web content rendered as a sandboxed iframe by
// the shared renderer. The Studio authoring surface only edits its
// canonical src, accessibility title, and Embed-specific viewport.
//
// The renderer sandbox, Permissions Policy and lazy loading are
// frozen renderer-owned behavior and are NOT authored from Studio.
//
// src and title are canonical requirements, so neither is written
// directly on keystroke. Local drafts commit only on blur/Enter;
// invalid drafts never enter the document and reset to the current
// canonical value.
// ============================================================

export function EmbedInspector({
  element,
  onUpdate,
}: TypedInspectorProps<EmbedElement>) {
  const { t } = useStudioI18n();

  const [srcDraft, setSrcDraft] = useState<string>(element.src);

  const [titleDraft, setTitleDraft] = useState<string>(element.title);

  const [invalidSrcMessage, setInvalidSrcMessage] = useState<string | null>(
    null,
  );

  const [titleRequiredMessage, setTitleRequiredMessage] = useState<
    string | null
  >(null);

  // Hydrate the form whenever the selected element or its canonical
  // values change. Switching between selected elements must not leak
  // the previous element's drafts. State is adjusted during render
  // (React's recommended alternative to setState in effects) because
  // the drafts must reset when the canonical values change. No document
  // write happens during hydration.
  const [hydratedFor, setHydratedFor] = useState<{
    id: string;
    src: string;
    title: string;
  }>({
    id: element.id,
    src: element.src,
    title: element.title,
  });

  if (
    hydratedFor.id !== element.id ||
    hydratedFor.src !== element.src ||
    hydratedFor.title !== element.title
  ) {
    setHydratedFor({
      id: element.id,
      src: element.src,
      title: element.title,
    });

    setSrcDraft(element.src);
    setTitleDraft(element.title);
    setInvalidSrcMessage(null);
    setTitleRequiredMessage(null);
  }

  const updateStyle: UpdateSurfaceStyle = (update) => {
    onUpdate((current) => {
      if (current.type !== "embed") {
        return current;
      }

      return {
        ...current,

        style: update(current.style),
      };
    });
  };

  function updateViewportField(
    field: keyof EmbedViewport,
    rawValue: string,
  ): void {
    if (rawValue.trim() === "") {
      return;
    }

    const value = Number(rawValue);

    if (!Number.isFinite(value)) {
      return;
    }

    const canonicalValue = field === "zoom" ? value / 100 : value;
    const isValid =
      field === "zoom"
        ? canonicalValue >= 0.1 && canonicalValue <= 4
        : canonicalValue >= 0;

    if (!isValid) {
      return;
    }

    onUpdate((current) => {
      if (current.type !== "embed") {
        return current;
      }

      const nextViewport: EmbedViewport = {
        ...current.viewport,
        [field]: canonicalValue,
      };

      for (const [key, nextValue] of Object.entries(nextViewport) as [
        keyof EmbedViewport,
        number | undefined,
      ][]) {
        if (
          nextValue === undefined ||
          (key === "zoom" ? nextValue === 1 : nextValue === 0)
        ) {
          delete nextViewport[key];
        }
      }

      return {
        ...current,
        ...(Object.keys(nextViewport).length === 0
          ? { viewport: undefined }
          : { viewport: nextViewport }),
      };
    });
  }

  function commitSrcDraft(): void {
    const src = srcDraft;

    if (isAbsoluteHttpHref(src)) {
      setInvalidSrcMessage(null);
      setSrcDraft(src);

      onUpdate((current) => {
        if (current.type !== "embed") {
          return current;
        }

        return {
          ...current,

          src,
        };
      });

      return;
    }

    setInvalidSrcMessage(t("embed.invalidUrl"));
    setSrcDraft(element.src);
  }

  function handleSrcKeyDown(
    event: ReactKeyboardEvent<HTMLInputElement>,
  ): void {
    if (event.key === "Escape") {
      setSrcDraft(element.src);
      setInvalidSrcMessage(null);

      return;
    }

    if (event.key === "Enter") {
      event.currentTarget.blur();
    }
  }

  function commitTitleDraft(): void {
    const title = titleDraft;

    if (title.length >= 1) {
      setTitleRequiredMessage(null);
      setTitleDraft(title);

      onUpdate((current) => {
        if (current.type !== "embed") {
          return current;
        }

        return {
          ...current,

          title,
        };
      });

      return;
    }

    setTitleRequiredMessage(t("embed.titleRequired"));
    setTitleDraft(element.title);
  }

  function handleTitleKeyDown(
    event: ReactKeyboardEvent<HTMLInputElement>,
  ): void {
    if (event.key === "Escape") {
      setTitleDraft(element.title);
      setTitleRequiredMessage(null);

      return;
    }

    if (event.key === "Enter") {
      event.currentTarget.blur();
    }
  }

  return (
    <>
      <div className={styles.inspectorDivider} />

      <InspectorSection title={t("inspector.content")} defaultOpen>
        <label className={styles.field}>
          <span title={t("embed.sourceHelp")}>{t("embed.source")}</span>

          <input
            id="embed-src"
            name="embedSrc"
            type="text"
            inputMode="url"
            value={srcDraft}
            placeholder="https://example.com"
            autoComplete="off"
            onChange={(event) => {
              setSrcDraft(event.target.value);
              setInvalidSrcMessage(null);
            }}
            onBlur={commitSrcDraft}
            onKeyDown={handleSrcKeyDown}
          />

          {invalidSrcMessage !== null && (
            <small className={styles.fieldHint}>
              <span>{invalidSrcMessage}</span>
            </small>
          )}
        </label>

        <label className={styles.field}>
          <span title={t("embed.titleHelp")}>{t("embed.title")}</span>

          <input
            id="embed-title"
            name="embedTitle"
            type="text"
            value={titleDraft}
            autoComplete="off"
            onChange={(event) => {
              setTitleDraft(event.target.value);
              setTitleRequiredMessage(null);
            }}
            onBlur={commitTitleDraft}
            onKeyDown={handleTitleKeyDown}
          />

          {titleRequiredMessage !== null && (
            <small className={styles.fieldHint}>
              <span>{titleRequiredMessage}</span>
            </small>
          )}
        </label>

        <small className={styles.fieldHint}>
          <span>{t("embed.canvasHelp")}</span>
        </small>
      </InspectorSection>

      <InspectorSection title={t("embed.viewport")} defaultOpen>
        <small className={styles.fieldHint}>
          <span>{t("embed.viewportHelp")}</span>
        </small>

        <label className={styles.field}>
          <span>{t("embed.zoom")}</span>
          <div className={styles.unitInput}>
            <input
              id="embed-viewport-zoom"
              name="embedViewportZoom"
              type="number"
              min="10"
              max="400"
              step="1"
              inputMode="decimal"
              value={(element.viewport?.zoom ?? 1) * 100}
              onChange={(event) =>
                updateViewportField("zoom", event.target.value)
              }
            />
            <span>%</span>
          </div>
        </label>

        <div className={styles.field}>
          <span>{t("embed.framing")}</span>
          <div className={styles.fieldGrid}>
            {(["top", "right", "bottom", "left"] as const).map((field) => (
              <label className={styles.field} key={field}>
                <span>{t(`inspector.${field}`)}</span>
                <div className={styles.unitInput}>
                  <input
                    id={`embed-viewport-${field}`}
                    name={`embedViewport${field[0].toUpperCase()}${field.slice(1)}`}
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    value={element.viewport?.[field] ?? 0}
                    onChange={(event) =>
                      updateViewportField(field, event.target.value)
                    }
                  />
                  <span>px</span>
                </div>
              </label>
            ))}
          </div>
        </div>
      </InspectorSection>

      <CanonicalSurfaceAppearanceSection
        element={element}
        style={element.style}
        effect={element.effect}
        onUpdateStyle={updateStyle}
        onUpdateEffect={(update) => onUpdate((current) => current.type === "embed" ? { ...current, effect: update(current.effect) } : current)}
        controlPrefix="embed"
      />

      <CanonicalElementEffectsSection
        effect={element.effect}
        onUpdateEffect={(update) => onUpdate((current) => current.type === "embed" ? { ...current, effect: update(current.effect) } : current)}
        controlPrefix="embed"
      />
    </>
  );
}

// ============================================================
// END: EMBED INSPECTOR
// ============================================================
