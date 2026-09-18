import type { GalleryElement } from "@powershow/document-schema";
import { useStudioI18n } from "@/features/i18n/studio-i18n-context";
import styles from "../editor-workspace.module.css";
import { InspectorSection } from "./inspector-section";
import type { TypedInspectorProps, UpdateSurfaceStyle } from "./inspector-types";
import { CanonicalSurfaceAppearanceSection } from "./sections/canonical-surface-appearance-section";
import { CanonicalElementEffectsSection } from "./sections/canonical-element-effects-section";
import { ElementSpacingSection } from "./sections/element-spacing-section";
import { CanonicalElementSizeSection } from "./sections/canonical-element-size-section";
import { ImageCropControl, ImageFocalPointControl } from "./sections/image-crop-control";
import { getGalleryItemDisplayName } from "../gallery-item-display-name";
import { useAuthoringHistory } from "../authoring-history-context";

type GalleryFit = GalleryElement["fit"];
type GalleryItem = GalleryElement["items"][number];
const GALLERY_ITEM_DEFAULT: GalleryItem = { src: "/powershow-demo.svg", alt: "" };

interface GalleryInspectorProps extends TypedInspectorProps<GalleryElement> {
  selectedItemIndex?: number | null;
  onSelectedItemIndexChange?: (index: number | null) => void;
  focalEditing?: boolean;
  onFocalEditingChange?: (editing: boolean) => void;
  cropEditing?: boolean;
  onCropEditingChange?: (editing: boolean) => void;
}

