"use client";

import { getFontResourceFaces, FUNDAMENTAL_TEXT_STYLE_IDS, TEXT_STYLE_TYPOGRAPHY_PROPERTY_NAMES, type Color, type ColorValue, type FontResource, type Length, type Presentation, type PresentationPaletteColor, type TextElement, type TextStyle, type TextStyleTypographyProperties, type TextStyleVisualProperties, type TextStyleRole, type TextStroke, type ContainerElement, type LinkedContainerStyle } from "@powershow/document-schema";
import { paletteColorCssVariableName, renderElement } from "@powershow/renderer";
import { convertAuthoringLength, parseAuthoringLength, resolveThemeTextTypographyBaseline, serializeAuthoringLength, TEXT_VARIANT_TYPOGRAPHY_DEFAULTS, type AuthoringLengthUnit } from "@powershow/theme/element-style-defaults";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { LiteralColorInput } from "@/features/editor/color/literal-color-input";
import { InspectorSection } from "@/features/editor/inspector/inspector-section";
import { useStudioI18n } from "@/features/i18n/studio-i18n-context";
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
import { listPresentationTextStyles, normalizeTextStyleTypographyProperties, normalizeTextStyleVisualProperties } from "../text-style-helpers";
import { canUpdateLinkedStyle } from "../linked-style-authoring";
import { addLinkedStyleProperty, hasLinkedStyleProperty, listAvailableLinkedStyleProperties, listLinkedStyleAuthoredProperties, LINKED_STYLE_PROPERTY_GROUPS, removeLinkedStyleProperty, type LinkedStyleAuthorableProperty, type LinkedStyleProperty } from "../linked-style-property-authoring";
import { findContainersLinkedToStyle, findMatchingContainersForLinkedStyle, type LinkedStyleContainerLocation } from "../linked-style-bulk-authoring";

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
  onAddPresentationColor: (name: string, value: Color) => void;
  onUpdatePresentationColor: (id: string, patch: { name: string; value: Color }) => void;
  onRemovePresentationColor: (id: string) => void;
  onRemovePresentationFont: (id: string) => CustomLibraryFontRemoveOutcome;
  isPresentationFontInUse: (family: string) => boolean;
  presentationTextStyles?: readonly TextStyle[];
  presentation?: Presentation;
  onUpdateFundamentalTextStyle?: (id: "title" | "subtitle" | "body" | "caption", patch: TextStylePatch) => void;
  onResetFundamentalTextStyle?: (id: "title" | "subtitle" | "body" | "caption") => void;
  onAddTextStyle?: (name: string, role: TextStyleRole) => void;
  onUpdateTextStyle?: (id: string, patch: TextStylePatch & { name?: string; role?: TextStyleRole }) => void;
  onRemoveTextStyle?: (id: string) => void;
  isTextStyleInUse?: (id: string) => boolean;
  onUpdateLinkedStyle?: (id: string, patch: { layout?: LinkedContainerStyle["layout"]; style?: LinkedContainerStyle["style"]; typography?: LinkedContainerStyle["typography"]; effect?: LinkedContainerStyle["effect"] }) => void;
  onCreateLinkedStyle?: (name: string, property: LinkedStyleAuthorableProperty) => void;
  onRenameLinkedStyle?: (id: string, name: string) => void;
  onRemoveLinkedStyle?: (id: string) => void;
  onAttachLinkedStyleMatches?: (id: string) => void;
  onSelectLinkedStyleContainer?: (location: LinkedStyleContainerLocation) => void;
  resourceSections?: Record<string, boolean>;
  onResourceSectionChange?: (id: string, open: boolean) => void;
}

