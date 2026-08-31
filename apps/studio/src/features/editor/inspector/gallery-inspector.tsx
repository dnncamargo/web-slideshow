import type { GalleryElement } from "@powershow/document-schema";
import { useStudioI18n } from "@/features/i18n/studio-i18n-context";
import styles from "../editor-workspace.module.css";
import { InspectorSection } from "./inspector-section";
import type { TypedInspectorProps, UpdateSurfaceStyle } from "./inspector-types";
import { CanonicalSurfaceAppearanceSection } from "./sections/canonical-surface-appearance-section";
import { CanonicalElementEffectsSection } from "./sections/canonical-element-effects-section";
import { ImageCropControl, ImageFocalPointControl } from "./sections/image-crop-control";

type GalleryFit = GalleryElement["fit"];
type GalleryItem = GalleryElement["items"][number];
const GALLERY_ITEM_DEFAULT: GalleryItem = { src: "/powershow-demo.svg", alt: "New image" };

interface GalleryInspectorProps extends TypedInspectorProps<GalleryElement> {
  selectedItemIndex?: number | null;
  onSelectedItemIndexChange?: (index: number | null) => void;
}

export function GalleryInspector({ element, onUpdate, selectedItemIndex = element.items.length > 0 ? 0 : null, onSelectedItemIndexChange = () => undefined }: GalleryInspectorProps) {
  const { t } = useStudioI18n();
  const selectedItem = selectedItemIndex === null || selectedItemIndex === undefined ? undefined : element.items[selectedItemIndex];
  const updateGallery = (update: (gallery: GalleryElement) => GalleryElement) => onUpdate((current) => current.type === "gallery" ? update(current) : current);
  const updateStyle: UpdateSurfaceStyle = (update) => updateGallery((gallery) => ({ ...gallery, style: update(gallery.style) }));
  const updateSelectedItem = (update: (item: GalleryItem) => GalleryItem) => {
    if (selectedItemIndex === null || selectedItemIndex === undefined || !selectedItem) return;
    updateGallery((gallery) => ({ ...gallery, items: gallery.items.map((item, index) => index === selectedItemIndex ? update(item) : item) }));
  };
  const addItem = () => {
    const nextIndex = element.items.length;
    updateGallery((gallery) => ({ ...gallery, items: [...gallery.items, { ...GALLERY_ITEM_DEFAULT }] }));
    onSelectedItemIndexChange(nextIndex);
  };
  const removeItem = () => {
    if (selectedItemIndex === null || selectedItemIndex === undefined) return;
    const nextLength = element.items.length - 1;
    updateGallery((gallery) => ({ ...gallery, items: gallery.items.filter((_item, index) => index !== selectedItemIndex) }));
    onSelectedItemIndexChange(nextLength === 0 ? null : Math.min(selectedItemIndex, nextLength - 1));
  };
  const moveItem = (direction: -1 | 1) => {
    if (selectedItemIndex === null || selectedItemIndex === undefined) return;
    const targetIndex = selectedItemIndex + direction;
    if (targetIndex < 0 || targetIndex >= element.items.length) return;
    updateGallery((gallery) => { const items = [...gallery.items]; const [moved] = items.splice(selectedItemIndex, 1); if (!moved) return gallery; items.splice(targetIndex, 0, moved); return { ...gallery, items }; });
    onSelectedItemIndexChange(targetIndex);
  };

  return <>
    <div className={styles.inspectorDivider} />
    <InspectorSection title={t("inspector.content")} count={element.items.length} defaultOpen>
      <label className={styles.field}><span>{t("gallery.fit")}</span><select id="gallery-fit" name="galleryFit" value={element.fit} onChange={(event) => updateGallery((gallery) => ({ ...gallery, fit: event.target.value as GalleryFit }))}><option value="contain">{t("image.contain")}</option><option value="cover">{t("image.cover")}</option><option value="fill">{t("image.fill")}</option></select></label>
      <div className={styles.galleryItemSelector} role="group" aria-label={t("gallery.items", { count: element.items.length })}>
        {element.items.map((_item, index) => <button key={index} type="button" className={index === selectedItemIndex ? styles.primaryButton : styles.secondaryButton} aria-label={t("gallery.imageNumber", { number: index + 1 })} aria-pressed={index === selectedItemIndex} data-powershow-gallery-select="true" data-powershow-gallery-index={index} onClick={() => onSelectedItemIndexChange(index)}>{index + 1}</button>)}
        <button type="button" className={styles.secondaryButton} data-powershow-gallery-add="true" onClick={addItem}>{t("gallery.add")}</button>
      </div>
      {selectedItem && selectedItemIndex !== null && selectedItemIndex !== undefined ? <>
        <label className={styles.field}><span>{t("inspector.source")}</span><textarea id={`gallery-${element.id}-item-${selectedItemIndex}-src`} name={`galleryItemSrc_${element.id}`} className={styles.textArea} rows={2} spellCheck={false} value={selectedItem.src} data-powershow-gallery-src="true" onChange={(event) => updateSelectedItem((item) => ({ ...item, src: event.target.value }))} /></label>
        <label className={styles.field}><span>{t("image.alternativeText")}</span><textarea id={`gallery-${element.id}-item-${selectedItemIndex}-alt`} name={`galleryItemAlt_${element.id}`} className={styles.textArea} rows={2} value={selectedItem.alt} data-powershow-gallery-alt="true" onChange={(event) => updateSelectedItem((item) => ({ ...item, alt: event.target.value }))} /></label>
        <label className={styles.field}><span>{t("image.fit")}</span><select id={`gallery-${element.id}-item-${selectedItemIndex}-fit`} value={selectedItem.fit ?? ""} onChange={(event) => updateSelectedItem((item) => { const fit = event.target.value as GalleryFit | ""; if (fit === "") { const { fit: _fit, ...inherited } = item; return inherited; } return { ...item, fit }; })}><option value="">{t("gallery.inheritFit")}</option><option value="contain">{t("image.contain")}</option><option value="cover">{t("image.cover")}</option><option value="fill">{t("image.fill")}</option></select></label>
        <ImageCropControl crop={selectedItem.crop} idPrefix={`gallery-${element.id}-item-${selectedItemIndex}`} onCropChange={(crop) => updateSelectedItem((item) => ({ ...item, crop }))} onResetCrop={() => updateSelectedItem((item) => ({ ...item, crop: undefined }))} />
        <ImageFocalPointControl focalPoint={selectedItem.focalPoint} idPrefix={`gallery-${element.id}-item-${selectedItemIndex}`} onFocalPointChange={(focalPoint) => updateSelectedItem((item) => ({ ...item, focalPoint }))} onResetFocalPoint={() => updateSelectedItem((item) => ({ ...item, focalPoint: undefined }))} />
        <div className={styles.galleryItemActions}><button type="button" className={styles.secondaryButton} disabled={selectedItemIndex === 0} aria-label={t("gallery.moveUp")} data-powershow-gallery-move-up="true" onClick={() => moveItem(-1)}>↑</button><button type="button" className={styles.secondaryButton} disabled={selectedItemIndex === element.items.length - 1} aria-label={t("gallery.moveDown")} data-powershow-gallery-move-down="true" onClick={() => moveItem(1)}>↓</button><button type="button" className={styles.iconButtonDanger} aria-label={t("gallery.remove")} data-powershow-gallery-remove="true" onClick={removeItem}>×</button></div>
      </> : <div className={styles.emptyInspectorList}><span>{t("gallery.items", { count: 0 })}</span></div>}
    </InspectorSection>
    <CanonicalSurfaceAppearanceSection element={element} style={element.style} effect={element.effect} onUpdateStyle={updateStyle} onUpdateEffect={(update) => updateGallery((gallery) => ({ ...gallery, effect: update(gallery.effect) }))} controlPrefix="gallery" />
    <CanonicalElementEffectsSection effect={element.effect} onUpdateEffect={(update) => updateGallery((gallery) => ({ ...gallery, effect: update(gallery.effect) }))} controlPrefix="gallery" />
  </>;
}
