"use client";

import { getFontResourceFaces, FUNDAMENTAL_TEXT_STYLE_IDS, TEXT_STYLE_LAYOUT_PROPERTY_NAMES, TEXT_STYLE_TYPOGRAPHY_PROPERTY_NAMES, type Color, type ColorValue, type FontResource, type Length, type Presentation, type PresentationPaletteColor, type TextElement, type TextStyle, type TextStyleLayoutProperties, type TextStyleTypographyProperties, type TextStyleVisualProperties, type TextStyleRole, type TextStroke, type ContainerElement, type LinkedContainerStyle, type LinkedTopicsStyle, type PresentationElement, type TopicMarkerStyle, type TopicsElement } from "@web-slideshow/document-schema";
import { paletteColorCssVariableName, renderElement } from "@web-slideshow/renderer";
import { convertAuthoringLength, parseAuthoringLength, resolveThemeTextTypographyBaseline, serializeAuthoringLength, TEXT_VARIANT_TYPOGRAPHY_DEFAULTS, TOPICS_ITEM_GAP_DEFAULT_PX, type AuthoringLengthUnit } from "@web-slideshow/theme/element-style-defaults";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@web-slideshow/ui";

import { DangerConfirmDialog } from "@/features/app/danger-confirm-dialog";
import { LiteralColorInput } from "@/features/editor/color/literal-color-input";
import { InspectorSection } from "@/features/editor/inspector/inspector-section";
import { useStudioI18n } from "@/features/i18n/studio-i18n-context";
import type { StudioTranslate } from "@/features/i18n/studio-i18n";
import type { CustomLibraryPaletteDraft } from "@/features/custom-library/custom-library-palette";
import type { CustomLibraryItemDraft } from "@/features/custom-library/custom-library-item";
import {
  CustomLibraryApplyPicker,
  type CustomLibraryApplyOutcome,
} from "@/features/custom-library/custom-library-apply-picker";
import type { CustomLibraryRepository } from "@/features/custom-library/custom-library-repository";
import type {
  CustomLibraryPaletteRecord,
  CustomLibraryPaletteRepository,
} from "@/features/custom-library/custom-library-palette-repository";
import type { CustomLibraryPaletteAddOutcome } from "@/features/custom-library/custom-library-palette-add-picker";
import type { CustomLibraryFontDraft, CustomLibraryFontRecord } from "@/features/custom-library/custom-library-font";
import type { CustomLibraryFontRepository } from "@/features/custom-library/custom-library-font-repository";
import { getDefaultCustomLibraryPaletteRepository } from "@/features/persistence/custom-library-palette-repository-instance";
import { getDefaultCustomLibraryFontRepository } from "@/features/persistence/custom-library-font-repository-instance";
import { readAbsoluteNumber } from "../inspector/inspector-helpers";
import { ElementTypographyFields, type CoreTypographyProperty } from "../inspector/sections/element-typography-control";
import { ColorControl } from "../inspector/sections/color-control";
import { ElementBorderControl } from "../inspector/sections/element-border-control";
import { ElementGradientControl } from "../inspector/sections/element-gradient-control";
import { ContainerBackgroundPatternControl } from "../inspector/sections/container-background-pattern-control";
import { ContainerEffectsSection } from "../inspector/sections/container-effects-section";
import { PresentationColorPaletteProvider } from "../inspector/sections/presentation-color-palette";
import { AuthoringHistoryContext, useAuthoringHistory, type AuthoringHistoryContextValue } from "../authoring-history-context";
import { findTextStyleUsageLocations, listPresentationTextStyles, normalizeTextStyleLayoutProperties, normalizeTextStyleTypographyProperties, normalizeTextStyleVisualProperties, type TextStyleUsageLocation } from "../text-style-helpers";
import { canCreateLinkedStyleFromContainer, canCreateLinkedStyleFromTopics, canCreateLinkedStyleFromCode, canCreateLinkedStyleFromTerminal, canCreateLinkedStyleFromSimpleTable, canCreateLinkedStyleFromStructuredTable, canCreateLinkedStyleFromDivider, canUpdateLinkedStyle } from "../linked-style-authoring";
import { addLinkedStyleProperty, hasLinkedStyleProperty, listAvailableLinkedStyleProperties, listLinkedStyleAuthoredProperties, LINKED_STYLE_PROPERTY_GROUPS, removeLinkedStyleProperty, type LinkedStyleAuthorableProperty, type LinkedStyleProperty } from "../linked-style-property-authoring";
import { findContainerLinkedStyleUsageLocations, findLinkedStyleUsageLocations, findMatchingContainersForLinkedStyle, type LinkedStyleUsageLocation } from "../linked-style-bulk-authoring";
import type { AuthoringTarget } from "../authoring-target";
import { resolveEffectiveRootDefinitionId, type RootDefinitionLifecycleFailure } from "../root-definition-lifecycle";

import styles from "./custom-resources-workspace.module.css";

interface CustomResourcesWorkspaceProps {
  customLibraryRepository?: CustomLibraryRepository;
  customLibraryPaletteRepository?: CustomLibraryPaletteRepository;
  customLibraryFontRepository?: CustomLibraryFontRepository;
  presentationColors: readonly PresentationPaletteColor[];
  presentationFonts: readonly FontResource[];
  onAddLibraryPalette: (palette: CustomLibraryPaletteDraft) => CustomLibraryPaletteAddOutcome;
  onAddLibraryFont: (font: CustomLibraryFontDraft) => CustomLibraryFontAddOutcome;
  onApplyElementStyle: (item: CustomLibraryItemDraft) => CustomLibraryApplyOutcome;
  allowElementStyleApply?: boolean;
  onAddPresentationColor: (name: string, value: Color) => void;
  onUpdatePresentationColor: (id: string, patch: { name: string; value: Color }) => void;
  onRemovePresentationColor: (id: string) => void;
  onRemovePresentationFont: (id: string) => CustomLibraryFontRemoveOutcome;
  isPresentationFontInUse: (family: string) => boolean;
  presentationTextStyles?: readonly TextStyle[];
  presentation?: Presentation;
  activeRootDefinitionId?: string;
  onOpenRootDefinition?: (rootDefinitionId: string) => void;
  onRenameRootDefinition?: (rootDefinitionId: string, name: string) => RootDefinitionLifecycleFailure | null;
  onDeleteRootDefinition?: (rootDefinitionId: string) => RootDefinitionLifecycleFailure | null;
  authoringHistory?: AuthoringHistoryContextValue | null;
  onUpdateFundamentalTextStyle?: (id: "title" | "subtitle" | "body" | "caption", patch: TextStylePatch) => void;
  onResetFundamentalTextStyle?: (id: "title" | "subtitle" | "body" | "caption") => void;
  onAddTextStyle?: (name: string, role: TextStyleRole) => void;
  onCreateTextStyleFromSelected?: (name: string) => void;
  onUpdateTextStyle?: (id: string, patch: TextStylePatch & { name?: string; role?: TextStyleRole }) => void;
  onRemoveTextStyle?: (id: string) => void;
  isTextStyleInUse?: (id: string) => boolean;
  onUpdateLinkedStyle?: (id: string, patch: { layout?: LinkedContainerStyle["layout"]; style?: LinkedContainerStyle["style"]; typography?: LinkedContainerStyle["typography"]; effect?: LinkedContainerStyle["effect"] }) => void;
  onUpdateLinkedTopicsStyle?: (id: string, patch: Pick<LinkedTopicsStyle, "kind" | "layout" | "rootMarkerStyle" | "markerColor" | "itemGap">) => void;
  onCreateLinkedStyle?: (name: string, property: LinkedStyleAuthorableProperty) => void;
  onRenameLinkedStyle?: (id: string, name: string) => void;
  onRenameLinkedTopicsStyle?: (id: string, name: string) => void;
  onRemoveLinkedStyle?: (id: string) => void;
  onRemoveLinkedTopicsStyle?: (id: string) => void;
  onAttachLinkedStyleMatches?: (id: string) => void;
  onSelectLinkedStyleContainer?: (location: LinkedStyleUsageLocation, linkedStyleId: string) => void;
  onSelectTextStyleElement?: (location: TextStyleUsageLocation, styleId: string) => void;
  onSelectRootDefinitionSlide?: (slideIndex: number) => void;
  onRequestDetachLinkedStyle?: (styleId: string, styleName: string, location: LinkedStyleUsageLocation) => void;
  onRequestDetachTextStyleElement?: (styleId: string, styleName: string, location: TextStyleUsageLocation) => void;
  selectedElement?: PresentationElement | null;
  onCreateLinkedStyleFromSelected?: (name: string) => void;
  resourceSections?: Record<string, boolean>;
  onResourceSectionChange?: (id: string, open: boolean) => void;
}

type TextStylePatch = {
  style?: TextStyleVisualProperties;
  typography?: TextStyleTypographyProperties;
  layout?: TextStyleLayoutProperties;
};

export type CustomLibraryFontAddKind = "added" | "merged" | "unchanged" | "conflict";
export interface CustomLibraryFontAddOutcome {
  kind: CustomLibraryFontAddKind;
  addedFaces: number;
}
export type CustomLibraryFontRemoveOutcome = "removed" | "in-use" | "not-found";

type PaletteLoadState =
  | { kind: "loading" }
  | { kind: "ready"; records: CustomLibraryPaletteRecord[] }
  | { kind: "error" };

type FontLoadState =
  | { kind: "loading" }
  | { kind: "ready"; records: CustomLibraryFontRecord[] }
  | { kind: "error" };

const PREVIEW_COLOR_LIMIT = 6;

export function createLinkedStylePreviewContainer(linkedStyleId: string): ContainerElement {
  return {
    id: `linked-style-preview-${linkedStyleId}`,
    type: "container",
    hidden: false,
    linkedStyleId,
    children: ["A", "B", "C"].map((label) => ({
      id: `linked-style-preview-${linkedStyleId}-${label.toLowerCase()}`,
      type: "container" as const,
      hidden: false,
      layout: { width: 28, height: 20 },
      style: { background: { color: "#334155" }, borderRadius: 3 },
      children: [{
        id: `linked-style-preview-${linkedStyleId}-${label.toLowerCase()}-text`,
        type: "text" as const,
        hidden: false,
        variant: "body",
        styleDetached: true as const,
        content: label,
      }],
    })),
  };
}

function createLinkedStylePreviewTopics(linkedStyleId: string): TopicsElement {
  return {
    id: `linked-topics-preview-${linkedStyleId}`,
    type: "topics",
    hidden: false,
    linkedStyleId,
    items: ["A topic", "Another topic", "A subtopic"].map((content, index) => ({
      id: `linked-topics-preview-${linkedStyleId}-${index}`,
      content: { id: `linked-topics-preview-slot-${linkedStyleId}-${index}`, children: [{ id: `linked-topics-preview-text-${linkedStyleId}-${index}`, type: "text" as const, hidden: false, variant: "body" as const, content }] },
      children: [],
    })),
  };
}