type TextStylePatch = {
  style?: TextStyleVisualProperties;
  typography?: TextStyleTypographyProperties;
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

export function CustomResourcesWorkspace({
  customLibraryRepository,
  customLibraryPaletteRepository = getDefaultCustomLibraryPaletteRepository(),
  customLibraryFontRepository = getDefaultCustomLibraryFontRepository(),
  presentationColors,
  presentationFonts,
  onAddLibraryPalette,
  onAddLibraryFont,
  onApplyElementStyle,
  onAddPresentationColor,
  onUpdatePresentationColor,
  onRemovePresentationColor,
  onRemovePresentationFont,
  isPresentationFontInUse,
  presentationTextStyles = [],
  presentation,
  onUpdateFundamentalTextStyle = () => undefined,
  onResetFundamentalTextStyle = () => undefined,
  onAddTextStyle = () => undefined,
  onUpdateTextStyle = () => undefined,
  onRemoveTextStyle = () => undefined,
  isTextStyleInUse = () => false,
  onUpdateLinkedStyle = () => undefined,
  onCreateLinkedStyle = () => undefined,
  onRenameLinkedStyle = () => undefined,
  onRemoveLinkedStyle = () => undefined,
  onAttachLinkedStyleMatches = () => undefined,
  onSelectLinkedStyleContainer = () => undefined,
  resourceSections = {},
  onResourceSectionChange = () => undefined,
}: CustomResourcesWorkspaceProps) {
  const { t } = useStudioI18n();
  const [loadState, setLoadState] = useState<PaletteLoadState>({ kind: "loading" });
  const [fontLoadState, setFontLoadState] = useState<FontLoadState>({ kind: "loading" });
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
            <CustomLibraryApplyPicker
              repository={customLibraryRepository}
              onApply={onApplyElementStyle}
              embedded
            />
          </InspectorSection>
          <InspectorSection title={t("customResources.palettes")} open={resourceSections.libraryPalettes} onOpenChange={(open) => onResourceSectionChange("libraryPalettes", open)}>
            <div className={styles.group}>
              <div className={styles.groupHeader}>
                <button type="button" className={styles.resourceAction} onClick={() => setChooserOpen((open) => !open)}>
                  {chooserOpen ? t("customResources.closePaletteChooser") : t("customResources.addPalette")}
                </button>
              </div>
              {chooserOpen ? <MasterPaletteChooser loadState={loadState} onRetry={loadPalettes} onAdd={onAddLibraryPalette} /> : null}
            </div>
          </InspectorSection>
          <InspectorSection title={t("customResources.fonts")} open={resourceSections.libraryFonts} onOpenChange={(open) => onResourceSectionChange("libraryFonts", open)}>
            <div className={styles.group}>
              <div className={styles.groupHeader}>
                <button type="button" className={styles.resourceAction} onClick={() => setFontChooserOpen((open) => !open)}>
                  {fontChooserOpen ? t("customResources.closeFontChooser") : t("customResources.addFont")}
                </button>
              </div>
              {fontFeedback ? <p className={styles.status} role={fontFeedback.kind === "conflict" ? "alert" : undefined}>{fontFeedback.kind === "added" ? t("customResources.fontAdded", { family: fontFeedback.family }) : fontFeedback.kind === "merged" ? t("customResources.fontMerged", { count: fontFeedback.count ?? 0, family: fontFeedback.family }) : fontFeedback.kind === "unchanged" ? t("customResources.fontUnchanged", { family: fontFeedback.family }) : t("customResources.fontConflict", { family: fontFeedback.family })}</p> : null}
              {fontChooserOpen ? <MasterFontChooser loadState={fontLoadState} onRetry={loadFonts} onAdd={addLibraryFont} /> : null}
            </div>
          </InspectorSection>
        </section>

        <section className={styles.scope} aria-labelledby="custom-resources-this-presentation">
          <h2 id="custom-resources-this-presentation" className={styles.sectionTitle}>{t("customResources.thisPresentation")}</h2>
          <div className={styles.group}>
            <InspectorSection title={t("customResources.linkedStyles")} count={presentation?.linkedStyles?.length ?? 0} open={resourceSections.linkedStyles} onOpenChange={(open) => onResourceSectionChange("linkedStyles", open)}>
              <PresentationColorPaletteProvider colors={presentationColors}><LinkedStylesWorkspace presentation={presentation} onUpdate={onUpdateLinkedStyle} onCreate={onCreateLinkedStyle} onRename={onRenameLinkedStyle} onRemove={onRemoveLinkedStyle} onAttach={onAttachLinkedStyleMatches} onSelectContainer={onSelectLinkedStyleContainer} /></PresentationColorPaletteProvider>
            </InspectorSection>
            <PresentationColorPaletteProvider colors={presentationColors}>
            <InspectorSection title={t("customResources.textStyles")} open={resourceSections.textStyles} onOpenChange={(open) => onResourceSectionChange("textStyles", open)}>
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
                onUpdate={onUpdateTextStyle}
                onRemove={onRemoveTextStyle}
                isInUse={isTextStyleInUse}
              />
            </InspectorSection>
            </PresentationColorPaletteProvider>
            <InspectorSection title={t("customResources.presentationPalette")} open={resourceSections.presentationPalette} onOpenChange={(open) => onResourceSectionChange("presentationPalette", open)}>
            {presentationColors.length === 0 ? <p className={styles.status}>{t("customResources.noPresentationColors")}</p> : null}
            <div className={styles.localColorList} data-presentation-palette>
              {presentationColors.map((color) => (
                <LocalPresentationColorRow
                  key={color.id}
                  color={color}
                  onUpdate={onUpdatePresentationColor}
                  onRemove={onRemovePresentationColor}
                />
              ))}
            </div>
            <span className={styles.colorCount}>{t("customResources.colorCount", { count: presentationColors.length })}</span>
            <button type="button" className={styles.resourceAction} onClick={() => setLocalColorAddOpen((open) => !open)}>
              {localColorAddOpen ? t("customResources.closePaletteChooser") : t("customResources.addToPresentation")}
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
    </aside>
  );
}

