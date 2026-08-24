import { useState } from "react";

import type { KeyboardEvent as ReactKeyboardEvent } from "react";

import {
  isAbsoluteHttpHref,
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
// canonical src and accessibility title.
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