export function CustomResourcesWorkspace({
  customLibraryRepository,
  customLibraryPaletteRepository = getDefaultCustomLibraryPaletteRepository(),
  customLibraryFontRepository = getDefaultCustomLibraryFontRepository(),
  presentationColors,
  presentationFonts,
  onAddLibraryPalette,
  onAddLibraryFont,
  onApplyElementStyle,
  allowElementStyleApply = true,
  onAddPresentationColor,
  onUpdatePresentationColor,
  onRemovePresentationColor,
  onRemovePresentationFont,
  isPresentationFontInUse,
  presentationTextStyles = [],
  presentation,
  authoringHistory = null,
  onUpdateFundamentalTextStyle = () => undefined,
  onResetFundamentalTextStyle = () => undefined,
  onAddTextStyle = () => undefined,
  onCreateTextStyleFromSelected = () => undefined,
  onUpdateTextStyle = () => undefined,
  onRemoveTextStyle = () => undefined,
  isTextStyleInUse = () => false,
  onUpdateLinkedStyle = () => undefined,
  onUpdateLinkedTopicsStyle = () => undefined,
  onCreateLinkedStyle = () => undefined,
  onRenameLinkedStyle = () => undefined,
  onRenameLinkedTopicsStyle = onRenameLinkedStyle,
  onRemoveLinkedStyle = () => undefined,
  onRemoveLinkedTopicsStyle = onRemoveLinkedStyle,
  onAttachLinkedStyleMatches = () => undefined,
  onSelectLinkedStyleContainer = () => undefined,
  onSelectTextStyleElement = () => undefined,
  onSelectRootDefinitionSlide = () => undefined,
  onRequestDetachLinkedStyle = () => undefined,
  onRequestDetachTextStyleElement = () => undefined,
  selectedElement = null,
  activeRootDefinitionId,
  onOpenRootDefinition = () => undefined,
  onRenameRootDefinition = () => null,
  onDeleteRootDefinition = () => null,
  onCreateLinkedStyleFromSelected = () => undefined,
  resourceSections = {},
  onResourceSectionChange = () => undefined,
}: CustomResourcesWorkspaceProps) {
  const { t } = useStudioI18n();
  const [loadState, setLoadState] = useState<PaletteLoadState>({ kind: "loading" });
  const [fontLoadState, setFontLoadState] = useState<FontLoadState>({ kind: "loading" });
  const [elementStyleChooserOpen, setElementStyleChooserOpen] = useState(false);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [localColorAddOpen, setLocalColorAddOpen] = useState(false);
  const [colorName, setColorName] = useState("");
  const [colorValue, setColorValue] = useState<Color>("#ffffff");
  const requestRevisionRef = useRef(0);
  const fontRequestRevisionRef = useRef(0);
  const [fontChooserOpen, setFontChooserOpen] = useState(false);
  const [fontFeedback, setFontFeedback] = useState<{ kind: CustomLibraryFontAddKind; family: string; count: number } | null>(null);
  const [editingStyleId, setEditingStyleId] = useState<string | null>(null);
  const [addingStyle, setAddingStyle] = useState(false);
  const [pendingRootDefinitionDelete, setPendingRootDefinitionDelete] = useState<{ id: string; name: string } | null>(null);
  const [rootDefinitionFeedback, setRootDefinitionFeedback] = useState<{ id: string; reason: RootDefinitionLifecycleFailure } | null>(null);

  const loadPalettes = useCallback(() => {
    const requestRevision = requestRevisionRef.current + 1;
    requestRevisionRef.current = requestRevision;
    setLoadState({ kind: "loading" });
    void Promise.resolve()
      .then(() => customLibraryPaletteRepository.listPalettes())
      .then((records) => {
        if (requestRevision === requestRevisionRef.current) setLoadState({ kind: "ready", records });
      })
      .catch(() => {
        if (requestRevision === requestRevisionRef.current) setLoadState({ kind: "error" });
      });
  }, [customLibraryPaletteRepository]);

  const loadFonts = useCallback(() => {
    const requestRevision = fontRequestRevisionRef.current + 1;
    fontRequestRevisionRef.current = requestRevision;
    setFontLoadState({ kind: "loading" });
    void Promise.resolve()
      .then(() => customLibraryFontRepository.listFonts())
      .then((records) => {
        if (requestRevision === fontRequestRevisionRef.current) setFontLoadState({ kind: "ready", records });
      })
      .catch(() => {
        if (requestRevision === fontRequestRevisionRef.current) setFontLoadState({ kind: "error" });
      });
  }, [customLibraryFontRepository]);

  useEffect(() => {
    void Promise.resolve().then(loadPalettes);
    void Promise.resolve().then(loadFonts);
    return () => {
      requestRevisionRef.current += 1;
      fontRequestRevisionRef.current += 1;
    };
  }, [loadFonts, loadPalettes]);

  function addLibraryFont(font: CustomLibraryFontDraft): void {
    const result = onAddLibraryFont(font);
    setFontFeedback({ kind: result.kind, family: font.family, count: result.addedFaces });
  }

  function addIndividualColor(): void {
    const name = colorName.trim();
    if (!name) return;
    onAddPresentationColor(name, colorValue);
    setColorName("");
  }

  return (
    <aside className={styles.workspace} aria-label={t("editor.customResources")}>
      <div className={styles.header}><span>{t("customResources.title")}</span></div>

      <div className={styles.content}>
        <section className={styles.scope} aria-labelledby="custom-resources-from-library">
          <h2 id="custom-resources-from-library" className={styles.sectionTitle}>{t("customResources.fromLibrary")}</h2>
          <InspectorSection title={t("customResources.elementStyles")} open={resourceSections.elementStyles} onOpenChange={(open) => onResourceSectionChange("elementStyles", open)}>
            <div className={styles.group}>
              <div className={styles.groupHeader}>
                <button type="button" className={styles.resourceAction} disabled={!allowElementStyleApply} onClick={() => setElementStyleChooserOpen((open) => !open)}>
                  {elementStyleChooserOpen ? t("customResources.close") : t("customResources.addSavedElement")}
                </button>
              </div>
            </div>
            {elementStyleChooserOpen && allowElementStyleApply ? <CustomLibraryApplyPicker
              repository={customLibraryRepository}
              onApply={onApplyElementStyle}
              actionClassName={styles.resourceAction}
              panelClassName={styles.libraryElementStylesPanel}
              listClassName={styles.libraryElementStylesList}
              itemClassName={styles.resourceItem}
              retryClassName={styles.resourceAction}
              embedded
            /> : null}
          </InspectorSection>
          <InspectorSection title={t("customResources.palettes")} open={resourceSections.libraryPalettes} onOpenChange={(open) => onResourceSectionChange("libraryPalettes", open)}>
            <div className={styles.group}>
              <div className={styles.groupHeader}>
                <button type="button" className={styles.resourceAction} onClick={() => setChooserOpen((open) => !open)}>
                  {chooserOpen ? t("customResources.close") : t("customResources.addPalette")}
                </button>
              </div>
              {chooserOpen ? <MasterPaletteChooser loadState={loadState} onRetry={loadPalettes} onAdd={onAddLibraryPalette} /> : null}
            </div>
          </InspectorSection>
          <InspectorSection title={t("customResources.fonts")} open={resourceSections.libraryFonts} onOpenChange={(open) => onResourceSectionChange("libraryFonts", open)}>
            <div className={styles.group}>
              <div className={styles.groupHeader}>
                <button type="button" className={styles.resourceAction} onClick={() => setFontChooserOpen((open) => !open)}>
                  {fontChooserOpen ? t("customResources.close") : t("customResources.addFont")}
                </button>
              </div>
              {fontFeedback ? <p className={styles.status} role={fontFeedback.kind === "conflict" ? "alert" : undefined}>{fontFeedback.kind === "added" ? t("customResources.fontAdded", { family: fontFeedback.family }) : fontFeedback.kind === "merged" ? t("customResources.fontMerged", { count: fontFeedback.count ?? 0, family: fontFeedback.family }) : fontFeedback.kind === "unchanged" ? t("customResources.fontUnchanged", { family: fontFeedback.family }) : t("customResources.fontConflict", { family: fontFeedback.family })}</p> : null}
              {fontChooserOpen ? <MasterFontChooser loadState={fontLoadState} onRetry={loadFonts} onAdd={addLibraryFont} /> : null}
            </div>
          </InspectorSection>
        </section>

        <section className={styles.scope} aria-labelledby="custom-resources-this-presentation">
          <h2 id="custom-resources-this-presentation" className={styles.sectionTitle}>{t("customResources.thisPresentation")}</h2>
          <div className={styles.presentationSections}>
            <InspectorSection title={t("customResources.rootDefinitions")} count={presentation?.rootDefinitions?.length ?? 0} open={resourceSections.rootDefinitions} onOpenChange={(open) => onResourceSectionChange("rootDefinitions", open)}>
              {presentation?.rootDefinitions?.length ? (
                <div className={styles.localFontList} data-root-definitions>
                  {presentation.rootDefinitions.map((definition) => {
                    const usageLocations = findRootDefinitionUsageLocations(presentation, definition.id);
                    const lifecycleReferenced = presentation.defaultRootDefinitionId === definition.id
                      || presentation.slides.some((slide) => slide.rootDefinitionId === definition.id);
                    return <RootDefinitionResourceRow
                      key={definition.id}
                      id={definition.id}
                      name={definition.name}
                      presentation={presentation}
                      active={activeRootDefinitionId === definition.id}
                      referenced={lifecycleReferenced}
                      usageLocations={usageLocations}
                      onSelectSlide={onSelectRootDefinitionSlide}
                      feedback={rootDefinitionFeedback?.id === definition.id ? rootDefinitionFeedback.reason : null}
                      onOpen={() => { setRootDefinitionFeedback(null); onOpenRootDefinition(definition.id); }}
                      onRename={(name) => {
                        const reason = onRenameRootDefinition(definition.id, name);
                        setRootDefinitionFeedback(reason ? { id: definition.id, reason } : null);
                      }}
                      onRemove={() => setPendingRootDefinitionDelete({ id: definition.id, name: definition.name })}
                      onClearFeedback={() => setRootDefinitionFeedback(null)}
                      t={t}
                    />;
                  })}
                </div>
              ) : <p className={styles.status}>{t("customResources.noRootDefinitions")}</p>}
            </InspectorSection>
            <InspectorSection title={t("customResources.linkedStyles")} count={presentation?.linkedStyles?.length ?? 0} open={resourceSections.linkedStyles} onOpenChange={(open) => onResourceSectionChange("linkedStyles", open)}>
              <PresentationColorPaletteProvider colors={presentationColors}><LinkedStylesWorkspace presentation={presentation} authoringHistory={authoringHistory} onUpdate={onUpdateLinkedStyle} onUpdateTopics={onUpdateLinkedTopicsStyle} onCreate={onCreateLinkedStyle} onRename={onRenameLinkedStyle} onRenameTopics={onRenameLinkedTopicsStyle} onRemove={onRemoveLinkedStyle} onRemoveTopics={onRemoveLinkedTopicsStyle} onAttach={onAttachLinkedStyleMatches} onSelectContainer={onSelectLinkedStyleContainer} onRequestDetach={onRequestDetachLinkedStyle} selectedElement={selectedElement} onCreateFromSelected={onCreateLinkedStyleFromSelected} /></PresentationColorPaletteProvider>
            </InspectorSection>
            <PresentationColorPaletteProvider colors={presentationColors}>
              <InspectorSection title={t("customResources.textStyles")} count={listPresentationTextStyles({ textStyles: presentationTextStyles }).length} open={resourceSections.textStyles} onOpenChange={(open) => onResourceSectionChange("textStyles", open)}>
                <AuthoringHistoryContext.Provider value={authoringHistory}>
                  <TextStylesWorkspace
                    presentationStyles={presentationTextStyles}
                    presentation={presentation}
                    presentationFonts={presentationFonts}
                    onEdit={(id) => setEditingStyleId(editingStyleId === id ? null : id)}
                    editingStyleId={editingStyleId}
                    onUpdateFundamental={onUpdateFundamentalTextStyle}
                    onResetFundamental={onResetFundamentalTextStyle}
                    onAdd={() => setAddingStyle(true)}
                    adding={addingStyle}
                    onCancelAdd={() => setAddingStyle(false)}
                    onCreate={(name, role) => { onAddTextStyle(name, role); setAddingStyle(false); }}
                    onCreateFromSelected={(name) => { onCreateTextStyleFromSelected(name); setAddingStyle(false); }}
                    onUpdate={onUpdateTextStyle}
                    onRemove={onRemoveTextStyle}
                    isInUse={isTextStyleInUse}
                    onSelectElement={onSelectTextStyleElement}
                    onRequestDetachElement={onRequestDetachTextStyleElement}
                    selectedElement={selectedElement}
                  />
                </AuthoringHistoryContext.Provider>
              </InspectorSection>
            </PresentationColorPaletteProvider>
            <InspectorSection title={t("customResources.presentationPalette")} open={resourceSections.presentationPalette} onOpenChange={(open) => onResourceSectionChange("presentationPalette", open)}>
            {presentationColors.length === 0 ? <p className={styles.status}>{t("customResources.noPresentationColors")}</p> : null}
            <div className={styles.localColorList} data-presentation-palette>
              {presentationColors.map((color) => (
                <AuthoringHistoryContext.Provider key={color.id} value={authoringHistory}>
                  <LocalPresentationColorRow
                    color={color}
                    onUpdate={onUpdatePresentationColor}
                    onRemove={onRemovePresentationColor}
                  />
                </AuthoringHistoryContext.Provider>
              ))}
            </div>
            <span className={styles.colorCount}>{t("customResources.colorCount", { count: presentationColors.length })}</span>
            <button type="button" className={`${styles.resourceAction} ${styles.presentationPaletteAction}`} onClick={() => setLocalColorAddOpen((open) => !open)}>
              {localColorAddOpen ? t("customResources.close") : t("customResources.addToPresentation")}
            </button>
            {localColorAddOpen ? (
              <div className={styles.localColorAdd}>
                <label className={styles.localColorName}>
                  <span>{t("customResources.colorName")}</span>
                  <input data-presentation-color-name-input value={colorName} onChange={(event) => setColorName(event.target.value)} />
                </label>
                <LiteralColorInput id="custom-resources-literal-color" name={t("customResources.color")} value={colorValue} onChange={setColorValue} />
                <button type="button" className={styles.resourceAction} disabled={!colorName.trim()} onClick={addIndividualColor}>{t("customResources.addColor")}</button>
              </div>
            ) : null}
            </InspectorSection>
            <InspectorSection title={t("customResources.fonts")} open={resourceSections.presentationFonts} onOpenChange={(open) => onResourceSectionChange("presentationFonts", open)}>
            {presentationFonts.length === 0 ? <p className={styles.status}>{t("customResources.noPresentationFonts")}</p> : null}
            <div className={styles.localFontList} data-presentation-fonts>
              {presentationFonts.map((font) => <LocalPresentationFontRow key={font.id} font={font} inUse={isPresentationFontInUse(font.family)} onRemove={onRemovePresentationFont} />)}
            </div>
            <span className={styles.colorCount}>{t(presentationFonts.length === 1 ? "customResources.fontCountOne" : "customResources.fontCountMany", { count: presentationFonts.length })}</span>
            </InspectorSection>
          </div>
        </section>
      </div>
      {pendingRootDefinitionDelete ? <DangerConfirmDialog
        title={t("customResources.deleteRootDefinitionTitle")}
        message={t("customResources.deleteRootDefinitionConfirm", { name: pendingRootDefinitionDelete.name })}
        confirmLabel={t("customResources.remove")}
        cancelLabel={t("elementCrud.cancel")}
        onCancel={() => setPendingRootDefinitionDelete(null)}
        onConfirm={() => {
          const reason = onDeleteRootDefinition(pendingRootDefinitionDelete.id);
          if (reason) {
            setRootDefinitionFeedback({ id: pendingRootDefinitionDelete.id, reason });
          } else {
            setPendingRootDefinitionDelete(null);
          }
        }}
      /> : null}
    </aside>
  );
}

function RootDefinitionResourceRow({
  id,
  name,
  presentation,
  active,
  referenced,
  usageLocations,
  onSelectSlide,
  feedback,
  onOpen,
  onRename,
  onRemove,
  onClearFeedback,
  t,
}: {
  id: string;
  name: string;
  presentation: Presentation;
  active: boolean;
  referenced: boolean;
  usageLocations: readonly RootDefinitionUsageLocation[];
  onSelectSlide: (slideIndex: number) => void;
  feedback: RootDefinitionLifecycleFailure | null;
  onOpen: () => void;
  onRename: (name: string) => void;
  onRemove: () => void;
  onClearFeedback: () => void;
  t: StudioTranslate;
}) {
  const [expanded, setExpanded] = useState(false);
  const editorId = `root-definition-${id}-editor`;
  return <div className={`${styles.resourceItem} ${styles.rootDefinitionResourceItem}`} data-root-definition-id={id} data-active={active ? "true" : "false"}>
    <button type="button" className={styles.typographyStyleDisclosure} aria-expanded={expanded} aria-controls={editorId} data-root-definition-disclosure onClick={() => setExpanded((open) => !open)}>
      <span className={styles.resourceItemDetails}>
        <strong>{name}</strong>
        <span className={styles.resourceItemMeta}>{t(usageLocations.length === 1 ? "customResources.rootDefinitionUsedByOne" : "customResources.rootDefinitionUsedByMany", { count: usageLocations.length })}</span>
        {active ? <span className={styles.resourceItemMeta}>{t("customResources.current")}</span> : null}
      </span>
      <span className={styles.resourceDisclosureChevron} aria-hidden="true">{expanded ? "▾" : "▸"}</span>
    </button>
    {expanded ? <div id={editorId} className={styles.typographyStyleEditor}>
      <div className={styles.resourceItemDetails}>
        <LinkedStyleNameField style={{ id, name }} labelKey="creation.rootDefinitionName" onDraftChange={onClearFeedback} onRename={(_, nextName) => onRename(nextName)} />
        {feedback === "referenced" ? <span className={styles.status} role="alert">{t("customResources.rootDefinitionInUse")}</span> : null}
        {feedback === "invalid-name" ? <span className={styles.status} role="alert">{t("creation.invalidName")}</span> : null}
      </div>
      <div className={`${styles.resourceActionRow} ${styles.rootDefinitionActionRow}`}>
        <button type="button" className={styles.resourceAction} data-root-definition-action="open" onClick={onOpen}>{t("customResources.openRootDefinition")}</button>
      </div>
      <div className={styles.linkedStyleSection} data-root-definition-section="reuse">
        <h3 className={styles.linkedStyleSectionTitle}>{t("customResources.reuse")}</h3>
        <RootDefinitionUsageLocations presentation={presentation} locations={usageLocations} onSelect={onSelectSlide} t={t} />
      </div>
      <div className={styles.resourceStyleActions}>
        <button type="button" className={styles.resourceAction} data-root-definition-action="delete" disabled={referenced} onClick={onRemove}>{t("customResources.remove")}</button>
      </div>
    </div> : null}
  </div>;
}