function LinkedStylesWorkspace({
  presentation, onUpdate: dispatchUpdate, onCreate, onRename, onRemove, onAttach, onSelectContainer,
}: {
  presentation?: Presentation;
  onUpdate: (id: string, patch: { layout?: LinkedContainerStyle["layout"]; style?: LinkedContainerStyle["style"]; typography?: LinkedContainerStyle["typography"]; effect?: LinkedContainerStyle["effect"] }) => void;
  onCreate: (name: string, property: LinkedStyleAuthorableProperty) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  onAttach: (id: string) => void;
  onSelectContainer: (location: LinkedStyleContainerLocation) => void;
}) {
  const { t } = useStudioI18n();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [chooserId, setChooserId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const stylesList = presentation?.linkedStyles ?? [];
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
      const linkedLocations = presentation ? findContainersLinkedToStyle(presentation, linkedStyle.id) : [];
      const matchingLocations = presentation ? findMatchingContainersForLinkedStyle(presentation, linkedStyle.id) : [];
      const editing = editingId === linkedStyle.id;
      const authored = listLinkedStyleAuthoredProperties(linkedStyle);
      const patch = (next: LinkedContainerStyle, property: LinkedStyleProperty) =>
        LINKED_STYLE_PROPERTY_GROUPS.layout.includes(property as never) ? { layout: next.layout } : LINKED_STYLE_PROPERTY_GROUPS.position.includes(property as never) || LINKED_STYLE_PROPERTY_GROUPS.size.includes(property as never) || LINKED_STYLE_PROPERTY_GROUPS.spacing.includes(property as never) ? { layout: next.layout } : LINKED_STYLE_PROPERTY_GROUPS.appearance.includes(property as never) ? { style: next.style } : { effect: next.effect };
      return <div key={linkedStyle.id} data-linked-style-id={linkedStyle.id} className={styles.group}>
        <button type="button" className={styles.resourceAction} aria-expanded={editing} onClick={() => setEditingId(editing ? null : linkedStyle.id)}>{linkedStyle.name} · {linkedLocations.length}</button>
        <span className={styles.status}>{t(linkedLocations.length === 1 ? "customResources.linkedStyleUsedByOne" : "customResources.linkedStyleUsedByMany", { count: linkedLocations.length })}</span>
        <span className={styles.status}>{t(matchingLocations.length === 1 ? "customResources.linkedStyleMatchingOne" : "customResources.linkedStyleMatchingMany", { count: matchingLocations.length })}</span>
        {editing ? <div className={styles.linkedStyleEditor}>
          <LinkedStyleNameField style={linkedStyle} onRename={onRename} />
          {(["layout", "position", "size", "spacing", "appearance", "effects"] as const).map((group) => {
            const properties = group === "layout" ? LINKED_STYLE_PROPERTY_GROUPS.layout : group === "position" ? LINKED_STYLE_PROPERTY_GROUPS.position : group === "size" ? LINKED_STYLE_PROPERTY_GROUPS.size : group === "spacing" ? LINKED_STYLE_PROPERTY_GROUPS.spacing : group === "appearance" ? LINKED_STYLE_PROPERTY_GROUPS.appearance : LINKED_STYLE_PROPERTY_GROUPS.effects;
            const visible = properties.filter((property) => hasLinkedStyleProperty(linkedStyle, property));
            if (visible.length === 0) return null;
            return <div className={styles.linkedStyleSection} data-linked-style-section={group} key={group}><h3 className={styles.linkedStyleSectionTitle}>{t(`inspector.${group}` as "inspector.layout")}</h3>{visible.map((property) => <LinkedStylePropertyRow key={property} style={linkedStyle} property={property} onUpdate={(next) => commit(linkedStyle.id, patch(next, property))} onRemove={() => commit(linkedStyle.id, patch(removeLinkedStyleProperty(linkedStyle, property), property))} canRemove={(listLinkedStyleAuthoredProperties(linkedStyle).length > 1 || linkedStyle.typography !== undefined) && removeLinkedStyleProperty(linkedStyle, property) !== linkedStyle} />)}</div>;
          })}
          {linkedStyle.typography ? <div className={styles.linkedStyleSection} data-linked-style-section="legacy-typography"><h3 className={styles.linkedStyleSectionTitle}>{t("customResources.linkedStyleLegacyTypography")}</h3><p className={styles.status}>{t("customResources.linkedStyleLegacyTypographyDescription")}</p><button type="button" className={styles.resourceAction} disabled={!presentation || !canUpdateLinkedStyle(presentation, linkedStyle.id, { typography: undefined })} onClick={() => commit(linkedStyle.id, { typography: undefined })}>{t("customResources.linkedStyleRemoveLegacyTypography")}</button></div> : null}
          {listAvailableLinkedStyleProperties(linkedStyle).length > 0 ? <div className={styles.linkedStyleSection}><button type="button" className={styles.resourceAction} onClick={() => setChooserId(chooserId === linkedStyle.id ? null : linkedStyle.id)}>+ {t("customResources.addProperty")}</button>{chooserId === linkedStyle.id ? <LinkedStylePropertyChooser properties={listAvailableLinkedStyleProperties(linkedStyle)} onChoose={(property) => { const next = addLinkedStyleProperty(linkedStyle, property); commit(linkedStyle.id, patch(next, property)); setChooserId(null); }} /> : null}</div> : null}
          <div className={styles.linkedStyleSection} data-linked-style-section="reuse"><h3 className={styles.linkedStyleSectionTitle}>{t("customResources.reuse")}</h3>{matchingLocations.length > 0 ? <button type="button" className={styles.resourceAction} onClick={() => onAttach(linkedStyle.id)}>{t("customResources.linkedStyleAttachMany", { count: matchingLocations.length })}</button> : null}{linkedLocations.map((location) => <button key={`${location.slideIndex}:${location.elementId}`} type="button" className={styles.resourceAction} onClick={() => onSelectContainer(location)}>{t("customResources.linkedStyleLocation", { slide: location.slideIndex + 1, id: location.elementId })}</button>)}<span className={styles.status}>{t(linkedLocations.length === 1 ? "customResources.linkedStyleChangesOne" : "customResources.linkedStyleChangesMany", { count: linkedLocations.length })}</span><button type="button" className={styles.resourceAction} disabled={linkedLocations.length > 0} onClick={() => onRemove(linkedStyle.id)}>{t("customResources.linkedStyleRemove")}</button></div>
        </div> : null}
      </div>;
    })}
    {adding ? <div className={styles.linkedStyleEditor}><label className={styles.field}><span>{t("customResources.linkedStyleName")}</span><input value={draftName} onChange={(event) => setDraftName(event.target.value)} /></label><button type="button" className={styles.resourceAction} disabled={!draftName.trim()} onClick={() => setChooserId("new")}>{t("customResources.addFirstProperty")}</button>{chooserId === "new" ? <LinkedStylePropertyChooser properties={listAvailableLinkedStyleProperties({ id: "draft", name: draftName.trim() })} onChoose={create} /> : null}<button type="button" className={styles.resourceAction} onClick={() => { setAdding(false); setDraftName(""); setChooserId(null); }}>{t("customResources.close")}</button></div> : <button type="button" className={styles.resourceAction} onClick={() => setAdding(true)}>+ {t("customResources.addLinkedStyle")}</button>}
  </div>;
}

