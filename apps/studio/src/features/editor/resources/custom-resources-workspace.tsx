"use client";

import { getFontResourceFaces, FUNDAMENTAL_TEXT_STYLE_IDS, TEXT_STYLE_TYPOGRAPHY_PROPERTY_NAMES, type Color, type ColorValue, type FontResource, type Presentation, type PresentationPaletteColor, type TextElement, type TextStyle, type TextStyleTypographyProperties, type TextStyleVisualProperties, type TextStyleRole, type TextStroke } from "@powershow/document-schema";
import { paletteColorCssVariableName, renderElement, renderFontResources } from "@powershow/renderer";
import { resolveThemeTextTypographyBaseline, TEXT_VARIANT_TYPOGRAPHY_DEFAULTS } from "@powershow/theme/element-style-defaults";
import { useCallback, useEffect, useRef, useState } from "react";

import { LiteralColorInput } from "@/features/editor/color/literal-color-input";
import { InspectorSection } from "@/features/editor/inspector/inspector-section";
import { useStudioI18n } from "@/features/i18n/studio-i18n-context";
import type { CustomLibraryPaletteDraft } from "@/features/custom-library/custom-library-palette";
import type {
  CustomLibraryPaletteRecord,
  CustomLibraryPaletteRepository,
} from "@/features/custom-library/custom-library-palette-repository";
import type { CustomLibraryPaletteAddOutcome } from "@/features/custom-library/custom-library-palette-add-picker";
import type { CustomLibraryFontDraft, CustomLibraryFontRecord } from "@/features/custom-library/custom-library-font";
import type { CustomLibraryFontRepository } from "@/features/custom-library/custom-library-font-repository";
import { getDefaultCustomLibraryPaletteRepository } from "@/features/persistence/custom-library-palette-repository-instance";
import { getDefaultCustomLibraryFontRepository } from "@/features/persistence/custom-library-font-repository-instance";
import { ElementTypographyFields, type CoreTypographyProperty } from "../inspector/sections/element-typography-control";
import { ColorControl } from "../inspector/sections/color-control";
import { PresentationColorPaletteProvider } from "../inspector/sections/presentation-color-palette";
import { listPresentationTextStyles, normalizeTextStyleTypographyProperties, normalizeTextStyleVisualProperties } from "../text-style-helpers";

import styles from "./custom-resources-workspace.module.css";

interface CustomResourcesWorkspaceProps {
  customLibraryPaletteRepository?: CustomLibraryPaletteRepository;
  customLibraryFontRepository?: CustomLibraryFontRepository;
  presentationColors: readonly PresentationPaletteColor[];
  presentationFonts: readonly FontResource[];
  onAddLibraryPalette: (palette: CustomLibraryPaletteDraft) => CustomLibraryPaletteAddOutcome;
  onAddLibraryFont: (font: CustomLibraryFontDraft) => CustomLibraryFontAddOutcome;
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
  customLibraryPaletteRepository = getDefaultCustomLibraryPaletteRepository(),
  customLibraryFontRepository = getDefaultCustomLibraryFontRepository(),
  presentationColors,
  presentationFonts,
  onAddLibraryPalette,
  onAddLibraryFont,
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
          <InspectorSection title={t("customResources.palettes")} defaultOpen>
            <div className={styles.group}>
              <div className={styles.groupHeader}>
                <button type="button" className={styles.resourceAction} onClick={() => setChooserOpen((open) => !open)}>
                  {chooserOpen ? t("customResources.closePaletteChooser") : t("customResources.addPalette")}
                </button>
              </div>
              {chooserOpen ? <MasterPaletteChooser loadState={loadState} onRetry={loadPalettes} onAdd={onAddLibraryPalette} /> : null}
            </div>
          </InspectorSection>
          <InspectorSection title={t("customResources.fonts")} defaultOpen>
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
            <h3 className={styles.groupTitle}>{t("customResources.palettes")}</h3>
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
            <h3 className={styles.groupTitle}>{t("customResources.fonts")}</h3>
            {presentationFonts.length === 0 ? <p className={styles.status}>{t("customResources.noPresentationFonts")}</p> : null}
            <div className={styles.localFontList} data-presentation-fonts>
              {presentationFonts.map((font) => <LocalPresentationFontRow key={font.id} font={font} inUse={isPresentationFontInUse(font.family)} onRemove={onRemovePresentationFont} />)}
            </div>
            <span className={styles.colorCount}>{t(presentationFonts.length === 1 ? "customResources.fontCountOne" : "customResources.fontCountMany", { count: presentationFonts.length })}</span>
            <PresentationColorPaletteProvider colors={presentationColors}>
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
            </PresentationColorPaletteProvider>
          </div>
        </section>
      </div>
    </aside>
  );
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
  const previewText: TextElement = {
    id: `text-style-preview-${id}`,
    type: "text",
    hidden: false,
    variant: presentation ? id : role,
    content: "Aa",
    ...(presentation ? { typography } : { typography: { ...TEXT_VARIANT_TYPOGRAPHY_DEFAULTS[role], ...typography } }),
  };
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
      {presentation && renderFontResources(presentation.resources?.fonts) ? <style data-powershow-font-resources>{renderFontResources(presentation.resources?.fonts)}</style> : null}
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
  const width = stroke?.width ?? pendingWidth ?? 1;
  return <div className={styles.fieldGrid}>
    <label className={styles.field}><span>{t("inspector.textStrokeWidth")}</span><div className={styles.unitInput}><input id={`text-style-${id}-stroke-width`} type="number" min="0" value={typeof width === "number" ? width : 1} onChange={(event) => onWidthChange(Math.max(0, Number(event.target.value) || 0))} /><span>px</span></div></label>
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