type RootDefinitionUsageLocation = {
  target: Extract<AuthoringTarget, { kind: "slide" }>;
  elementId: string;
  source: "explicit" | "default";
};

function findRootDefinitionUsageLocations(presentation: Presentation, rootDefinitionId: string): RootDefinitionUsageLocation[] {
  return presentation.slides.flatMap((slide, slideIndex) => {
    if (resolveEffectiveRootDefinitionId(presentation, slide) !== rootDefinitionId) return [];
    return [{
      target: { kind: "slide", slideIndex },
      elementId: slide.id,
      source: slide.rootDefinitionId === undefined ? "default" : "explicit",
    }];
  });
}

function RootDefinitionUsageLocations({ presentation, locations, onSelect, t }: { presentation: Presentation; locations: readonly RootDefinitionUsageLocation[]; onSelect: (slideIndex: number) => void; t: StudioTranslate }) {
  return <div className={styles.resourceUsageLocations} data-root-definition-usage>
    <span className={styles.status}>{t(locations.length === 1 ? "customResources.rootDefinitionUsedByOne" : "customResources.rootDefinitionUsedByMany", { count: locations.length })}</span>
    {locations.map((location) => <div key={`${location.target.slideIndex}:${location.elementId}`} className={styles.resourceItem} data-root-definition-usage-source={location.source}>
      <button type="button" className={styles.resourceUsageTarget} data-root-definition-usage-slide={location.target.slideIndex} onClick={() => onSelect(location.target.slideIndex)}>
        <span className={styles.resourceItemDetailsStack}><strong>{t("slides.current", { number: location.target.slideIndex + 1 })}</strong><span className={styles.masterPaletteCount}>{presentation.slides[location.target.slideIndex]?.title ?? location.elementId}</span></span>
      </button>
    </div>)}
  </div>;
}