function linkedStylePropertyLabel(t: ReturnType<typeof useStudioI18n>["t"], property: LinkedStyleProperty): string {
  switch (property) {
    case "layoutMode": return t("inspector.layoutMode"); case "direction": return t("inspector.direction"); case "gap": return t("inspector.gap"); case "distribution": return t("inspector.distribution"); case "horizontalAlign": return t("inspector.horizontal"); case "verticalAlign": return t("inspector.vertical"); case "overflow": return t("inspector.overflow"); case "fit": return t("inspector.childrenFit");
    case "position": return t("inspector.position"); case "top": return t("inspector.top"); case "right": return t("inspector.right"); case "bottom": return t("inspector.bottom"); case "left": return t("inspector.left"); case "width": return t("inspector.width"); case "height": return t("inspector.height"); case "preserveSize": return t("inspector.preserveSize");
    case "padding": case "paddingTop": case "paddingRight": case "paddingBottom": case "paddingLeft": return t("inspector.padding"); case "margin": case "marginTop": case "marginRight": case "marginBottom": case "marginLeft": return t("inspector.margin");
    case "color": return t("inspector.color"); case "backgroundColor": return t("inspector.background"); case "gradient": return t("inspector.gradient"); case "pattern": return t("inspector.pattern"); case "border": return t("inspector.border"); case "borderRadius": return t("inspector.roundedCorners"); case "opacity": return t("inspector.opacity"); case "shadow": return t("inspector.shadow");
  }
}

function LinkedStylePropertyChooser({ properties, onChoose }: { properties: readonly LinkedStyleAuthorableProperty[]; onChoose: (property: LinkedStyleAuthorableProperty) => void }) {
  const { t } = useStudioI18n();
  return <div className={styles.linkedStylePropertyChooser}>{properties.map((property) => <button type="button" className={styles.resourceAction} key={property} onClick={() => onChoose(property)}>{linkedStylePropertyLabel(t, property)}</button>)}</div>;
}