export function GalleryInspector({ element, onUpdate, selectedItemIndex = element.items.length > 0 ? 0 : null, onSelectedItemIndexChange = () => undefined, focalEditing = false, onFocalEditingChange = () => undefined, cropEditing = false, onCropEditingChange = () => undefined }: GalleryInspectorProps) {
  const { t } = useStudioI18n();
  const authoringHistory = useAuthoringHistory();
  const textEditMeta = { kind: "text.edit", labelKey: "history.text.edit" } as const;
  const runDiscrete = (setting: string, callback: () => void): void => {
    const meta = { kind: "element.setting", labelKey: "history.element.setting", labelParams: { setting } } as const;
    if (authoringHistory) authoringHistory.discrete(meta, callback);
    else callback();
  };
  const selectedItem = selectedItemIndex === null || selectedItemIndex === undefined ? undefined : element.items[selectedItemIndex];
  const updateGallery = (update: (gallery: GalleryElement) => GalleryElement) => onUpdate((current) => current.type === "gallery" ? update(current) : current);
  const updateStyle: UpdateSurfaceStyle = (update) => updateGallery((gallery) => ({ ...gallery, style: update(gallery.style) }));
  const updateSelectedItem = (update: (item: GalleryItem) => GalleryItem) => {
    if (selectedItemIndex === null || selectedItemIndex === undefined || !selectedItem) return;
    updateGallery((gallery) => ({ ...gallery, items: gallery.items.map((item, index) => index === selectedItemIndex ? update(item) : item) }));
  };
  const updateSelectedItemText = (field: "src" | "alt", value: string): void => {
    if (selectedItemIndex === null || selectedItemIndex === undefined || !selectedItem) return;
    if (value === selectedItem[field]) return;

    const historyKey = `text:gallery-${element.id}-item-${selectedItemIndex}-${field}`;
    const update = () => updateSelectedItem((item) => field === "src"
      ? { ...item, src: value }
      : { ...item, alt: value });

    if (!authoringHistory) {
      update();
      return;
    }

    authoringHistory.begin(historyKey, textEditMeta);
    authoringHistory.update(historyKey, update);
  };
  const addItem = () => {
    const nextIndex = element.items.length;
    const update = () => updateGallery((gallery) => ({
      ...gallery,
      items: [...gallery.items, { ...GALLERY_ITEM_DEFAULT }],
    }));
    if (authoringHistory) {
      authoringHistory.discrete(
        {
          kind: "gallery.add",
          labelKey: "history.element.setting",
          labelParams: { setting: "gallery.add" },
        },
        update,
      );
    } else {
      update();
    }
    onSelectedItemIndexChange(nextIndex);
  };
  const removeItem = () => {
    if (selectedItemIndex === null || selectedItemIndex === undefined) return;
    const nextLength = element.items.length - 1;
    const update = () => updateGallery((gallery) => {
      if (selectedItemIndex < 0 || selectedItemIndex >= gallery.items.length) return gallery;
      return {
        ...gallery,
        items: gallery.items.filter((_item, index) => index !== selectedItemIndex),
      };
    });
    if (authoringHistory) {
      authoringHistory.discrete(
        {
          kind: "gallery.remove",
          labelKey: "history.element.setting",
          labelParams: { setting: "gallery.remove" },
        },
        update,
      );
    } else {
      update();
    }
    onSelectedItemIndexChange(nextLength === 0 ? null : Math.min(selectedItemIndex, nextLength - 1));
  };
  return <>
    <div className={styles.inspectorDivider} />
    <InspectorSection title={t("inspector.content")} count={element.items.length} defaultOpen>
      <label className={styles.field}><span>{t("gallery.fit")}</span><select id="gallery-fit" name="galleryFit" value={element.fit} onChange={(event) => { const fit = event.target.value as GalleryFit; if (fit === element.fit) return; runDiscrete("gallery.fit", () => updateGallery((gallery) => ({ ...gallery, fit }))); }}><option value="contain">{t("image.contain")}</option><option value="cover">{t("image.cover")}</option><option value="fill">{t("image.fill")}</option></select></label>
      <div className={styles.collectionSelector} role="group" aria-label={t("gallery.items", { count: element.items.length })}>
        {element.items.map((item, index) => {
          const name = getGalleryItemDisplayName(item, t("gallery.newImage"));
          return <div key={index} className={styles.collectionSelectorRow}>
            <span className={styles.collectionOrdinal} aria-hidden="true">{index + 1}.</span>
            <button type="button" className={`${styles.secondaryButton} ${styles.collectionSelectorButton} ${index === selectedItemIndex ? styles.collectionSelectorButtonSelected : ""}`} aria-label={`${index + 1}. ${name}`} title={name} aria-pressed={index === selectedItemIndex} data-powershow-gallery-select="true" data-powershow-gallery-index={index} onClick={() => onSelectedItemIndexChange(index)}><span className={styles.collectionItemName}>{name}</span></button>
          </div>;
        })}
      </div>
      <div className={styles.galleryItemActions}>
        <button type="button" className="ps-ui-action" data-powershow-gallery-add="true" onClick={addItem}>{t("gallery.add")}</button>
        {selectedItem && selectedItemIndex !== null && selectedItemIndex !== undefined && <>
          <button type="button" className="ps-ui-action" aria-label={t("inspector.remove")} data-powershow-gallery-remove="true" onClick={removeItem}><span>{t("inspector.remove")}</span></button>
        </>}
      </div>
      {selectedItem && selectedItemIndex !== null && selectedItemIndex !== undefined ? <>
        <label className={styles.field}><span>{t("inspector.source")}</span><textarea id={`gallery-${element.id}-item-${selectedItemIndex}-src`} name={`galleryItemSrc_${element.id}`} className={styles.textArea} rows={2} spellCheck={false} value={selectedItem.src} data-powershow-gallery-src="true" onFocus={() => authoringHistory?.begin(`text:gallery-${element.id}-item-${selectedItemIndex}-src`, textEditMeta)} onBlur={() => authoringHistory?.finish(`text:gallery-${element.id}-item-${selectedItemIndex}-src`)} onChange={(event) => updateSelectedItemText("src", event.target.value)} /></label>
        <label className={styles.field}><span>{t("gallery.name")}</span><textarea id={`gallery-${element.id}-item-${selectedItemIndex}-alt`} name={`galleryItemAlt_${element.id}`} className={styles.textArea} rows={2} value={selectedItem.alt} data-powershow-gallery-alt="true" onFocus={() => authoringHistory?.begin(`text:gallery-${element.id}-item-${selectedItemIndex}-alt`, textEditMeta)} onBlur={() => authoringHistory?.finish(`text:gallery-${element.id}-item-${selectedItemIndex}-alt`)} onChange={(event) => updateSelectedItemText("alt", event.target.value)} /></label>
        <label className={styles.field}><span>{t("image.fit")}</span><select id={`gallery-${element.id}-item-${selectedItemIndex}-fit`} value={selectedItem.fit ?? ""} onChange={(event) => { const fit = event.target.value as GalleryFit | ""; if (fit === (selectedItem.fit ?? "")) return; runDiscrete("gallery.itemFit", () => updateSelectedItem((item) => { if (fit === "") { const { fit: _fit, ...inherited } = item; return inherited; } return { ...item, fit }; })); }}><option value="">{t("gallery.inheritFit")}</option><option value="contain">{t("image.contain")}</option><option value="cover">{t("image.cover")}</option><option value="fill">{t("image.fill")}</option></select></label>
        <ImageCropControl crop={selectedItem.crop} idPrefix={`gallery-${element.id}-item-${selectedItemIndex}`} onCropChange={(crop) => updateSelectedItem((item) => ({ ...item, crop }))} onResetCrop={() => updateSelectedItem((item) => ({ ...item, crop: undefined }))} canvasEdit={{ editing: cropEditing, onEditingChange: onCropEditingChange }} />
        <ImageFocalPointControl focalPoint={selectedItem.focalPoint} idPrefix={`gallery-${element.id}-item-${selectedItemIndex}`} onFocalPointChange={(focalPoint) => updateSelectedItem((item) => ({ ...item, focalPoint }))} onResetFocalPoint={() => updateSelectedItem((item) => ({ ...item, focalPoint: undefined }))} canvasEdit={{ editing: focalEditing, onEditingChange: onFocalEditingChange }} />
      </> : <div className={styles.emptyInspectorList}><span>{t("gallery.items", { count: 0 })}</span></div>}
    </InspectorSection>
    <CanonicalElementSizeSection
      layout={element.layout}
      onUpdateLayout={(update) =>
        updateGallery((gallery) => ({
          ...gallery,
          layout: update(gallery.layout),
        }))
      }
    />
    <ElementSpacingSection
      layout={element.layout}
      controlPrefix="gallery"
      onUpdateLayout={(update) => updateGallery((gallery) => ({ ...gallery, layout: update(gallery.layout) }))}
    />
    <CanonicalSurfaceAppearanceSection element={element} style={element.style} effect={element.effect} onUpdateStyle={updateStyle} onUpdateEffect={(update) => updateGallery((gallery) => ({ ...gallery, effect: update(gallery.effect) }))} controlPrefix="gallery" />
    <CanonicalElementEffectsSection effect={element.effect} onUpdateEffect={(update) => updateGallery((gallery) => ({ ...gallery, effect: update(gallery.effect) }))} controlPrefix="gallery" />
  </>;
}