function LinkedStylesWorkspace({
  presentation, authoringHistory, onUpdate: dispatchUpdate, onUpdateTopics, onCreate, onRename, onRenameTopics, onRemove, onRemoveTopics, onAttach, onSelectContainer, onRequestDetach, selectedElement, onCreateFromSelected,
}: {
  presentation?: Presentation;
  authoringHistory: AuthoringHistoryContextValue | null;
  onUpdate: (id: string, patch: { layout?: LinkedContainerStyle["layout"]; style?: LinkedContainerStyle["style"]; typography?: LinkedContainerStyle["typography"]; effect?: LinkedContainerStyle["effect"] }) => void;
  onUpdateTopics: (id: string, patch: Pick<LinkedTopicsStyle, "kind" | "layout" | "rootMarkerStyle" | "markerColor" | "itemGap">) => void;
  onCreate: (name: string, property: LinkedStyleAuthorableProperty) => void;
  onRename: (id: string, name: string) => void;
  onRenameTopics: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  onRemoveTopics: (id: string) => void;
  onAttach: (id: string) => void;
  onSelectContainer: (location: LinkedStyleUsageLocation, linkedStyleId: string) => void;
  onRequestDetach: (styleId: string, styleName: string, location: LinkedStyleUsageLocation) => void;
  selectedElement: PresentationElement | null;
  onCreateFromSelected: (name: string) => void;
}) {
  const { t } = useStudioI18n();
  const definitionMeta = { kind: "linkedStyle.definition", labelKey: "history.element.setting", labelParams: { setting: "linkedStyle.definition" } } as const;
  const addMeta = { kind: "linkedStyle.add", labelKey: "history.element.setting", labelParams: { setting: "linkedStyle.add" } } as const;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [chooserId, setChooserId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [addingFromSelected, setAddingFromSelected] = useState(false);
  const stylesList = presentation?.linkedStyles ?? [];
  const canCreateFromSelected = selectedElement?.type === "container"
    ? canCreateLinkedStyleFromContainer(selectedElement)
    : selectedElement?.type === "topics"
      ? canCreateLinkedStyleFromTopics(selectedElement)
      : selectedElement?.type === "code"
        ? canCreateLinkedStyleFromCode(selectedElement)
        : selectedElement?.type === "terminal"
          ? canCreateLinkedStyleFromTerminal(selectedElement)
          : selectedElement?.type === "table"
            ? selectedElement.mode === "structured"
              ? canCreateLinkedStyleFromStructuredTable(selectedElement)
              : canCreateLinkedStyleFromSimpleTable(selectedElement)
            : selectedElement?.type === "divider"
              ? canCreateLinkedStyleFromDivider(selectedElement)
              : false;
  const runDefinitionDiscrete = (callback: () => void): void => {
    if (authoringHistory) authoringHistory.discrete(definitionMeta, callback);
    else callback();
  };
  const runAddDiscrete = (callback: () => void): void => {
    if (authoringHistory) authoringHistory.discrete(addMeta, callback);
    else callback();
  };
  const commit = (id: string, patch: { layout?: LinkedContainerStyle["layout"]; style?: LinkedContainerStyle["style"]; typography?: LinkedContainerStyle["typography"]; effect?: LinkedContainerStyle["effect"] }) => {
    if (!presentation || canUpdateLinkedStyle(presentation, id, patch)) { setFeedback(null); dispatchUpdate(id, patch); }
    else setFeedback(t("customResources.linkedStyleMustNotBeEmpty"));
  };
  const create = (property: LinkedStyleAuthorableProperty) => {
    if (!presentation) return;
    if (!draftName.trim()) return;
    onCreate(draftName, property);
    setAdding(false); setDraftName(""); setChooserId(null);
  };
  return <div data-presentation-linked-styles>
    {feedback ? <p className={styles.status} role="status">{feedback}</p> : null}
    {stylesList.length === 0 ? <p className={styles.status}>{t("customResources.linkedStyleNoStyles")}</p> : null}
    {stylesList.map((linkedStyle) => {
      if ("target" in linkedStyle && linkedStyle.target === "topics") {
        return <TopicsLinkedStyleRow key={linkedStyle.id} style={linkedStyle} presentation={presentation} authoringHistory={authoringHistory} editing={editingId === linkedStyle.id} onEdit={() => setEditingId(editingId === linkedStyle.id ? null : linkedStyle.id)} onRename={onRenameTopics} onUpdate={onUpdateTopics} onRemove={onRemoveTopics} />;
      }
      if ("target" in linkedStyle) return null;
      const linkedLocations = presentation ? findContainerLinkedStyleUsageLocations(presentation, linkedStyle.id) : [];
      const matchingLocations = presentation ? findMatchingContainersForLinkedStyle(presentation, linkedStyle.id) : [];
      const editing = editingId === linkedStyle.id;
      const authored = listLinkedStyleAuthoredProperties(linkedStyle);
      const patch = (next: LinkedContainerStyle, property: LinkedStyleProperty) =>
        LINKED_STYLE_PROPERTY_GROUPS.layout.includes(property as never) ? { layout: next.layout } : LINKED_STYLE_PROPERTY_GROUPS.position.includes(property as never) || LINKED_STYLE_PROPERTY_GROUPS.size.includes(property as never) || LINKED_STYLE_PROPERTY_GROUPS.spacing.includes(property as never) ? { layout: next.layout } : LINKED_STYLE_PROPERTY_GROUPS.appearance.includes(property as never) ? { style: next.style } : { effect: next.effect };
      const editorId = `linked-style-${linkedStyle.id}-editor`;
      return <div key={linkedStyle.id} data-linked-style-id={linkedStyle.id} className={styles.group}>
        <button type="button" className={styles.typographyStyleDisclosure} aria-expanded={editing} aria-controls={editorId} onClick={() => setEditingId(editing ? null : linkedStyle.id)}>
          <span className={styles.resourceItemDetails}><strong>{linkedStyle.name}</strong><span className={styles.resourceItemMeta}>{t(linkedLocations.length === 1 ? "customResources.linkedStyleUsedByOne" : "customResources.linkedStyleUsedByMany", { count: linkedLocations.length })}</span></span>
          <span className={styles.resourceDisclosureChevron} aria-hidden="true">{editing ? "▾" : "▸"}</span>
        </button>
        {editing ? <AuthoringHistoryContext.Provider value={authoringHistory}><div id={editorId} className={styles.linkedStyleEditor}>
          <LinkedStyleNameField style={linkedStyle} onRename={(id, name) => runDefinitionDiscrete(() => onRename(id, name))} />
          <div
            className={styles.linkedStylePreview}
            data-linked-style-preview={linkedStyle.id}
            aria-hidden="true"
            style={Object.fromEntries((presentation?.palette?.colors ?? []).map((color) => [paletteColorCssVariableName(color.id), color.value]))}
            dangerouslySetInnerHTML={{ __html: renderElement(createLinkedStylePreviewContainer(linkedStyle.id), presentation ? { presentation } : undefined) }}
          />
          {(["layout", "position", "size", "spacing", "appearance", "effects"] as const).map((group) => {
            const properties = group === "layout" ? LINKED_STYLE_PROPERTY_GROUPS.layout : group === "position" ? LINKED_STYLE_PROPERTY_GROUPS.position : group === "size" ? LINKED_STYLE_PROPERTY_GROUPS.size : group === "spacing" ? LINKED_STYLE_PROPERTY_GROUPS.spacing : group === "appearance" ? LINKED_STYLE_PROPERTY_GROUPS.appearance : LINKED_STYLE_PROPERTY_GROUPS.effects;
            const visible = properties.filter((property) => hasLinkedStyleProperty(linkedStyle, property));
            if (visible.length === 0) return null;
            return <div className={styles.linkedStyleSection} data-linked-style-section={group} key={group}><h3 className={styles.linkedStyleSectionTitle}>{t(`inspector.${group}` as "inspector.layout")}</h3>{visible.map((property) => <LinkedStylePropertyRow key={property} style={linkedStyle} property={property} onUpdate={(next) => commit(linkedStyle.id, patch(next, property))} onRemove={() => runDefinitionDiscrete(() => commit(linkedStyle.id, patch(removeLinkedStyleProperty(linkedStyle, property), property)))} canRemove={(listLinkedStyleAuthoredProperties(linkedStyle).length > 1 || linkedStyle.typography !== undefined) && removeLinkedStyleProperty(linkedStyle, property) !== linkedStyle} />)}</div>;
          })}
          {linkedStyle.typography ? <div className={styles.linkedStyleSection} data-linked-style-section="legacy-typography"><h3 className={styles.linkedStyleSectionTitle}>{t("customResources.linkedStyleLegacyTypography")}</h3><p className={styles.status}>{t("customResources.linkedStyleLegacyTypographyDescription")}</p><Button variant="danger" size="compact" disabled={!presentation || !canUpdateLinkedStyle(presentation, linkedStyle.id, { typography: undefined })} onClick={() => runDefinitionDiscrete(() => commit(linkedStyle.id, { typography: undefined }))}>{t("customResources.linkedStyleRemoveLegacyTypography")}</Button></div> : null}
          {listAvailableLinkedStyleProperties(linkedStyle).length > 0 ? <div className={styles.linkedStyleSection}><LinkedStylePropertyChooser properties={listAvailableLinkedStyleProperties(linkedStyle)} onChoose={(property) => { const next = addLinkedStyleProperty(linkedStyle, property); runDefinitionDiscrete(() => commit(linkedStyle.id, patch(next, property))); setChooserId(null); }} /></div> : null}
          <div className={styles.linkedStyleSection} data-linked-style-section="reuse"><h3 className={styles.linkedStyleSectionTitle}>{t("customResources.reuse")}</h3><span className={styles.status}>{t(matchingLocations.length === 1 ? "customResources.linkedStyleMatchingOne" : "customResources.linkedStyleMatchingMany", { count: matchingLocations.length })}</span>{matchingLocations.length > 0 ? <Button variant="secondary" size="compact" onClick={() => onAttach(linkedStyle.id)}>{t("customResources.linkedStyleAttachMany", { count: matchingLocations.length })}</Button> : null}<ResourceUsageLocations presentation={presentation} locations={linkedLocations} onSelect={(location) => onSelectContainer(location, linkedStyle.id)} onRequestDetach={(location) => onRequestDetach(linkedStyle.id, linkedStyle.name, location)} styleName={linkedStyle.name} /><span className={styles.status}>{t(linkedLocations.length === 1 ? "customResources.linkedStyleChangesOne" : "customResources.linkedStyleChangesMany", { count: linkedLocations.length })}</span><div className={styles.resourceStyleActions}><button type="button" className={styles.resourceAction} disabled={linkedLocations.length > 0} onClick={() => runDefinitionDiscrete(() => onRemove(linkedStyle.id))}>{t("customResources.linkedStyleRemove")}</button></div></div>
        </div></AuthoringHistoryContext.Provider> : null}
      </div>;
    })}
    {adding ? <AuthoringHistoryContext.Provider value={authoringHistory}><div className={styles.linkedStyleEditor}><label className={styles.field}><span>{t("customResources.linkedStyleName")}</span><input value={draftName} onChange={(event) => setDraftName(event.target.value)} /></label><button type="button" className={styles.resourceAction} disabled={!draftName.trim()} onClick={() => setChooserId("new")}>{t("customResources.addFirstProperty")}</button>{chooserId === "new" ? <LinkedStylePropertyChooser openInitially properties={listAvailableLinkedStyleProperties({ id: "draft", name: draftName.trim() })} onChoose={(property) => runAddDiscrete(() => create(property))} /> : null}<Button variant="ghost" size="compact" onClick={() => { setAdding(false); setDraftName(""); setChooserId(null); }}>{t("customResources.close")}</Button></div></AuthoringHistoryContext.Provider> : addingFromSelected ? <div className={styles.linkedStyleEditor}><label className={styles.field}><span>{t("customResources.linkedStyleName")}</span><input value={draftName} onChange={(event) => setDraftName(event.target.value)} /></label><button type="button" className={styles.resourceAction} disabled={!draftName.trim()} onClick={() => { onCreateFromSelected(draftName); setAddingFromSelected(false); setDraftName(""); }}>{t("customResources.addToLinkedStyles")}</button><Button variant="ghost" size="compact" onClick={() => { setAddingFromSelected(false); setDraftName(""); }}>{t("customResources.close")}</Button></div> : <div className={styles.resourceActionRow} data-linked-style-actions><button type="button" className={styles.resourceAction} onClick={() => setAdding(true)}>+ {t("customResources.addLinkedStyle")}</button><button type="button" className={styles.resourceAction} disabled={!canCreateFromSelected} onClick={() => setAddingFromSelected(true)}>{t("customResources.addToLinkedStyles")}</button></div>}
  </div>;
}

function TopicsLinkedStyleRow({ style, presentation, authoringHistory, editing, onEdit, onRename, onUpdate, onRemove }: { style: LinkedTopicsStyle; presentation?: Presentation; authoringHistory: AuthoringHistoryContextValue | null; editing: boolean; onEdit: () => void; onRename: (id: string, name: string) => void; onUpdate: (id: string, patch: Pick<LinkedTopicsStyle, "kind" | "layout" | "rootMarkerStyle" | "markerColor" | "itemGap">) => void; onRemove: (id: string) => void }) {
  const { t } = useStudioI18n();
  const locations = presentation ? findLinkedStyleUsageLocations(presentation, style.id) : [];
  const definitionMeta = { kind: "linkedStyle.definition", labelKey: "history.element.setting", labelParams: { setting: "linkedStyle.definition" } } as const;
  const runDefinitionDiscrete = (callback: () => void): void => {
    if (authoringHistory) authoringHistory.discrete(definitionMeta, callback);
    else callback();
  };
  return <div data-linked-style-id={style.id} className={styles.group}>
    <button type="button" className={styles.typographyStyleDisclosure} aria-expanded={editing} onClick={onEdit}>
      <span className={styles.resourceItemDetails}><strong>{style.name}</strong><span className={styles.resourceItemMeta}>{t(locations.length === 1 ? "customResources.linkedStyleUsedByOne" : "customResources.linkedStyleUsedByMany", { count: locations.length })}</span></span>
      <span className={styles.resourceDisclosureChevron} aria-hidden="true">{editing ? "▾" : "▸"}</span>
    </button>
    {editing ? <AuthoringHistoryContext.Provider value={authoringHistory}><div className={styles.linkedStyleEditor}>
      <LinkedStyleNameField style={style} onRename={(id, name) => runDefinitionDiscrete(() => onRename(id, name))} />
      <div className={styles.linkedStylePreview} data-linked-style-preview={style.id} aria-hidden="true" dangerouslySetInnerHTML={{ __html: presentation ? renderElement(createLinkedStylePreviewTopics(style.id), { presentation }) : "" }} />
      <TopicsLinkedStyleEditor style={style} authoringHistory={authoringHistory} onUpdate={(patch) => onUpdate(style.id, patch)} />
      <div className={styles.resourceStyleActions}><button type="button" className={styles.resourceAction} disabled={locations.length > 0} onClick={() => runDefinitionDiscrete(() => onRemove(style.id))}>{t("customResources.linkedStyleRemove")}</button></div>
    </div></AuthoringHistoryContext.Provider> : null}
  </div>;
}

function TopicsLinkedStyleEditor({ style, authoringHistory, onUpdate }: { style: LinkedTopicsStyle; authoringHistory: AuthoringHistoryContextValue | null; onUpdate: (patch: Pick<LinkedTopicsStyle, "kind" | "layout" | "rootMarkerStyle" | "markerColor" | "itemGap">) => void }) {
  const { t } = useStudioI18n();
  const definitionMeta = { kind: "linkedStyle.definition", labelKey: "history.element.setting", labelParams: { setting: "linkedStyle.definition" } } as const;
  const numberHistoryMeta = { kind: "number.change", labelKey: "history.number.change" } as const;
  const layoutProperties = ["margin", "marginTop", "marginRight", "marginBottom", "marginLeft"] as const;
  const configuredLayout = layoutProperties.filter((property) => style.layout?.[property] !== undefined);
  const configuredAppearance = [
    ...(style.kind === undefined ? [] : ["kind" as const]),
    ...(style.rootMarkerStyle === undefined ? [] : ["rootMarkerStyle" as const]),
    ...(style.markerColor === undefined ? [] : ["markerColor" as const]),
  ];
  const updateLayoutProperty = (property: (typeof layoutProperties)[number], value: Length | undefined) => {
    const layout = { ...style.layout };
    if (value === undefined) delete layout[property];
    else layout[property] = value;
    onUpdate({ layout: Object.keys(layout).length > 0 ? layout : undefined });
  };
  const runDefinitionDiscrete = (callback: () => void): void => {
    if (authoringHistory) authoringHistory.discrete(definitionMeta, callback);
    else callback();
  };
  const runContinuous = (property: TopicsLinkedStyleProperty, callback: () => void): void => {
    if (!authoringHistory) {
      callback();
      return;
    }
    const key = `linked-topics-style:${style.id}:${property}`;
    authoringHistory.begin(key, numberHistoryMeta);
    authoringHistory.update(key, callback);
  };
  const addProperty = (property: TopicsLinkedStyleProperty) => {
    if (isTopicsLinkedStyleLayoutProperty(property)) {
      runDefinitionDiscrete(() => updateLayoutProperty(property, 0));
    } else if (property === "itemGap") {
      runDefinitionDiscrete(() => onUpdate({ itemGap: TOPICS_ITEM_GAP_DEFAULT_PX }));
    } else if (property === "rootMarkerStyle") {
      runDefinitionDiscrete(() => onUpdate({ rootMarkerStyle: "disc" }));
    } else if (property === "kind") {
      runDefinitionDiscrete(() => onUpdate({ kind: "unordered" }));
    } else {
      runDefinitionDiscrete(() => onUpdate({ markerColor: "#ffffff" }));
    }
  };
  const availableProperties = TOPICS_LINKED_STYLE_PROPERTY_ORDER.filter((property) => {
    if (isTopicsLinkedStyleLayoutProperty(property)) return !configuredLayout.includes(property);
    if (property === "itemGap") return style.itemGap === undefined;
    return !configuredAppearance.includes(property);
  });
  const groups = [
    { id: "spacing", label: "inspector.spacing" as const, properties: configuredLayout.length > 0 || style.itemGap !== undefined ? [...configuredLayout, ...(style.itemGap === undefined ? [] : ["itemGap" as const])] : [] },
    { id: "appearance", label: "inspector.appearance" as const, properties: configuredAppearance },
  ] as const;
  const labels = { margin: "inspector.margin", marginTop: "inspector.top", marginRight: "inspector.right", marginBottom: "inspector.bottom", marginLeft: "inspector.left", itemGap: "inspector.topics.itemGap", kind: "inspector.topics.kind", rootMarkerStyle: "inspector.topics.rootMarkerStyle", markerColor: "inspector.topics.markerColor" } as const;
  return <div className={styles.resourcePropertyEditor} data-linked-topics-style-editor>
    <div className={styles.resourcePropertyStack}>
      {groups.map((group) => group.properties.length === 0 ? null : <section className={styles.resourcePropertyGroup} data-linked-topics-property-group={group.id} key={group.id}>
        <h4 className={styles.resourcePropertyGroupTitle}>{t(group.label)}</h4>
        {group.properties.map((property) => <TopicsLinkedStylePropertyCard key={property} style={style} property={property} authoringHistory={authoringHistory} onUpdateLayoutProperty={updateLayoutProperty} onUpdate={onUpdate} onDiscrete={runDefinitionDiscrete} onContinuous={runContinuous} />)}
      </section>)}
    </div>
    {availableProperties.length > 0 ? <CategorizedPropertyChooser groups={[
      {
        id: "spacing",
        label: t("inspector.spacing"),
        items: availableProperties.filter((property) => isTopicsLinkedStyleLayoutProperty(property) || property === "itemGap").map((property) => ({ id: property, label: t(labels[property]) })),
      },
      {
        id: "appearance",
        label: t("inspector.appearance"),
        items: availableProperties.filter((property) => !isTopicsLinkedStyleLayoutProperty(property) && property !== "itemGap").map((property) => ({ id: property, label: t(labels[property]) })),
      },
    ]} dataAttribute="topics-linked-style" onSelect={(property) => addProperty(property as TopicsLinkedStyleProperty)} /> : null}
  </div>;
}

type TopicsLinkedStyleProperty = "margin" | "marginTop" | "marginRight" | "marginBottom" | "marginLeft" | "itemGap" | "kind" | "rootMarkerStyle" | "markerColor";
type TopicsLinkedStyleLayoutProperty = "margin" | "marginTop" | "marginRight" | "marginBottom" | "marginLeft";
const TOPICS_UNORDERED_MARKERS: readonly TopicMarkerStyle[] = ["disc", "circle", "square", "none"];
const TOPICS_ORDERED_MARKERS: readonly TopicMarkerStyle[] = ["decimal", "lower-alpha", "upper-alpha", "lower-roman", "upper-roman", "none"];
const TOPICS_LINKED_STYLE_PROPERTY_ORDER: readonly TopicsLinkedStyleProperty[] = ["margin", "marginTop", "marginRight", "marginBottom", "marginLeft", "itemGap", "kind", "rootMarkerStyle", "markerColor"];
const TOPICS_LINKED_STYLE_LAYOUT_PROPERTIES: readonly TopicsLinkedStyleLayoutProperty[] = ["margin", "marginTop", "marginRight", "marginBottom", "marginLeft"];

function isTopicsLinkedStyleLayoutProperty(property: TopicsLinkedStyleProperty): property is TopicsLinkedStyleLayoutProperty {
  return TOPICS_LINKED_STYLE_LAYOUT_PROPERTIES.includes(property as TopicsLinkedStyleLayoutProperty);
}

function TopicsLinkedStylePropertyCard({ style, property, authoringHistory, onUpdateLayoutProperty, onUpdate, onDiscrete, onContinuous }: { style: LinkedTopicsStyle; property: TopicsLinkedStyleProperty; authoringHistory: AuthoringHistoryContextValue | null; onUpdateLayoutProperty: (property: "margin" | "marginTop" | "marginRight" | "marginBottom" | "marginLeft", value: Length | undefined) => void; onUpdate: (patch: Pick<LinkedTopicsStyle, "kind" | "layout" | "rootMarkerStyle" | "markerColor" | "itemGap">) => void; onDiscrete: (callback: () => void) => void; onContinuous: (property: TopicsLinkedStyleProperty, callback: () => void) => void }) {
  const { t } = useStudioI18n();
  const canRemove = topicsLinkedStyleAuthoredPropertyCount(style) > 1;
  const labels = { margin: "inspector.margin", marginTop: "inspector.top", marginRight: "inspector.right", marginBottom: "inspector.bottom", marginLeft: "inspector.left", itemGap: "inspector.topics.itemGap", kind: "inspector.topics.kind", rootMarkerStyle: "inspector.topics.rootMarkerStyle", markerColor: "inspector.topics.markerColor" } as const;
  const label = t(labels[property]);
  const remove = () => onDiscrete(() => {
    if (isTopicsLinkedStyleLayoutProperty(property)) onUpdateLayoutProperty(property, undefined);
    else if (property === "itemGap") onUpdate({ itemGap: undefined });
    else if (property === "kind") onUpdate({ kind: undefined });
    else if (property === "rootMarkerStyle") onUpdate({ rootMarkerStyle: undefined });
    else onUpdate({ markerColor: undefined });
  });
  let control: ReactNode;
  if (isTopicsLinkedStyleLayoutProperty(property)) {
    const historyKey = `linked-topics-style:${style.id}:${property}`;
    control = <div className={styles.unitInput}><input id={`linked-topics-style-${style.id}-${property}`} type="number" min="0" value={readAbsoluteNumber(style.layout?.[property])} onFocus={() => authoringHistory?.begin(historyKey, { kind: "number.change", labelKey: "history.number.change" })} onBlur={() => authoringHistory?.finish(historyKey)} onChange={(event) => onContinuous(property, () => onUpdateLayoutProperty(property, event.target.value === "" ? undefined : Number(event.target.value)))} /><span>px</span></div>;
  } else if (property === "itemGap") {
    const historyKey = `linked-topics-style:${style.id}:itemGap`;
    control = <input id={`linked-topics-style-${style.id}-item-gap`} type="number" min="0" value={style.itemGap ?? ""} onFocus={() => authoringHistory?.begin(historyKey, { kind: "number.change", labelKey: "history.number.change" })} onBlur={() => authoringHistory?.finish(historyKey)} onChange={(event) => onContinuous(property, () => onUpdate({ itemGap: event.target.value === "" ? undefined : Number(event.target.value) }))} />;
  } else if (property === "rootMarkerStyle") {
    const markerOptions = style.kind === "ordered" ? TOPICS_ORDERED_MARKERS : TOPICS_UNORDERED_MARKERS;
    control = <select value={style.rootMarkerStyle ?? ""} onChange={(event) => onDiscrete(() => onUpdate({ rootMarkerStyle: event.target.value ? event.target.value as TopicMarkerStyle : undefined }))}><option value="">{t("inspector.default")}</option>{markerOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select>;
  } else if (property === "kind") {
    control = <select id={`linked-topics-style-${style.id}-kind`} value={style.kind ?? "unordered"} onChange={(event) => onDiscrete(() => { const kind = event.target.value === "ordered" ? "ordered" : "unordered"; const markers = kind === "ordered" ? TOPICS_ORDERED_MARKERS : TOPICS_UNORDERED_MARKERS; onUpdate({ kind, rootMarkerStyle: style.rootMarkerStyle !== undefined && markers.includes(style.rootMarkerStyle) ? style.rootMarkerStyle : undefined }); })}><option value="unordered">{t("inspector.topics.unordered")}</option><option value="ordered">{t("inspector.topics.ordered")}</option></select>;
  } else {
    control = <ColorControl id={`linked-topics-style-${style.id}-marker-color`} name={label} value={style.markerColor} onChange={(markerColor) => onUpdate({ markerColor })} />;
  }
  return <div className={styles.resourcePropertyCard} data-linked-topics-property={property}>
    <div className={styles.resourcePropertyHeader}><span className={styles.resourcePropertyLabel}>{label}</span><button type="button" className={styles.resourceIconAction} data-resource-action="remove" disabled={!canRemove} aria-label={t("customResources.removeProperty", { property: label })} onClick={remove}>×</button></div>
    <div className={styles.resourcePropertyControl}>{control}</div>
  </div>;
}

function topicsLinkedStyleAuthoredPropertyCount(style: LinkedTopicsStyle): number {
  const layoutProperties = Object.values(style.layout ?? {}).filter((value) => value !== undefined).length;
  return layoutProperties
    + (style.kind === undefined ? 0 : 1)
    + (style.rootMarkerStyle === undefined ? 0 : 1)
    + (style.markerColor === undefined ? 0 : 1)
    + (style.itemGap === undefined ? 0 : 1);
}

function linkedStylePropertyLabel(t: ReturnType<typeof useStudioI18n>["t"], property: LinkedStyleProperty): string {
  switch (property) {
    case "layoutMode": return t("inspector.layoutMode"); case "direction": return t("inspector.direction"); case "gap": return t("inspector.gap"); case "distribution": return t("inspector.distribution"); case "horizontalAlign": return t("inspector.horizontalAlignment"); case "verticalAlign": return t("inspector.verticalAlignment"); case "overflow": return t("inspector.overflow"); case "fit": return t("inspector.childrenFit");
    case "position": return t("inspector.position"); case "top": return t("inspector.top"); case "right": return t("inspector.right"); case "bottom": return t("inspector.bottom"); case "left": return t("inspector.left"); case "width": return t("inspector.width"); case "height": return t("inspector.height"); case "preserveSize": return t("inspector.preserveSize");
    case "padding": return t("inspector.padding"); case "paddingTop": return t("inspector.paddingTop"); case "paddingRight": return t("inspector.paddingRight"); case "paddingBottom": return t("inspector.paddingBottom"); case "paddingLeft": return t("inspector.paddingLeft"); case "margin": return t("inspector.margin"); case "marginTop": return t("inspector.marginTop"); case "marginRight": return t("inspector.marginRight"); case "marginBottom": return t("inspector.marginBottom"); case "marginLeft": return t("inspector.marginLeft");
    case "color": return t("inspector.color"); case "backgroundColor": return t("inspector.background"); case "gradient": return t("inspector.gradient"); case "pattern": return t("inspector.pattern"); case "border": return t("inspector.border"); case "borderRadius": return t("inspector.roundedCorners"); case "opacity": return t("inspector.opacity"); case "shadow": return t("inspector.shadow");
  }
}

function LinkedStylePropertyChooser({ properties, onChoose, openInitially = false, withTrigger = true }: { properties: readonly LinkedStyleAuthorableProperty[]; onChoose: (property: LinkedStyleAuthorableProperty) => void; openInitially?: boolean; withTrigger?: boolean }) {
  const { t } = useStudioI18n();
  const groups = [
    ["layout", LINKED_STYLE_PROPERTY_GROUPS.layout],
    ["position", LINKED_STYLE_PROPERTY_GROUPS.position],
    ["size", LINKED_STYLE_PROPERTY_GROUPS.size],
    ["spacing", LINKED_STYLE_PROPERTY_GROUPS.spacing],
    ["appearance", LINKED_STYLE_PROPERTY_GROUPS.appearance],
    ["effects", LINKED_STYLE_PROPERTY_GROUPS.effects],
  ] as const;
  const chooserGroups = groups.map(([group, groupProperties]) => ({
    id: group,
    label: t(`inspector.${group}` as "inspector.layout"),
    items: groupProperties
      .filter((property): property is LinkedStyleAuthorableProperty => property !== "fit" && properties.includes(property))
      .map((property) => ({ id: property, label: linkedStylePropertyLabel(t, property) })),
  }));
  return withTrigger && !openInitially
    ? <CategorizedPropertyChooser dataAttribute="linked-style" openInitially={openInitially} groups={chooserGroups} onSelect={(property) => onChoose(property as LinkedStyleAuthorableProperty)} />
    : <CategorizedPropertyChooserPanel dataAttribute="linked-style" groups={chooserGroups} onSelect={(property) => onChoose(property as LinkedStyleAuthorableProperty)} />;
}

function LinkedStylePropertyRow({ style, property, onUpdate, onRemove, canRemove }: { style: LinkedContainerStyle; property: LinkedStyleProperty; onUpdate: (style: LinkedContainerStyle) => void; onRemove: () => void; canRemove: boolean }) {
  const { t } = useStudioI18n();
  const authoringHistory = useAuthoringHistory();
  const definitionMeta = { kind: "linkedStyle.definition", labelKey: "history.element.setting", labelParams: { setting: "linkedStyle.definition" } } as const;
  const numberHistoryMeta = { kind: "number.change", labelKey: "history.number.change" } as const;
  const numberHistoryKey = `number:linked-style-${style.id}-${property}`;
  const runDiscrete = (callback: () => void): void => {
    if (authoringHistory) authoringHistory.discrete(definitionMeta, callback);
    else callback();
  };
  const runContinuous = (callback: () => void): void => {
    if (!authoringHistory) {
      callback();
      return;
    }
    authoringHistory.begin(numberHistoryKey, numberHistoryMeta);
    authoringHistory.update(numberHistoryKey, callback);
  };
  const displayLabel = linkedStylePropertyLabel(t, property);
  const numeric = (value: number | undefined, update: (next: number | undefined) => LinkedContainerStyle) => <input type="number" value={value ?? ""} onFocus={() => authoringHistory?.begin(numberHistoryKey, numberHistoryMeta)} onBlur={() => authoringHistory?.finish(numberHistoryKey)} onChange={(event) => runContinuous(() => onUpdate(update(event.target.value === "" ? undefined : Number(event.target.value))))} />;
  const layoutUpdate = (update: (layout: NonNullable<LinkedContainerStyle["layout"]>) => NonNullable<LinkedContainerStyle["layout"]>) => ({ ...style, layout: update({ ...style.layout, children: style.layout?.children === undefined ? undefined : { ...style.layout.children } }) });
  const childrenUpdate = (update: (children: NonNullable<NonNullable<LinkedContainerStyle["layout"]>["children"]>) => NonNullable<NonNullable<LinkedContainerStyle["layout"]>["children"]>) => layoutUpdate((layout) => ({ ...layout, children: update({ ...(layout.children ?? {}) }) }));
  const numberLayout = (field: "padding" | "paddingTop" | "paddingRight" | "paddingBottom" | "paddingLeft" | "margin" | "marginTop" | "marginRight" | "marginBottom" | "marginLeft" | "top" | "right" | "bottom" | "left", value: number | undefined) => layoutUpdate((layout) => ({ ...layout, [field]: value }));
  const numericLayoutValue = (field: "padding" | "paddingTop" | "paddingRight" | "paddingBottom" | "paddingLeft" | "margin" | "marginTop" | "marginRight" | "marginBottom" | "marginLeft" | "top" | "right" | "bottom" | "left") => typeof style.layout?.[field] === "number" ? style.layout[field] : undefined;
  const commitLayout = (update: (layout: NonNullable<LinkedContainerStyle["layout"]>) => NonNullable<LinkedContainerStyle["layout"]>) => onUpdate(layoutUpdate(update));
  const commitChildren = (update: (children: NonNullable<NonNullable<LinkedContainerStyle["layout"]>["children"]>) => NonNullable<NonNullable<LinkedContainerStyle["layout"]>["children"]>) => onUpdate(childrenUpdate(update));
  let control: ReactNode;
  switch (property) {
    case "layoutMode": control = <select value={style.layout?.children?.mode ?? "flow"} onChange={(event) => runDiscrete(() => commitChildren((children) => ({ ...children, mode: event.target.value as "flow" | "stack" })))}><option value="flow">{t("inspector.flow")}</option><option value="stack">{t("inspector.stack")}</option></select>; break;
    case "direction": control = <select value={style.layout?.children?.direction ?? "column"} onChange={(event) => runDiscrete(() => commitChildren((children) => ({ ...children, direction: event.target.value as "row" | "column" })))}><option value="column">{t("inspector.vertical")}</option><option value="row">{t("inspector.horizontal")}</option></select>; break;
    case "gap": control = numeric(typeof style.layout?.children?.gap === "number" ? style.layout.children.gap : undefined, (next) => { const updated = addLinkedStyleProperty(removeLinkedStyleProperty(style, property), property); updated.layout = { ...updated.layout, children: { ...updated.layout?.children, gap: next } }; return updated; }); break;
    case "distribution": control = <select value={style.layout?.children?.distribution ?? "packed"} onChange={(event) => runDiscrete(() => commitChildren((children) => ({ ...children, distribution: event.target.value as "packed" | "space-between" | "space-around" | "space-evenly" })))}><option value="packed">{t("inspector.distribution.packed")}</option><option value="space-between">{t("inspector.distribution.spaceBetween")}</option><option value="space-around">{t("inspector.distribution.spaceAround")}</option><option value="space-evenly">{t("inspector.distribution.spaceEvenly")}</option></select>; break;
    case "horizontalAlign":
    case "verticalAlign": control = <select value={style.layout?.children?.[property] ?? "start"} onChange={(event) => runDiscrete(() => commitChildren((children) => ({ ...children, [property]: event.target.value as "start" | "center" | "end" | "stretch" })))}><option value="start">{t("inspector.start")}</option><option value="center">{t("inspector.center")}</option><option value="end">{t("inspector.end")}</option><option value="stretch">{t("inspector.stretch")}</option></select>; break;
    case "overflow": control = <select value={style.layout?.overflow ?? "visible"} onChange={(event) => runDiscrete(() => commitLayout((layout) => ({ ...layout, overflow: event.target.value as "visible" | "hidden" | "auto" })))}><option value="visible">{t("inspector.overflow.visible")}</option><option value="hidden">{t("inspector.overflow.hidden")}</option><option value="auto">{t("inspector.overflow.auto")}</option></select>; break;
    case "fit": control = <select value={style.layout?.children?.fit?.mode ?? "contain"} onChange={(event) => runDiscrete(() => commitChildren((children) => children.fit === undefined ? children : ({ ...children, fit: { ...children.fit, mode: event.target.value as "contain" | "cover" | "fill" } })))}><option value="contain">{t("inspector.childrenFit.contain")}</option><option value="cover">{t("inspector.childrenFit.cover")}</option><option value="fill">{t("inspector.childrenFit.fill")}</option></select>; break;
    case "position": control = <select value={style.layout?.position ?? "absolute"} onChange={(event) => runDiscrete(() => commitLayout((layout) => ({ ...layout, position: event.target.value as "absolute" })))}><option value="absolute">{t("inspector.absolute")}</option></select>; break;
    case "top": case "right": case "bottom": case "left": control = numeric(numericLayoutValue(property), (next) => numberLayout(property, next)); break;
    case "width": case "height": control = <div className={styles.unitInput}><input type="number" min="0" max="100" value={typeof style.layout?.[property] === "string" && style.layout[property].endsWith("%") ? Number(style.layout[property].slice(0, -1)) : ""} onFocus={() => authoringHistory?.begin(numberHistoryKey, numberHistoryMeta)} onBlur={() => authoringHistory?.finish(numberHistoryKey)} onChange={(event) => runContinuous(() => commitLayout((layout) => ({ ...layout, [property]: event.target.value === "" ? undefined : `${Number(event.target.value)}%` })))} /><span>%</span></div>; break;
    case "preserveSize": control = <label className={styles.linkedStyleCheckboxRow}><input aria-label={displayLabel} type="checkbox" checked={style.layout?.flexShrink === 0} onChange={(event) => runDiscrete(() => commitLayout((layout) => ({ ...layout, flexShrink: event.target.checked ? 0 : undefined })))} /><span className={styles.resourcePropertyVisuallyHidden}>{displayLabel}</span></label>; break;
    case "padding": case "paddingTop": case "paddingRight": case "paddingBottom": case "paddingLeft": case "margin": case "marginTop": case "marginRight": case "marginBottom": case "marginLeft": control = numeric(numericLayoutValue(property), (next) => numberLayout(property, next)); break;
    case "color": control = <ColorControl id={`linked-style-${style.id}-color`} name={linkedStylePropertyLabel(t, property)} value={style.style?.color} onChange={(color) => onUpdate({ ...style, style: { ...style.style, color } })} />; break;
    case "backgroundColor": control = <ColorControl id={`linked-style-${style.id}-background-color`} name={linkedStylePropertyLabel(t, property)} value={style.style?.background?.color} onChange={(color) => onUpdate({ ...style, style: { ...style.style, background: { ...style.style?.background, color } } })} />; break;
    case "gradient": control = <ElementGradientControl allowNone={false} gradient={style.style?.background?.gradient} controlPrefix={`linked-style-${style.id}`} onChange={(gradient) => onUpdate({ ...style, style: { ...style.style, background: { ...style.style?.background, gradient } } })} />; break;
    case "pattern": control = <ContainerBackgroundPatternControl allowNone={false} element={{ id: style.id, type: "container", hidden: false, children: [], style: style.style }} controlPrefix={`linked-style-${style.id}`} onChange={(pattern, color) => onUpdate({ ...style, style: { ...style.style, background: { ...style.style?.background, pattern, ...(color === undefined ? {} : { color }) } } })} />; break;
    case "border": control = <ElementBorderControl allowNone={false} border={style.style?.border} controlPrefix={`linked-style-${style.id}`} onChange={(border) => onUpdate({ ...style, style: { ...style.style, border } })} />; break;
    case "borderRadius": control = <LinkedStyleLengthField id={`linked-style-${style.id}-border-radius`} label={t("inspector.roundedCorners")} hideLabel value={style.style?.borderRadius} onChange={(value) => onUpdate({ ...style, style: { ...style.style, borderRadius: value } })} />; break;
    case "opacity": control = <input type="number" min="0" max="100" value={style.effect?.opacity === undefined ? "" : style.effect.opacity * 100} onFocus={() => authoringHistory?.begin(numberHistoryKey, numberHistoryMeta)} onBlur={() => authoringHistory?.finish(numberHistoryKey)} onChange={(event) => runContinuous(() => onUpdate({ ...style, effect: { ...style.effect, opacity: event.target.value === "" ? undefined : Number(event.target.value) / 100 } }))} />; break;
    case "shadow": control = <ContainerEffectsSection embedded allowNone={false} showSourceMeta={false} element={{ id: style.id, type: "container", hidden: false, children: [], effect: style.effect }} onUpdate={(update) => { const next = update({ id: style.id, type: "container", hidden: false, children: [], effect: style.effect }); if (next.type === "container") onUpdate({ ...style, effect: next.effect }); }} />; break;
  }
  return <div className={styles.resourcePropertyCard} data-linked-style-property={property}>
    <div className={styles.resourcePropertyHeader}>
      <span className={styles.resourcePropertyLabel}>{displayLabel}</span>
      <button type="button" className={styles.resourceIconAction} data-resource-action="remove" data-linked-style-property-remove disabled={!canRemove} onClick={onRemove} aria-label={t("customResources.removeProperty", { property: displayLabel })}>×</button>
    </div>
    <div className={styles.resourcePropertyControl} data-linked-style-property-control>
      {control}
    </div>
  </div>;
}

function LinkedStyleNameField({ style, labelKey = "customResources.linkedStyleName", onDraftChange, onRename }: { style: Pick<LinkedContainerStyle | LinkedTopicsStyle, "id" | "name">; labelKey?: "customResources.linkedStyleName" | "creation.rootDefinitionName"; onDraftChange?: () => void; onRename: (id: string, name: string) => void }) {
  const { t } = useStudioI18n();
  const [draft, setDraft] = useState(style.name);
  useEffect(() => setDraft(style.name), [style.id, style.name]);
  const commit = () => { const next = draft.trim(); if (next) onRename(style.id, next); else setDraft(style.name); };
  return <label className={styles.field}><span>{t(labelKey)}</span><input value={draft} onChange={(event) => { setDraft(event.target.value); onDraftChange?.(); }} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commit(); event.currentTarget.blur(); } if (event.key === "Escape") { setDraft(style.name); onDraftChange?.(); event.currentTarget.blur(); } }} /></label>;
}