function LinkedStylePropertyRow({ style, property, onUpdate, onRemove, canRemove }: { style: LinkedContainerStyle; property: LinkedStyleProperty; onUpdate: (style: LinkedContainerStyle) => void; onRemove: () => void; canRemove: boolean }) {
  const { t } = useStudioI18n();
  const numeric = (value: number | undefined, update: (next: number | undefined) => LinkedContainerStyle) => <input type="number" value={value ?? ""} onChange={(event) => onUpdate(update(event.target.value === "" ? undefined : Number(event.target.value)))} />;
  const layoutUpdate = (update: (layout: NonNullable<LinkedContainerStyle["layout"]>) => NonNullable<LinkedContainerStyle["layout"]>) => ({ ...style, layout: update({ ...style.layout, children: style.layout?.children === undefined ? undefined : { ...style.layout.children } }) });
  const childrenUpdate = (update: (children: NonNullable<NonNullable<LinkedContainerStyle["layout"]>["children"]>) => NonNullable<NonNullable<LinkedContainerStyle["layout"]>["children"]>) => layoutUpdate((layout) => ({ ...layout, children: update({ ...(layout.children ?? {}) }) }));
  const numberLayout = (field: "padding" | "paddingTop" | "paddingRight" | "paddingBottom" | "paddingLeft" | "margin" | "marginTop" | "marginRight" | "marginBottom" | "marginLeft" | "top" | "right" | "bottom" | "left", value: number | undefined) => layoutUpdate((layout) => ({ ...layout, [field]: value }));
  const numericLayoutValue = (field: "padding" | "paddingTop" | "paddingRight" | "paddingBottom" | "paddingLeft" | "margin" | "marginTop" | "marginRight" | "marginBottom" | "marginLeft" | "top" | "right" | "bottom" | "left") => typeof style.layout?.[field] === "number" ? style.layout[field] : undefined;
  const commitLayout = (update: (layout: NonNullable<LinkedContainerStyle["layout"]>) => NonNullable<LinkedContainerStyle["layout"]>) => onUpdate(layoutUpdate(update));
  const commitChildren = (update: (children: NonNullable<NonNullable<LinkedContainerStyle["layout"]>["children"]>) => NonNullable<NonNullable<LinkedContainerStyle["layout"]>["children"]>) => onUpdate(childrenUpdate(update));
  let control: ReactNode;
  switch (property) {
    case "layoutMode": control = <select value={style.layout?.children?.mode ?? "flow"} onChange={(event) => commitChildren((children) => ({ ...children, mode: event.target.value as "flow" | "stack" }))}><option value="flow">Flow</option><option value="stack">Stack</option></select>; break;
    case "direction": control = <select value={style.layout?.children?.direction ?? "column"} onChange={(event) => commitChildren((children) => ({ ...children, direction: event.target.value as "row" | "column" }))}><option value="column">Column</option><option value="row">Row</option></select>; break;
    case "gap": control = numeric(typeof style.layout?.children?.gap === "number" ? style.layout.children.gap : undefined, (next) => { const updated = addLinkedStyleProperty(removeLinkedStyleProperty(style, property), property); updated.layout = { ...updated.layout, children: { ...updated.layout?.children, gap: next } }; return updated; }); break;
    case "distribution": control = <select value={style.layout?.children?.distribution ?? "packed"} onChange={(event) => commitChildren((children) => ({ ...children, distribution: event.target.value as "packed" | "space-between" | "space-around" | "space-evenly" }))}><option value="packed">Packed</option><option value="space-between">Space between</option><option value="space-around">Space around</option><option value="space-evenly">Space evenly</option></select>; break;
    case "horizontalAlign":
    case "verticalAlign": control = <select value={style.layout?.children?.[property] ?? "start"} onChange={(event) => commitChildren((children) => ({ ...children, [property]: event.target.value as "start" | "center" | "end" | "stretch" }))}><option value="start">Start</option><option value="center">Center</option><option value="end">End</option><option value="stretch">Stretch</option></select>; break;
    case "overflow": control = <select value={style.layout?.overflow ?? "visible"} onChange={(event) => commitLayout((layout) => ({ ...layout, overflow: event.target.value as "visible" | "hidden" | "auto" }))}><option value="visible">Visible</option><option value="hidden">Hidden</option><option value="auto">Auto</option></select>; break;
    case "fit": control = <select value={style.layout?.children?.fit?.mode ?? "contain"} onChange={(event) => commitChildren((children) => children.fit === undefined ? children : ({ ...children, fit: { ...children.fit, mode: event.target.value as "contain" | "cover" | "fill" } }))}><option value="contain">Contain</option><option value="cover">Cover</option><option value="fill">Fill</option></select>; break;
    case "position": control = <select value={style.layout?.position ?? "absolute"} onChange={(event) => commitLayout((layout) => ({ ...layout, position: event.target.value as "absolute" }))}><option value="absolute">Absolute</option></select>; break;
    case "top": case "right": case "bottom": case "left": control = numeric(numericLayoutValue(property), (next) => numberLayout(property, next)); break;
    case "width": case "height": control = <div className={styles.unitInput}><input type="number" min="0" max="100" value={typeof style.layout?.[property] === "string" && style.layout[property].endsWith("%") ? Number(style.layout[property].slice(0, -1)) : ""} onChange={(event) => commitLayout((layout) => ({ ...layout, [property]: event.target.value === "" ? undefined : `${Number(event.target.value)}%` }))} /><span>%</span></div>; break;
    case "preserveSize": control = <input type="checkbox" checked={style.layout?.flexShrink === 0} onChange={(event) => commitLayout((layout) => ({ ...layout, flexShrink: event.target.checked ? 0 : undefined }))} />; break;
    case "padding": case "paddingTop": case "paddingRight": case "paddingBottom": case "paddingLeft": case "margin": case "marginTop": case "marginRight": case "marginBottom": case "marginLeft": control = numeric(numericLayoutValue(property), (next) => numberLayout(property, next)); break;
    case "color": control = <ColorControl id={`linked-style-${style.id}-color`} name={linkedStylePropertyLabel(t, property)} value={style.style?.color} onChange={(color) => onUpdate({ ...style, style: { ...style.style, color } })} />; break;
    case "backgroundColor": control = <ColorControl id={`linked-style-${style.id}-background-color`} name={linkedStylePropertyLabel(t, property)} value={style.style?.background?.color} onChange={(color) => onUpdate({ ...style, style: { ...style.style, background: { ...style.style?.background, color } } })} />; break;
    case "gradient": control = <ElementGradientControl allowNone={false} gradient={style.style?.background?.gradient} controlPrefix={`linked-style-${style.id}`} onChange={(gradient) => onUpdate({ ...style, style: { ...style.style, background: { ...style.style?.background, gradient } } })} />; break;
    case "pattern": control = <ContainerBackgroundPatternControl allowNone={false} element={{ id: style.id, type: "container", hidden: false, children: [], style: style.style }} controlPrefix={`linked-style-${style.id}`} onChange={(pattern, color) => onUpdate({ ...style, style: { ...style.style, background: { ...style.style?.background, pattern, ...(color === undefined ? {} : { color }) } } })} />; break;
    case "border": control = <ElementBorderControl allowNone={false} border={style.style?.border} controlPrefix={`linked-style-${style.id}`} onChange={(border) => onUpdate({ ...style, style: { ...style.style, border } })} />; break;
    case "borderRadius": control = <LinkedStyleLengthField id={`linked-style-${style.id}-border-radius`} label={t("inspector.roundedCorners")} value={style.style?.borderRadius} onChange={(value) => onUpdate({ ...style, style: { ...style.style, borderRadius: value } })} />; break;
    case "opacity": control = <input type="number" min="0" max="100" value={style.effect?.opacity === undefined ? "" : style.effect.opacity * 100} onChange={(event) => onUpdate({ ...style, effect: { ...style.effect, opacity: event.target.value === "" ? undefined : Number(event.target.value) / 100 } })} />; break;
    case "shadow": control = <ContainerEffectsSection embedded allowNone={false} showSourceMeta={false} element={{ id: style.id, type: "container", hidden: false, children: [], effect: style.effect }} onUpdate={(update) => { const next = update({ id: style.id, type: "container", hidden: false, children: [], effect: style.effect }); if (next.type === "container") onUpdate({ ...style, effect: next.effect }); }} />; break;
  }
  const displayLabel = linkedStylePropertyLabel(t, property);
  return <div className={styles.linkedStylePropertyRow}><label className={styles.field}><span>{displayLabel}</span>{control}</label><button type="button" className={styles.removeColor} disabled={!canRemove} onClick={onRemove} aria-label={t("customResources.removeProperty", { property: displayLabel })}>×</button></div>;
}

function LinkedStyleNameField({ style, onRename }: { style: LinkedContainerStyle; onRename: (id: string, name: string) => void }) {
  const { t } = useStudioI18n();
  const [draft, setDraft] = useState(style.name);
  useEffect(() => setDraft(style.name), [style.id, style.name]);
  const commit = () => { const next = draft.trim(); if (next) onRename(style.id, next); else setDraft(style.name); };
  return <label className={styles.field}><span>{t("customResources.linkedStyleName")}</span><input value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commit(); event.currentTarget.blur(); } if (event.key === "Escape") { setDraft(style.name); event.currentTarget.blur(); } }} /></label>;
}

function LinkedStyleLengthField({ id, label, value, onChange }: { id: string; label: string; value: Length | undefined; onChange: (value: Length | undefined) => void }) {
  const parsed = value === undefined ? undefined : parseAuthoringLength(value);
  const [unit, setUnit] = useState<AuthoringLengthUnit>(parsed?.unit === "rem" ? "rem" : "px");
  useEffect(() => setUnit(parsed?.unit === "rem" ? "rem" : "px"), [parsed?.unit]);
  const numericValue = value === undefined ? "" : (convertAuthoringLength(value, unit) ?? "");

  return <label className={styles.field}>
    <span>{label}</span>
    <div className={styles.unitInput}>
      <input id={id} type="number" step="any" value={numericValue} onChange={(event) => {
        if (event.target.value === "") {
          onChange(undefined);
          return;
        }
        const next = event.target.valueAsNumber;
        if (Number.isFinite(next)) onChange(serializeAuthoringLength(next, unit));
      }} />
      <select aria-label={`${label} unit`} value={unit} onChange={(event) => {
        const nextUnit = event.target.value as AuthoringLengthUnit;
        setUnit(nextUnit);
        if (value !== undefined) {
          const converted = convertAuthoringLength(value, nextUnit);
          if (converted !== undefined) onChange(serializeAuthoringLength(converted, nextUnit));
        }
      }}>
        <option value="px">px</option>
        <option value="rem">rem</option>
      </select>
    </div>
  </label>;
}

function TextStylesWorkspace({
  presentationStyles, presentation, presentationFonts, editingStyleId, onEdit, onUpdateFundamental, onResetFundamental,
  onAdd, adding, onCancelAdd, onCreate, onUpdate, onRemove, isInUse,
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
  onUpdate: (id: string, patch: TextStylePatch & { name?: string; role?: TextStyleRole }) => void;
  onRemove: (id: string) => void;
  isInUse: (id: string) => boolean;
}) {
  const { t } = useStudioI18n();
  const projectedStyles = listPresentationTextStyles({ textStyles: presentationStyles });
  const byId = new Map(projectedStyles.filter((item) => item.style !== undefined).map((item) => [item.id, item.style]));
  const customStyles = projectedStyles.filter((item) => !FUNDAMENTAL_TEXT_STYLE_IDS.some((fundamentalId) => fundamentalId === item.id) && item.style !== undefined).map((item) => item.style as TextStyle);
  return <section
    className={styles.textStylesSection}
    data-presentation-text-styles
    aria-labelledby="presentation-text-styles-title"
  >
    <h3 id="presentation-text-styles-title" className={styles.groupTitle}>{t("customResources.textStyles")}</h3>
    <div className={styles.typographyStyleList}>
      {FUNDAMENTAL_TEXT_STYLE_IDS.map((id) => {
        const style = byId.get(id);
        return <TextStyleRow key={id} id={id} label={t(`customResources.role.${id}`)} status={style ? t("customResources.customized") : t("customResources.builtIn")} editing={editingStyleId === id} style={style} presentation={presentation} fonts={presentationFonts} onEdit={onEdit} onUpdate={(patch) => onUpdateFundamental(id, patch)} onReset={() => onResetFundamental(id)} />;
      })}
      {customStyles.map((style) => <TextStyleRow key={style.id} id={style.id} label={"name" in style ? style.name : style.id} status={isInUse(style.id) ? t("customResources.inUse") : ("role" in style ? t(`customResources.role.${style.role}`) : "")} editing={editingStyleId === style.id} style={style} presentation={presentation} fonts={presentationFonts} onEdit={onEdit} onUpdate={(patch) => onUpdate(style.id, patch)} onRemove={() => onRemove(style.id)} removeDisabled={isInUse(style.id)} />)}
    </div>
    {adding ? <NewTextStyleForm fonts={presentationFonts} onCancel={onCancelAdd} onCreate={onCreate} /> : <button type="button" className={styles.resourceAction} onClick={onAdd}>{t("customResources.addStyle")}</button>}
  </section>;
}