function LinkedStyleLengthField({ id, label, value, onChange, hideLabel = false, historyScope = "linkedStyle" }: { id: string; label: string; value: Length | undefined; onChange: (value: Length | undefined) => void; hideLabel?: boolean; historyScope?: "linkedStyle" | "textStyle" }) {
  const authoringHistory = useAuthoringHistory();
  const numberHistoryKey = `number:${id}`;
  const numberHistoryMeta = { kind: "number.change", labelKey: "history.number.change" } as const;
  const definitionMeta = historyScope === "textStyle"
    ? { kind: "textStyle.definition", labelKey: "history.element.setting", labelParams: { setting: "textStyle.definition" } } as const
    : { kind: "linkedStyle.definition", labelKey: "history.element.setting", labelParams: { setting: "linkedStyle.definition" } } as const;
  const parsed = value === undefined ? undefined : parseAuthoringLength(value);
  const [unit, setUnit] = useState<AuthoringLengthUnit>(parsed?.unit === "rem" ? "rem" : "px");
  useEffect(() => setUnit(parsed?.unit === "rem" ? "rem" : "px"), [parsed?.unit]);
  const numericValue = value === undefined ? "" : (convertAuthoringLength(value, unit) ?? "");

  return <label className={styles.field}>
    <span className={hideLabel ? styles.resourcePropertyVisuallyHidden : undefined}>{label}</span>
    <div className={styles.unitInput}>
      <input id={id} type="number" step="any" value={numericValue} onFocus={() => authoringHistory?.begin(numberHistoryKey, numberHistoryMeta)} onBlur={() => authoringHistory?.finish(numberHistoryKey)} onChange={(event) => {
        if (event.target.value === "") {
          if (authoringHistory) {
            authoringHistory.begin(numberHistoryKey, numberHistoryMeta);
            authoringHistory.update(numberHistoryKey, () => onChange(undefined));
          } else onChange(undefined);
          return;
        }
        const next = event.target.valueAsNumber;
        if (Number.isFinite(next)) {
          const update = () => onChange(serializeAuthoringLength(next, unit));
          if (authoringHistory) {
            authoringHistory.begin(numberHistoryKey, numberHistoryMeta);
            authoringHistory.update(numberHistoryKey, update);
          } else update();
        }
      }} />
      <select aria-label={`${label} unit`} value={unit} onChange={(event) => {
        const nextUnit = event.target.value as AuthoringLengthUnit;
        setUnit(nextUnit);
        if (value !== undefined) {
          const converted = convertAuthoringLength(value, nextUnit);
          if (converted !== undefined) {
            const update = () => onChange(serializeAuthoringLength(converted, nextUnit));
            if (authoringHistory) {
              authoringHistory.finish(numberHistoryKey);
              authoringHistory.discrete(definitionMeta, update);
            } else update();
          }
        }
      }}>
        <option value="px">px</option>
        <option value="rem">rem</option>
      </select>
    </div>
  </label>;
}

function ResourceUsageLocations({ presentation, locations, onSelect, onRequestDetach, styleName }: { presentation?: Presentation; locations: readonly { target: AuthoringTarget; elementId: string }[]; onSelect: (location: { target: AuthoringTarget; elementId: string }) => void; onRequestDetach?: (location: { target: AuthoringTarget; elementId: string }) => void; styleName?: string }) {
  const { t } = useStudioI18n();
  const ownerLabel = (target: AuthoringTarget): string => {
    if (target.kind === "slide") return t("slides.current", { number: target.slideIndex + 1 });
    const name = presentation?.rootDefinitions?.find((definition) => definition.id === target.rootDefinitionId)?.name ?? target.rootDefinitionId;
    return t("customResources.rootDefinitionLocation", { name });
  };
  return <div className={styles.resourceUsageLocations}><span className={styles.status}>{t(locations.length === 1 ? "customResources.textStyleUsedByOne" : "customResources.textStyleUsedByMany", { count: locations.length })}</span>{locations.map((location) => <div key={`${location.target.kind}:${location.target.kind === "slide" ? location.target.slideIndex : location.target.rootDefinitionId}:${location.elementId}`} className={styles.resourceItem}><button type="button" className={styles.resourceUsageTarget} onClick={() => onSelect(location)}><span className={styles.resourceItemDetailsStack}><strong>{ownerLabel(location.target)}</strong><span className={styles.masterPaletteCount}>{location.elementId}</span></span></button>{onRequestDetach && styleName ? <button type="button" className={styles.resourceIconAction} data-resource-action="detach" aria-label={t("customResources.detachStyleElement", { style: styleName })} onClick={(event) => { event.stopPropagation(); onRequestDetach(location); }}>×</button> : null}</div>)}</div>;
}

function TextStylesWorkspace({
  presentationStyles, presentation, presentationFonts, editingStyleId, onEdit, onUpdateFundamental, onResetFundamental,
  onAdd, adding, onCancelAdd, onCreate, onUpdate, onRemove, isInUse, onSelectElement, onRequestDetachElement,
  onCreateFromSelected, selectedElement,
}: {
  presentationStyles: readonly TextStyle[];
  presentation?: Presentation;
  presentationFonts: readonly FontResource[];
  editingStyleId: string | null;
  onEdit: (id: string) => void;
  onUpdateFundamental: (id: "title" | "subtitle" | "body" | "caption", patch: TextStylePatch) => void;
  onResetFundamental: (id: "title" | "subtitle" | "body" | "caption") => void;
  onAdd: () => void;
  adding: boolean;
  onCancelAdd: () => void;
  onCreate: (name: string, role: TextStyleRole) => void;
  onCreateFromSelected: (name: string) => void;
  onUpdate: (id: string, patch: TextStylePatch & { name?: string; role?: TextStyleRole }) => void;
  onRemove: (id: string) => void;
  onSelectElement: (location: TextStyleUsageLocation, styleId: string) => void;
  onRequestDetachElement: (styleId: string, styleName: string, location: TextStyleUsageLocation) => void;
  isInUse: (id: string) => boolean;
  selectedElement?: PresentationElement | null;
}) {
  const { t } = useStudioI18n();
  const authoringHistory = useAuthoringHistory();
  const runTextStyleDiscrete = (meta: { kind: string; labelKey: string; labelParams: { setting: string } }, callback: () => void): void => {
    if (authoringHistory) authoringHistory.discrete(meta, callback);
    else callback();
  };
  const runTextStyleDefinitionDiscrete = (callback: () => void): void => runTextStyleDiscrete({ kind: "textStyle.definition", labelKey: "history.element.setting", labelParams: { setting: "textStyle.definition" } }, callback);
  const runTextStyleAddDiscrete = (callback: () => void): void => runTextStyleDiscrete({ kind: "textStyle.add", labelKey: "history.element.setting", labelParams: { setting: "textStyle.add" } }, callback);
  const runTextStyleRemoveDiscrete = (callback: () => void): void => runTextStyleDiscrete({ kind: "textStyle.remove", labelKey: "history.element.setting", labelParams: { setting: "textStyle.remove" } }, callback);
  const [addingFromSelected, setAddingFromSelected] = useState(false);
  const projectedStyles = listPresentationTextStyles({ textStyles: presentationStyles });
  const byId = new Map(projectedStyles.filter((item) => item.style !== undefined).map((item) => [item.id, item.style]));
  const customStyles = projectedStyles.filter((item) => !FUNDAMENTAL_TEXT_STYLE_IDS.some((fundamentalId) => fundamentalId === item.id) && item.style !== undefined).map((item) => item.style as TextStyle);
  return <section
    className={styles.textStylesSection}
    data-presentation-text-styles
  >
    <div className={styles.typographyStyleList}>
      {FUNDAMENTAL_TEXT_STYLE_IDS.map((id) => {
        const style = byId.get(id);
        const locations = presentation ? findTextStyleUsageLocations(presentation, id) : [];
        return <TextStyleRow key={id} id={id} label={t(`customResources.role.${id}`)} status={`${style ? t("customResources.customized") : t("customResources.builtIn")} · ${t(locations.length === 1 ? "customResources.textStyleUsedByOne" : "customResources.textStyleUsedByMany", { count: locations.length })}`} locations={locations} onSelectElement={onSelectElement} onRequestDetachElement={(location) => onRequestDetachElement(id, t(`customResources.role.${id}`), location)} editing={editingStyleId === id} style={style} presentation={presentation} fonts={presentationFonts} onEdit={onEdit} onUpdate={(patch) => onUpdateFundamental(id, patch)} onReset={() => onResetFundamental(id)} runDefinitionDiscrete={runTextStyleDefinitionDiscrete} />;
      })}
      {customStyles.map((style) => { const locations = presentation ? findTextStyleUsageLocations(presentation, style.id) : []; const styleName = "name" in style ? style.name : style.id; return <TextStyleRow key={style.id} id={style.id} label={styleName} status={`${"role" in style ? t(`customResources.role.${style.role}`) : ""} · ${t(locations.length === 1 ? "customResources.textStyleUsedByOne" : "customResources.textStyleUsedByMany", { count: locations.length })}`} locations={locations} onSelectElement={onSelectElement} onRequestDetachElement={(location) => onRequestDetachElement(style.id, styleName, location)} editing={editingStyleId === style.id} style={style} presentation={presentation} fonts={presentationFonts} onEdit={onEdit} onUpdate={(patch) => onUpdate(style.id, patch)} onRemove={() => runTextStyleRemoveDiscrete(() => onRemove(style.id))} removeDisabled={presentation ? locations.length > 0 : isInUse(style.id)} runDefinitionDiscrete={runTextStyleDefinitionDiscrete} />; })}
    </div>
    {adding ? <NewTextStyleForm fonts={presentationFonts} onCancel={onCancelAdd} onCreate={(name, role) => runTextStyleAddDiscrete(() => onCreate(name, role))} /> : addingFromSelected ? <NewTextStyleFromSelectedForm onCancel={() => setAddingFromSelected(false)} onCreate={(name) => { onCreateFromSelected(name); setAddingFromSelected(false); }} /> : <div className={styles.resourceActionRow}><button type="button" className={styles.resourceAction} onClick={onAdd}>{t("customResources.addStyle")}</button><button type="button" className={styles.resourceAction} disabled={selectedElement?.type !== "text"} onClick={() => setAddingFromSelected(true)}>{t("customResources.addToTextStyles")}</button></div>}
  </section>;
}

function NewTextStyleFromSelectedForm({ onCancel, onCreate }: { onCancel: () => void; onCreate: (name: string) => void }) {
  const { t } = useStudioI18n();
  const [name, setName] = useState("");
  return <div className={styles.resourcePropertyEditor}>
    <label className={styles.field}><span>{t("customResources.styleName")}</span><input value={name} onChange={(event) => setName(event.target.value)} /></label>
    <button type="button" className={styles.resourceAction} disabled={!name.trim()} onClick={() => onCreate(name)}>{t("customResources.addStyle")}</button>
    <Button variant="ghost" size="compact" onClick={onCancel}>{t("customResources.close")}</Button>
  </div>;
}