function TextStyleRow({ id, label, status, editing, style, presentation, fonts, onEdit, onUpdate, onReset, onRemove, removeDisabled }: {
  id: string; label: string; status: string; editing: boolean; style?: TextStyle; presentation?: Presentation; fonts: readonly FontResource[];
  onEdit: (id: string) => void; onUpdate?: (value: TextStylePatch & { name?: string; role?: TextStyleRole }) => void;
  onReset?: () => void; onRemove?: () => void; removeDisabled?: boolean;
}) {
  const { t } = useStudioI18n();
  const [pendingFontFamily, setPendingFontFamily] = useState(false);
  const [pendingColor, setPendingColor] = useState(false);
  const [pendingDecorationColor, setPendingDecorationColor] = useState(false);
  const [pendingStroke, setPendingStroke] = useState<{ width: number } | undefined>();
  const fundamental = FUNDAMENTAL_TEXT_STYLE_IDS.some((fundamentalId) => fundamentalId === id);
  const role = fundamental ? id as TextStyleRole : (style && "role" in style ? style.role : "body");
  const typography = style?.typography;
  const visual = style?.style;
  const previewText: TextElement = presentation
    ? { id: `text-style-preview-${id}`, type: "text", hidden: false, variant: id, content: "Aa" }
    : { id: `text-style-preview-${id}`, type: "text", hidden: false, variant: role, content: "Aa", typography: { ...TEXT_VARIANT_TYPOGRAPHY_DEFAULTS[role], ...typography } };
  const editorId = `text-style-${id}-editor`;
  const authoredProperties = TEXT_STYLE_TYPOGRAPHY_PROPERTY_NAMES.filter((property) => typography?.[property] !== undefined);
  const appearanceProperties = [
    ...(visual?.color !== undefined || pendingColor ? ["color" as const] : []),
    ...(typography?.textDecorationColor !== undefined || pendingDecorationColor ? ["textDecorationColor" as const] : []),
    ...(typography?.textStroke !== undefined || pendingStroke !== undefined ? ["textStroke" as const] : []),
  ];
  const availableProperties = TEXT_STYLE_TYPOGRAPHY_PROPERTY_NAMES.filter((property) => !authoredProperties.includes(property) && !(property === "fontFamily" && pendingFontFamily));
  const availableAppearance = [
    ...(visual?.color === undefined && !pendingColor ? ["color" as const] : []),
    ...(typography?.textDecorationColor === undefined && !pendingDecorationColor ? ["textDecorationColor" as const] : []),
    ...(typography?.textStroke === undefined && pendingStroke === undefined ? ["textStroke" as const] : []),
  ];
  const addProperty = (property: CoreTypographyProperty): void => {
    if (property === "fontFamily") {
      setPendingFontFamily(true);
      return;
    }
    const baseline = resolveThemeTextTypographyBaseline(role);
    const value = baseline[property];
    if (value === undefined) return;
    const nextTypography = { ...(typography ?? {}), [property]: value };
    onUpdate?.({ typography: normalizeTextStyleTypographyProperties(nextTypography) });
  };
  const updateTypography = (update: (current: TextStyleTypographyProperties | undefined) => TextStyleTypographyProperties): void => {
    const nextTypography = normalizeTextStyleTypographyProperties(update(typography));
    onUpdate?.({ typography: nextTypography });
  };
  const updateStyle = (update: (current: TextStyleVisualProperties | undefined) => TextStyleVisualProperties): void => {
    onUpdate?.({ style: normalizeTextStyleVisualProperties(update(visual)) });
  };
  const removeAppearance = (property: "color" | "textDecorationColor" | "textStroke"): void => {
    if (property === "color") { if (pendingColor && visual?.color === undefined) setPendingColor(false); else updateStyle((current) => ({ ...(current ?? {}), color: undefined })); }
    else if (property === "textDecorationColor") { if (pendingDecorationColor && typography?.textDecorationColor === undefined) setPendingDecorationColor(false); else updateTypography((current) => ({ ...(current ?? {}), textDecorationColor: undefined })); }
    else if (pendingStroke && typography?.textStroke === undefined) setPendingStroke(undefined);
    else updateTypography((current) => ({ ...(current ?? {}), textStroke: undefined }));
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
    updateTypography((current) => ({ ...(current ?? {}), [property]: undefined }));
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
        <span className={styles.typographyStyleDetails}>
          <strong>{label}</strong>
          <span className={styles.typographyStyleStatus}>{status}</span>
        </span>
        <span className={styles.typographyStyleChevron} aria-hidden="true">{editing ? "▾" : "▸"}</span>
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
      {!fundamental && style && "name" in style ? <CustomTextStyleNameInput canonicalName={style.name} onCommit={(name) => onUpdate?.({ name })} /> : null}
      {!fundamental && <label className={styles.localColorName}><span>{t("customResources.role")}</span><select value={role} onChange={(event) => onUpdate?.({ role: event.target.value as TextStyleRole })}>{FUNDAMENTAL_TEXT_STYLE_IDS.map((roleId) => <option key={roleId} value={roleId}>{t(`customResources.role.${roleId}`)}</option>)}</select></label>}
      {authoredProperties.length === 0 && appearanceProperties.length === 0 && !pendingFontFamily ? <p className={styles.status}>{t("customResources.noTypographyProperties")}</p> : null}
      <div className={styles.typographyStyleProperties}>
        {authoredProperties.map((property) => <div className={styles.typographyStyleProperty} data-text-style-property={property} key={property}>
          <div className={styles.typographyStylePropertyHeader}>
            <span>{t(propertyLabelKey[property])}</span>
            <button type="button" className={styles.typographyStyleRemove} aria-label={t("customResources.removeProperty", { property: t(propertyLabelKey[property]) })} onClick={() => removeProperty(property)}>×</button>
          </div>
          <ElementTypographyFields typography={typography} effectiveDefaults={TEXT_VARIANT_TYPOGRAPHY_DEFAULTS[role]} fontResources={fonts} visibleProperties={[property]} controlPrefix={`text-style-${id}`} onUpdateTypography={(update) => updateTypography(update)} />
        </div>)}
        {pendingFontFamily ? <div className={styles.typographyStyleProperty} data-text-style-property="fontFamily">
          <div className={styles.typographyStylePropertyHeader}>
            <span>{t(propertyLabelKey.fontFamily)}</span>
            <button type="button" className={styles.typographyStyleRemove} aria-label={t("customResources.removeProperty", { property: t(propertyLabelKey.fontFamily) })} onClick={() => removeProperty("fontFamily")}>×</button>
          </div>
          <ElementTypographyFields typography={typography} effectiveDefaults={TEXT_VARIANT_TYPOGRAPHY_DEFAULTS[role]} fontResources={fonts} visibleProperties={["fontFamily"]} controlPrefix={`text-style-${id}`} onUpdateTypography={(update) => { const next = normalizeTextStyleTypographyProperties(update(typography)); if (next.fontFamily !== undefined) setPendingFontFamily(false); updateTypography(() => next); }} />
        </div> : null}
        {appearanceProperties.map((property) => <div className={styles.typographyStyleProperty} data-text-style-property={property} key={property}>
          <div className={styles.typographyStylePropertyHeader}><span>{t(appearanceLabelKey[property])}</span><button type="button" className={styles.typographyStyleRemove} aria-label={t("customResources.removeProperty", { property: t(appearanceLabelKey[property]) })} onClick={() => removeAppearance(property)}>×</button></div>
          {property === "color" ? <ColorControl id={`text-style-${id}-color`} name={t("inspector.color")} value={visual?.color} onChange={(color) => commitColor("color", color)} /> : null}
          {property === "textDecorationColor" ? <ColorControl id={`text-style-${id}-decoration-color`} name={t("inspector.topics.decorationColor")} value={typography?.textDecorationColor} onChange={(color) => commitColor("textDecorationColor", color)} /> : null}
          {property === "textStroke" ? <TextStyleStrokeFields id={id} stroke={typography?.textStroke} pendingWidth={pendingStroke?.width} onWidthChange={(width) => { if (typography?.textStroke) updateTypography((current) => ({ ...(current ?? {}), textStroke: { width, color: current?.textStroke?.color ?? typography.textStroke!.color } })); else setPendingStroke({ width }); }} onColorChange={commitStrokeColor} /> : null}
        </div>)}
      </div>
      {availableProperties.length > 0 || availableAppearance.length > 0 ? <PropertyChooser properties={availableProperties} appearanceProperties={availableAppearance} fontsAvailable={fonts.length > 0} onAdd={addProperty} onAddAppearance={addAppearance} /> : null}
      {fundamental && style && onReset ? <div className={styles.typographyStyleActions}><button type="button" className={styles.resourceAction} onClick={onReset}>{t("customResources.reset")}</button></div> : null}
      {!fundamental && onRemove ? <div className={styles.typographyStyleActions}><button type="button" className={styles.resourceAction} disabled={removeDisabled} onClick={onRemove}>{t("customResources.remove")}</button></div> : null}
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

function PropertyChooser({ properties, appearanceProperties, fontsAvailable, onAdd, onAddAppearance }: { properties: readonly CoreTypographyProperty[]; appearanceProperties: readonly (keyof typeof appearanceLabelKey)[]; fontsAvailable: boolean; onAdd: (property: CoreTypographyProperty) => void; onAddAppearance: (property: keyof typeof appearanceLabelKey) => void }) {
  const { t } = useStudioI18n();
  const [open, setOpen] = useState(false);
  return <div className={styles.typographyStyleChooser}>
    <button type="button" className={styles.resourceAction} aria-expanded={open} onClick={() => setOpen((value) => !value)}>{t("customResources.addProperty")}</button>
    {open ? <div className={styles.typographyStylePropertyOptions}>
      {properties.map((property) => <button key={property} type="button" className={styles.typographyStylePropertyOption} disabled={property === "fontFamily" && !fontsAvailable} title={property === "fontFamily" && !fontsAvailable ? t("customResources.addFontFirst") : undefined} onClick={() => { onAdd(property); setOpen(false); }}>{t(propertyLabelKey[property])}{property === "fontFamily" && !fontsAvailable ? ` — ${t("customResources.addFontFirst")}` : ""}</button>)}
      {appearanceProperties.length > 0 ? <span className={styles.typographyStylePropertyOption}>Appearance</span> : null}
      {appearanceProperties.map((property) => <button key={property} type="button" className={styles.typographyStylePropertyOption} onClick={() => { onAddAppearance(property); setOpen(false); }}>{t(appearanceLabelKey[property])}</button>)}
    </div> : null}
  </div>;
}

function TextStyleStrokeFields({ id, stroke, pendingWidth, onWidthChange, onColorChange }: { id: string; stroke: TextStroke | undefined; pendingWidth: number | undefined; onWidthChange: (width: number) => void; onColorChange: (color: ColorValue) => void }) {
  const { t } = useStudioI18n();
  const width = readAbsoluteNumber(stroke?.width ?? pendingWidth);
  return <div className={styles.fieldGrid}>
    <label className={styles.field}><span>{t("inspector.textStrokeWidth")}</span><div className={styles.unitInput}><input id={`text-style-${id}-stroke-width`} type="number" min="0" value={width} onChange={(event) => onWidthChange(Math.max(0, Number(event.target.value) || 0))} /><span>px</span></div></label>
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
    onUpdate(color.id, { name: nextName, value: color.value });
  };

  return (
    <div className={styles.localColorItem} data-presentation-color-row>
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
        <LiteralColorInput id={`custom-resources-literal-color-${color.id}`} name={t("customResources.color")} value={color.value} onChange={(value) => onUpdate(color.id, { name: color.name, value })} />
        <button type="button" className={styles.removeColor} aria-label={t("customResources.removePresentationColor", { name: color.name })} onClick={() => onRemove(color.id)}>×</button>
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
  if (loadState.kind === "error") return <div className={styles.statusGroup}><p className={styles.status} role="alert">{t("customResources.loadFailed")}</p><button type="button" className={styles.retryButton} onClick={onRetry}>{t("customResources.retry")}</button></div>;
  if (loadState.records.length === 0) return <p className={styles.status}>{t("customResources.noLibraryPalettes")}</p>;

  return (
    <div className={styles.masterPaletteList}>
      {loadState.records.map(({ id, palette }) => (
        <div key={id} className={styles.masterPaletteRow} data-custom-resource-palette={id}>
          <strong>{palette.name}</strong>
          <ColorSwatches colors={palette.colors} />
          <span className={styles.masterPaletteCount}>{t("customResources.colorCount", { count: palette.colors.length })}</span>
          <button type="button" className={styles.resourceAction} aria-label={t("customResources.addMasterPalette", { name: palette.name })} onClick={() => onAdd(palette)}>+</button>
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
  if (loadState.kind === "error") return <div className={styles.statusGroup}><p className={styles.status} role="alert">{t("customResources.fontLoadFailed")}</p><button type="button" className={styles.retryButton} onClick={onRetry}>{t("customResources.retry")}</button></div>;
  if (loadState.records.length === 0) return <p className={styles.status}>{t("customResources.noLibraryFonts")}</p>;

  return <div className={styles.masterFontList}>
    {loadState.records.map(({ id, font }) => <div key={id} className={styles.masterFontRow} data-custom-resource-font={id}>
      <strong>{font.family}</strong>
      <span className={styles.masterPaletteCount}>{t(font.faces.length === 1 ? "customResources.faceCountOne" : "customResources.faceCountMany", { count: font.faces.length })}</span>
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

  return <div className={styles.localFontRow} data-presentation-font-row>
    <div className={styles.localFontDetails}>
      <strong>{font.family}</strong>
      <span className={styles.masterPaletteCount}>{t(faces.length === 1 ? "customResources.faceCountOne" : "customResources.faceCountMany", { count: faces.length })}{inUse ? ` · ${t("customResources.inUse")}` : ""}</span>
    </div>
    <button type="button" className={styles.removeColor} aria-label={t("customResources.removePresentationFont", { family: font.family })} disabled={inUse} onClick={() => onRemove(font.id)}>×</button>
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