function TextStyleRow({ id, label, status, locations, onSelectElement, onRequestDetachElement, editing, style, presentation, fonts, onEdit, onUpdate, onReset, onRemove, removeDisabled, runDefinitionDiscrete }: {
  id: string; label: string; status: string; editing: boolean; style?: TextStyle; presentation?: Presentation; fonts: readonly FontResource[];
  locations: readonly TextStyleUsageLocation[]; onSelectElement: (location: TextStyleUsageLocation, styleId: string) => void; onRequestDetachElement: (location: TextStyleUsageLocation) => void;
  onEdit: (id: string) => void; onUpdate?: (value: TextStylePatch & { name?: string; role?: TextStyleRole }) => void;
  onReset?: () => void; onRemove?: () => void; removeDisabled?: boolean;
  runDefinitionDiscrete?: (callback: () => void) => void;
}) {
  const { t } = useStudioI18n();
  const runDirectDefinition = runDefinitionDiscrete ?? ((callback: () => void) => callback());
  const [pendingFontFamily, setPendingFontFamily] = useState(false);
  const [pendingColor, setPendingColor] = useState(false);
  const [pendingDecorationColor, setPendingDecorationColor] = useState(false);
  const [pendingStroke, setPendingStroke] = useState<{ width: number } | undefined>();
  const fundamental = FUNDAMENTAL_TEXT_STYLE_IDS.some((fundamentalId) => fundamentalId === id);
  const role = fundamental ? id as TextStyleRole : (style && "role" in style ? style.role : "body");
  const typography = style?.typography;
  const visual = style?.style;
  const layout = style?.layout;
  const previewText: TextElement = presentation
    ? { id: `text-style-preview-${id}`, type: "text", hidden: false, variant: id, content: "Aa", layout: {} }
    : { id: `text-style-preview-${id}`, type: "text", hidden: false, variant: role, content: "Aa", typography: { ...TEXT_VARIANT_TYPOGRAPHY_DEFAULTS[role], ...typography } };
  const editorId = `text-style-${id}-editor`;
  const visibleProperties = TEXT_STYLE_DISPLAY_ORDER.filter((item) => {
    if (item.kind === "typography") return typography?.[item.property] !== undefined || (item.property === "fontFamily" && pendingFontFamily);
    if (item.property === "color") return visual?.color !== undefined || pendingColor;
    if (item.property === "textDecorationColor") return typography?.textDecorationColor !== undefined || pendingDecorationColor;
    if (item.kind === "appearance") return typography?.textStroke !== undefined || pendingStroke !== undefined;
    return layout?.[item.property] !== undefined;
  });
  const propertyGroups = [
    {
      id: "typography",
      label: "inspector.typography" as const,
      items: visibleProperties.filter((item) => item.kind === "typography" || item.property === "textDecorationColor"),
    },
    {
      id: "appearance",
      label: "inspector.appearance" as const,
      items: visibleProperties.filter((item) => item.property === "color" || item.property === "textStroke"),
    },
    {
      id: "spacing",
      label: "inspector.spacing" as const,
      items: visibleProperties.filter((item) => item.kind === "layout"),
    },
  ] as const;
  const authoredTypographyProperties = visibleProperties.filter((item) => item.kind === "typography" && typography?.[item.property] !== undefined).map((item) => item.property);
  const availableProperties = TEXT_STYLE_TYPOGRAPHY_PROPERTY_NAMES.filter((property) => !authoredTypographyProperties.includes(property) && !(property === "fontFamily" && pendingFontFamily));
  const availableAppearance = [
    ...(visual?.color === undefined && !pendingColor ? ["color" as const] : []),
    ...(typography?.textDecorationColor === undefined && !pendingDecorationColor ? ["textDecorationColor" as const] : []),
    ...(typography?.textStroke === undefined && pendingStroke === undefined ? ["textStroke" as const] : []),
  ];
  const availableLayout = TEXT_STYLE_LAYOUT_PROPERTY_NAMES.filter((property) => layout?.[property] === undefined);
  const addProperty = (property: CoreTypographyProperty): void => {
    if (property === "fontFamily") {
      setPendingFontFamily(true);
      return;
    }
    const baseline = resolveThemeTextTypographyBaseline(role);
    const value = baseline[property];
    if (value === undefined) return;
    const nextTypography = { ...(typography ?? {}), [property]: value };
    runDirectDefinition(() => onUpdate?.({ typography: normalizeTextStyleTypographyProperties(nextTypography) }));
  };
  const addLayoutProperty = (property: (typeof TEXT_STYLE_LAYOUT_PROPERTY_NAMES)[number]): void => {
    runDirectDefinition(() => onUpdate?.({ layout: normalizeTextStyleLayoutProperties({ ...(layout ?? {}), [property]: 0 }) }));
  };
  const updateTypography = (update: (current: TextStyleTypographyProperties | undefined) => TextStyleTypographyProperties): void => {
    const nextTypography = normalizeTextStyleTypographyProperties(update(typography));
    onUpdate?.({ typography: nextTypography });
  };
  const updateStyle = (update: (current: TextStyleVisualProperties | undefined) => TextStyleVisualProperties): void => {
    onUpdate?.({ style: normalizeTextStyleVisualProperties(update(visual)) });
  };
  const updateLayout = (update: (current: TextStyleLayoutProperties | undefined) => TextStyleLayoutProperties): void => {
    onUpdate?.({ layout: normalizeTextStyleLayoutProperties(update(layout)) });
  };
  const removeAppearance = (property: "color" | "textDecorationColor" | "textStroke"): void => {
    if (property === "color") { if (pendingColor && visual?.color === undefined) setPendingColor(false); else runDirectDefinition(() => updateStyle((current) => ({ ...(current ?? {}), color: undefined }))); }
    else if (property === "textDecorationColor") { if (pendingDecorationColor && typography?.textDecorationColor === undefined) setPendingDecorationColor(false); else runDirectDefinition(() => updateTypography((current) => ({ ...(current ?? {}), textDecorationColor: undefined }))); }
    else if (pendingStroke && typography?.textStroke === undefined) setPendingStroke(undefined);
    else runDirectDefinition(() => updateTypography((current) => ({ ...(current ?? {}), textStroke: undefined })));
  };
  const addAppearance = (property: (typeof availableAppearance)[number]): void => {
    if (property === "color") setPendingColor(true);
    else if (property === "textDecorationColor") setPendingDecorationColor(true);
    else setPendingStroke({ width: 1 });
  };
  const commitColor = (property: "color" | "textDecorationColor", color: ColorValue): void => {
    if (property === "color") { setPendingColor(false); updateStyle((current) => ({ ...(current ?? {}), color })); }
    else { setPendingDecorationColor(false); updateTypography((current) => ({ ...(current ?? {}), textDecorationColor: color })); }
  };
  const commitStrokeColor = (color: ColorValue): void => {
    const current = typography?.textStroke;
    const width = current?.width ?? pendingStroke?.width ?? 1;
    setPendingStroke(undefined);
    updateTypography((value) => ({ ...(value ?? {}), textStroke: { width, color } }));
  };
  const removeProperty = (property: CoreTypographyProperty): void => {
    if (property === "fontFamily" && pendingFontFamily && typography?.fontFamily === undefined) {
      setPendingFontFamily(false);
      return;
    }
    runDirectDefinition(() => updateTypography((current) => ({ ...(current ?? {}), [property]: undefined })));
  };
  const removeLayoutProperty = (property: (typeof TEXT_STYLE_LAYOUT_PROPERTY_NAMES)[number]): void => {
    runDirectDefinition(() => updateLayout((current) => ({ ...(current ?? {}), [property]: undefined })));
  };

  return <div className={styles.typographyStyleRow} data-text-style-id={id}>
    <div className={styles.typographyStyleHeader}>
      <button
        type="button"
        className={styles.typographyStyleDisclosure}
        aria-expanded={editing}
        aria-controls={editorId}
        onClick={() => onEdit(id)}
      >
        <span className={styles.resourceItemDetails}>
          <strong>{label}</strong>
          <span className={styles.resourceItemMeta}>{status}</span>
        </span>
        <span className={styles.resourceDisclosureChevron} aria-hidden="true">{editing ? "▾" : "▸"}</span>
      </button>
    </div>
    {editing ? <div id={editorId} className={styles.typographyStyleEditor}>
      <div
        className={styles.typographyStylePreview}
        data-text-style-preview={id}
        aria-hidden="true"
        style={presentation ? Object.fromEntries((presentation.palette?.colors ?? []).map((color) => [paletteColorCssVariableName(color.id), color.value])) : undefined}
        dangerouslySetInnerHTML={{ __html: renderElement(previewText, presentation ? { presentation } : undefined) }}
      />
      {!fundamental && style && "name" in style ? <CustomTextStyleNameInput canonicalName={style.name} onCommit={(name) => runDirectDefinition(() => onUpdate?.({ name }))} /> : null}
      {!fundamental && <label className={styles.localColorName}><span>{t("customResources.role")}</span><select value={role} onChange={(event) => runDirectDefinition(() => onUpdate?.({ role: event.target.value as TextStyleRole }))}>{FUNDAMENTAL_TEXT_STYLE_IDS.map((roleId) => <option key={roleId} value={roleId}>{t(`customResources.role.${roleId}`)}</option>)}</select></label>}
      {visibleProperties.length === 0 ? <p className={styles.status}>{t("customResources.noTypographyProperties")}</p> : null}
      <div className={styles.resourcePropertyStack}>
        {propertyGroups.map((group) => group.items.length === 0 ? null : <section className={styles.resourcePropertyGroup} data-text-style-property-group={group.id} key={group.id}>
          <h4 className={styles.resourcePropertyGroupTitle}>{t(group.label)}</h4>
          {group.items.map((item) => <div className={styles.resourcePropertyCard} data-text-style-property={item.property} data-compact-field-label={item.kind === "typography" ? "true" : undefined} key={item.property}>
            <div className={styles.resourcePropertyHeader}>
              <span className={styles.resourcePropertyLabel}>{t(item.kind === "typography" ? propertyLabelKey[item.property] : item.kind === "appearance" ? appearanceLabelKey[item.property] : layoutLabelKey[item.property])}</span>
              <button type="button" className={styles.resourceIconAction} data-resource-action="remove" aria-label={t("customResources.removeProperty", { property: t(item.kind === "typography" ? propertyLabelKey[item.property] : item.kind === "appearance" ? appearanceLabelKey[item.property] : layoutLabelKey[item.property]) })} onClick={() => item.kind === "typography" ? removeProperty(item.property) : item.kind === "appearance" ? removeAppearance(item.property) : removeLayoutProperty(item.property)}>×</button>
            </div>
            <div className={styles.resourcePropertyControl} data-text-style-property-control>
              {item.kind === "typography" ? <ElementTypographyFields typography={typography} effectiveDefaults={TEXT_VARIANT_TYPOGRAPHY_DEFAULTS[role]} fontResources={fonts} visibleProperties={[item.property]} controlPrefix={`text-style-${id}`} onUpdateTypography={(update) => { const next = normalizeTextStyleTypographyProperties(update(typography)); if (item.property === "fontFamily" && next.fontFamily !== undefined) setPendingFontFamily(false); updateTypography(() => next); }} /> : null}
              {item.property === "color" ? <ColorControl id={`text-style-${id}-color`} name={t("inspector.color")} value={visual?.color} onChange={(color) => commitColor("color", color)} /> : null}
              {item.property === "textDecorationColor" ? <ColorControl id={`text-style-${id}-decoration-color`} name={t("inspector.topics.decorationColor")} value={typography?.textDecorationColor} onChange={(color) => commitColor("textDecorationColor", color)} /> : null}
              {item.property === "textStroke" ? <TextStyleStrokeFields id={id} stroke={typography?.textStroke} pendingWidth={pendingStroke?.width} onWidthChange={(width) => { if (typography?.textStroke) updateTypography((current) => ({ ...(current ?? {}), textStroke: { width, color: current?.textStroke?.color ?? typography.textStroke!.color } })); else setPendingStroke({ width }); }} onColorChange={commitStrokeColor} /> : null}
              {item.kind === "layout" ? <LinkedStyleLengthField historyScope="textStyle" id={`text-style-${id}-${item.property}`} label={t(layoutLabelKey[item.property])} value={layout?.[item.property]} onChange={(value) => updateLayout((current) => ({ ...(current ?? {}), [item.property]: value }))} /> : null}
            </div>
          </div>)}
        </section>)}
      </div>
      {availableProperties.length > 0 || availableAppearance.length > 0 || availableLayout.length > 0 ? <PropertyChooser properties={availableProperties} layoutProperties={availableLayout} appearanceProperties={availableAppearance} onAdd={addProperty} onAddLayout={addLayoutProperty} onAddAppearance={addAppearance} /> : null}
      <div className={styles.linkedStyleSection} data-text-style-usage data-text-style-section="reuse"><h3 className={styles.linkedStyleSectionTitle}>{t("customResources.reuse")}</h3><ResourceUsageLocations presentation={presentation} locations={locations} onSelect={(location) => onSelectElement(location, id)} onRequestDetach={onRequestDetachElement} styleName={label} /></div>
      {fundamental && style && onReset ? <div className={styles.resourceStyleActions}><button type="button" className={styles.resourceAction} onClick={onReset}>{t("customResources.reset")}</button></div> : null}
      {!fundamental && onRemove ? <div className={styles.resourceStyleActions}><button type="button" className={styles.resourceAction} disabled={removeDisabled} onClick={onRemove}>{t("customResources.remove")}</button></div> : null}
    </div> : null}
  </div>;
}

const propertyLabelKey: Record<CoreTypographyProperty, Parameters<ReturnType<typeof useStudioI18n>["t"]>[0]> = {
  fontFamily: "inspector.fontFamily",
  fontSize: "inspector.fontSize",
  fontWeight: "inspector.fontWeight",
  fontStyle: "inspector.fontStyle",
  textAlign: "inspector.textAlignment",
  lineHeight: "inspector.lineHeight",
  letterSpacing: "inspector.letterSpacing",
  textTransform: "inspector.textCase",
  whiteSpace: "inspector.whiteSpace",
  textWrapStyle: "inspector.textWrap",
  overflowWrap: "inspector.overflowWrap",
  textDecorationLine: "inspector.textDecorationLine",
};

const appearanceLabelKey = {
  color: "inspector.topics.textColor",
  textDecorationColor: "inspector.topics.decorationColor",
  textStroke: "inspector.textStroke",
} as const;

const layoutLabelKey: Record<(typeof TEXT_STYLE_LAYOUT_PROPERTY_NAMES)[number], Parameters<ReturnType<typeof useStudioI18n>["t"]>[0]> = {
  margin: "inspector.margin",
  marginTop: "inspector.marginTop",
  marginRight: "inspector.marginRight",
  marginBottom: "inspector.marginBottom",
  marginLeft: "inspector.marginLeft",
};

const TEXT_STYLE_DISPLAY_ORDER = [
  { kind: "typography" as const, property: "fontFamily" as const },
  { kind: "typography" as const, property: "fontSize" as const },
  { kind: "typography" as const, property: "fontWeight" as const },
  { kind: "typography" as const, property: "fontStyle" as const },
  { kind: "typography" as const, property: "textAlign" as const },
  { kind: "typography" as const, property: "lineHeight" as const },
  { kind: "typography" as const, property: "letterSpacing" as const },
  { kind: "typography" as const, property: "textTransform" as const },
  { kind: "typography" as const, property: "whiteSpace" as const },
  { kind: "typography" as const, property: "textWrapStyle" as const },
  { kind: "typography" as const, property: "overflowWrap" as const },
  { kind: "typography" as const, property: "textDecorationLine" as const },
  { kind: "appearance" as const, property: "textDecorationColor" as const },
  { kind: "appearance" as const, property: "color" as const },
  { kind: "appearance" as const, property: "textStroke" as const },
  { kind: "layout" as const, property: "margin" as const },
  { kind: "layout" as const, property: "marginTop" as const },
  { kind: "layout" as const, property: "marginRight" as const },
  { kind: "layout" as const, property: "marginBottom" as const },
  { kind: "layout" as const, property: "marginLeft" as const },
] as const;

export type CategorizedPropertyChooserGroup = { id: string; label: string; items: readonly { id: string; label: string }[] };

export function CategorizedPropertyChooserPanel({ groups, onSelect, dataAttribute }: { groups: readonly CategorizedPropertyChooserGroup[]; onSelect: (id: string) => void; dataAttribute?: "linked-style" | "topics-linked-style" }) {
  return <div className={styles.resourceChooser} {...(dataAttribute === "linked-style" ? { "data-linked-style-property-chooser": true } : dataAttribute === "topics-linked-style" ? { "data-topics-linked-style-property-chooser": true } : {})}>
    {groups.map((group) => group.items.length === 0 ? null : <div key={group.id}>
      <h4 className={styles.resourcePropertyGroupTitle}>{group.label}</h4>
      {group.items.map((item) => <button key={item.id} type="button" className={styles.resourceChooserOption} onClick={() => onSelect(item.id)}>{item.label}</button>)}
    </div>)}
  </div>;
}

export function CategorizedPropertyChooser({ groups, onSelect, dataAttribute, openInitially = false }: { groups: readonly CategorizedPropertyChooserGroup[]; onSelect: (id: string) => void; dataAttribute?: "linked-style" | "topics-linked-style"; openInitially?: boolean }) {
  const { t } = useStudioI18n();
  const [open, setOpen] = useState(openInitially);
  return <div className={styles.resourcePropertyChooser} {...(dataAttribute === "linked-style" ? { "data-linked-style-property-chooser": true } : dataAttribute === "topics-linked-style" ? { "data-topics-linked-style-property-chooser": true } : {})}>
    <button type="button" className={styles.resourceAction} aria-expanded={open} onClick={() => setOpen((value) => !value)}>{t("customResources.addProperty")}</button>
    {open ? <CategorizedPropertyChooserPanel groups={groups} onSelect={(id) => { onSelect(id); setOpen(false); }} /> : null}
  </div>;
}

function PropertyChooser({ properties, layoutProperties, appearanceProperties, onAdd, onAddLayout, onAddAppearance }: { properties: readonly CoreTypographyProperty[]; layoutProperties: readonly (typeof TEXT_STYLE_LAYOUT_PROPERTY_NAMES)[number][]; appearanceProperties: readonly (keyof typeof appearanceLabelKey)[]; onAdd: (property: CoreTypographyProperty) => void; onAddLayout: (property: (typeof TEXT_STYLE_LAYOUT_PROPERTY_NAMES)[number]) => void; onAddAppearance: (property: keyof typeof appearanceLabelKey) => void }) {
  const { t } = useStudioI18n();
  const availableProperties = new Set<string>([...properties, ...layoutProperties, ...appearanceProperties]);
  const options = TEXT_STYLE_DISPLAY_ORDER.filter(({ property }) => availableProperties.has(property));
  const groups = (["typography", "layout", "appearance"] as const).map((kind) => ({
    id: kind,
    label: t(kind === "typography" ? "inspector.typography" : kind === "layout" ? "inspector.spacing" : "inspector.appearance"),
    items: options.filter((item) => item.kind === kind).map((item) => ({
      id: item.property,
      label: t(item.kind === "typography" ? propertyLabelKey[item.property] : item.kind === "layout" ? layoutLabelKey[item.property] : appearanceLabelKey[item.property]),
    })),
  }));
  return <CategorizedPropertyChooser groups={groups} onSelect={(id) => {
    const item = options.find((candidate) => candidate.property === id);
    if (!item) return;
    if (item.kind === "typography") onAdd(item.property);
    else if (item.kind === "layout") onAddLayout(item.property);
    else onAddAppearance(item.property);
  }} />;
}

function TextStyleStrokeFields({ id, stroke, pendingWidth, onWidthChange, onColorChange }: { id: string; stroke: TextStroke | undefined; pendingWidth: number | undefined; onWidthChange: (width: number) => void; onColorChange: (color: ColorValue) => void }) {
  const { t } = useStudioI18n();
  const authoringHistory = useAuthoringHistory();
  const historyKey = `number:text-style-${id}-stroke-width`;
  const historyMeta = { kind: "number.change", labelKey: "history.number.change" } as const;
  const width = readAbsoluteNumber(stroke?.width ?? pendingWidth);
  const beginEditing = () => {
    if (stroke !== undefined) authoringHistory?.begin(historyKey, historyMeta);
  };
  const updateWidth = (nextWidth: number) => {
    if (stroke === undefined || authoringHistory === null) {
      onWidthChange(nextWidth);
      return;
    }
    authoringHistory.begin(historyKey, historyMeta);
    authoringHistory.update(historyKey, () => onWidthChange(nextWidth));
  };
  return <div className={styles.fieldGrid}>
    <label className={styles.field}><span>{t("inspector.textStrokeWidth")}</span><div className={`${styles.unitInput} ${styles.textStrokeUnitInput}`}><input id={`text-style-${id}-stroke-width`} type="number" min="0" value={width} onFocus={beginEditing} onBlur={() => authoringHistory?.finish(historyKey)} onChange={(event) => updateWidth(Math.max(0, Number(event.target.value) || 0))} /><span>px</span></div></label>
    <label className={styles.field}><span>{t("inspector.textStrokeColor")}</span><ColorControl id={`text-style-${id}-stroke-color`} name={t("inspector.textStrokeColor")} value={stroke?.color} onChange={onColorChange} /></label>
  </div>;
}

function CustomTextStyleNameInput({ canonicalName, onCommit }: { canonicalName: string; onCommit: (name: string) => void }) {
  const { t } = useStudioI18n();
  const [draft, setDraft] = useState(canonicalName);
  const [lastCanonicalName, setLastCanonicalName] = useState(canonicalName);
  if (canonicalName !== lastCanonicalName) {
    setLastCanonicalName(canonicalName);
    setDraft(canonicalName);
  }
  const commit = () => {
    const next = draft.trim();
    if (!next || next === canonicalName) {
      setDraft(canonicalName);
      return;
    }
    onCommit(next);
  };
  return <label className={styles.localColorName}><span>{t("customResources.styleName")}</span><input value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commit(); event.currentTarget.blur(); } }} /></label>;
}

function NewTextStyleForm({ fonts, onCancel, onCreate }: { fonts: readonly FontResource[]; onCancel: () => void; onCreate: (name: string, role: TextStyleRole) => void }) {
  const { t } = useStudioI18n();
  const [name, setName] = useState("");
  const [role, setRole] = useState<TextStyleRole>("body");
  return <div className={styles.localColorAdd} data-new-text-style>
    <label className={styles.localColorName}><span>{t("customResources.styleName")}</span><input value={name} onChange={(event) => setName(event.target.value)} /></label>
    <label className={styles.localColorName}><span>{t("customResources.role")}</span><select value={role} onChange={(event) => setRole(event.target.value as TextStyleRole)}>{FUNDAMENTAL_TEXT_STYLE_IDS.map((roleId) => <option key={roleId} value={roleId}>{t(`customResources.role.${roleId}`)}</option>)}</select></label>
    <button type="button" className={styles.resourceAction} disabled={!name.trim()} onClick={() => onCreate(name, role)}>{t("customResources.addStyle")}</button>
    <button type="button" className={styles.resourceAction} onClick={onCancel}>{t("customResources.close")}</button>
  </div>;
}

function LocalPresentationColorRow({
  color,
  onUpdate,
  onRemove,
}: {
  color: PresentationPaletteColor;
  onUpdate: (id: string, patch: { name: string; value: Color }) => void;
  onRemove: (id: string) => void;
}) {
  const { t } = useStudioI18n();
  const authoringHistory = useAuthoringHistory();
  const colorHistoryKey = `palette-color:${color.id}:value`;
  const colorHistoryMeta = { kind: "color.change", labelKey: "history.color.change" } as const;
  const definitionMeta = { kind: "palette.definition", labelKey: "history.element.setting", labelParams: { setting: "palette.definition" } } as const;
  const removeMeta = { kind: "palette.remove", labelKey: "history.element.setting", labelParams: { setting: "palette.remove" } } as const;
  const [nameDraft, setNameDraft] = useState(color.name);
  const [lastCanonicalName, setLastCanonicalName] = useState(color.name);

  if (color.name !== lastCanonicalName) {
    setLastCanonicalName(color.name);
    setNameDraft(color.name);
  }

  const commitName = () => {
    const nextName = nameDraft.trim();
    if (!nextName || nextName === color.name) {
      setNameDraft(color.name);
      return;
    }
    if (authoringHistory) {
      authoringHistory.discrete(definitionMeta, () => onUpdate(color.id, { name: nextName, value: color.value }));
    } else {
      onUpdate(color.id, { name: nextName, value: color.value });
    }
  };

  const updateValue = (value: Color, source: "picker" | "text" | "format"): void => {
    if (source === "format") {
      authoringHistory?.finish(colorHistoryKey);
      if (authoringHistory) {
        authoringHistory.discrete(colorHistoryMeta, () => onUpdate(color.id, { name: color.name, value }));
      } else {
        onUpdate(color.id, { name: color.name, value });
      }
      return;
    }

    if (authoringHistory) {
      authoringHistory.begin(colorHistoryKey, colorHistoryMeta);
      authoringHistory.update(colorHistoryKey, () => onUpdate(color.id, { name: color.name, value }));
    } else {
      onUpdate(color.id, { name: color.name, value });
    }
  };

  return (
    <div className={styles.resourceItem} data-presentation-color-row>
      <input
        className={styles.localColorInlineName}
        aria-label={t("customResources.colorNameFor", { name: color.name })}
        value={nameDraft}
        onChange={(event) => setNameDraft(event.target.value)}
        onBlur={commitName}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commitName();
            event.currentTarget.blur();
          }
        }}
      />
      <div className={styles.localColorValueRow}>
        <LiteralColorInput
          id={`custom-resources-literal-color-${color.id}`}
          name={t("customResources.color")}
          value={color.value}
          onChange={updateValue}
          onCommit={() => authoringHistory?.finish(colorHistoryKey)}
          onBlur={() => authoringHistory?.finish(colorHistoryKey)}
        />
        <button type="button" className={styles.resourceIconAction} data-resource-action="remove" aria-label={t("customResources.removePresentationColor", { name: color.name })} onClick={() => {
          if (authoringHistory) authoringHistory.discrete(removeMeta, () => onRemove(color.id));
          else onRemove(color.id);
        }}>×</button>
      </div>
    </div>
  );
}

function MasterPaletteChooser({
  loadState,
  onRetry,
  onAdd,
}: {
  loadState: PaletteLoadState;
  onRetry: () => void;
  onAdd: (palette: CustomLibraryPaletteDraft) => CustomLibraryPaletteAddOutcome;
}) {
  const { t } = useStudioI18n();

  if (loadState.kind === "loading") return <p className={styles.status}>{t("customResources.loadingPalettes")}</p>;
  if (loadState.kind === "error") return <div className={styles.statusGroup}><p className={styles.status} role="alert">{t("customResources.loadFailed")}</p><button type="button" className={styles.resourceAction} onClick={onRetry}>{t("customResources.retry")}</button></div>;
  if (loadState.records.length === 0) return <p className={styles.status}>{t("customResources.noLibraryPalettes")}</p>;

  return (
    <div className={styles.masterPaletteList}>
      {loadState.records.map(({ id, palette }) => (
        <div key={id} className={`${styles.resourceItem} ${styles.masterPaletteItem}`} data-custom-resource-palette={id}>
          <div className={styles.masterPaletteHeader} data-palette-header>
            <strong>{palette.name}</strong>
            <button type="button" className={styles.resourceAction} aria-label={t("customResources.addMasterPalette", { name: palette.name })} onClick={() => onAdd(palette)}>+</button>
          </div>
          <div className={styles.masterPalettePreview} data-palette-preview>
            <ColorSwatches colors={palette.colors} />
            <span className={styles.masterPaletteCount} data-palette-count>{t("customResources.colorCount", { count: palette.colors.length })}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function MasterFontChooser({
  loadState,
  onRetry,
  onAdd,
}: {
  loadState: FontLoadState;
  onRetry: () => void;
  onAdd: (font: CustomLibraryFontDraft) => void;
}) {
  const { t } = useStudioI18n();

  if (loadState.kind === "loading") return <p className={styles.status}>{t("customResources.loadingFonts")}</p>;
  if (loadState.kind === "error") return <div className={styles.statusGroup}><p className={styles.status} role="alert">{t("customResources.fontLoadFailed")}</p><button type="button" className={styles.resourceAction} onClick={onRetry}>{t("customResources.retry")}</button></div>;
  if (loadState.records.length === 0) return <p className={styles.status}>{t("customResources.noLibraryFonts")}</p>;

  return <div className={styles.masterFontList}>
    {loadState.records.map(({ id, font }) => <div key={id} className={styles.resourceItem} data-custom-resource-font={id}>
      <div className={styles.resourceItemDetailsStack}>
        <strong>{font.family}</strong>
        <span className={styles.masterPaletteCount}>{t(font.faces.length === 1 ? "customResources.faceCountOne" : "customResources.faceCountMany", { count: font.faces.length })}</span>
      </div>
      <button type="button" className={styles.resourceAction} aria-label={t("customResources.addMasterFont", { family: font.family })} onClick={() => onAdd(font)}>+</button>
    </div>)}
  </div>;
}

function LocalPresentationFontRow({
  font,
  inUse,
  onRemove,
}: {
  font: FontResource;
  inUse: boolean;
  onRemove: (id: string) => CustomLibraryFontRemoveOutcome;
}) {
  const { t } = useStudioI18n();
  const faces = getFontResourceFaces(font);

  return <div className={styles.resourceItem} data-presentation-font-row>
    <div className={styles.resourceItemDetailsStack}>
      <strong>{font.family}</strong>
      <span className={styles.masterPaletteCount}>{t(faces.length === 1 ? "customResources.faceCountOne" : "customResources.faceCountMany", { count: faces.length })}{inUse ? ` · ${t("customResources.inUse")}` : ""}</span>
    </div>
    <button type="button" className={styles.resourceIconAction} data-resource-action="remove" aria-label={t("customResources.removePresentationFont", { family: font.family })} disabled={inUse} onClick={() => onRemove(font.id)}>×</button>
  </div>;
}

function ColorSwatches({ colors }: { colors: readonly { name: string; value: string }[] }) {
  const visibleColors = colors.slice(0, PREVIEW_COLOR_LIMIT);
  const remainingCount = colors.length - visibleColors.length;

  return (
    <div className={styles.swatches} aria-hidden="true">
      {visibleColors.map((color, index) => <span key={`${color.name}-${index}`} className={styles.swatch} data-palette-swatch style={{ backgroundColor: color.value }} />)}
      {remainingCount > 0 ? <span className={styles.moreSwatches}>+{remainingCount}</span> : null}
    </div>
  );
}
