import type { CustomLibraryElementRecipe } from "./custom-library-recipe";
import { createCustomLibraryStylePreviewModel } from "./custom-library-style-preview-model";
import styles from "../library/presentation-library.module.css";

interface CustomLibraryStylePreviewProps {
  recipe: CustomLibraryElementRecipe;
}

export function CustomLibraryStylePreview({ recipe }: CustomLibraryStylePreviewProps) {
  const model = createCustomLibraryStylePreviewModel(recipe);
  const className = `${styles.customLibraryPreview} ${styles[`customLibraryPreview${model.type[0]?.toUpperCase() ?? ""}${model.type.slice(1)}`] ?? ""}`;

  if (model.type === "text") {
    return <span aria-hidden="true" data-custom-library-preview data-preview-type="text" className={className}>
      <span className={styles.customLibraryPreviewText} style={model.textStyle}>Aa</span>
    </span>;
  }

  return <span aria-hidden="true" data-custom-library-preview data-preview-type={model.type} className={className} style={model.style}>
    {model.type === "container" && model.hasChildren ? <span className={styles.customLibraryPreviewInterior} /> : null}
    {model.type === "image" || model.type === "embed" ? <span className={styles.customLibraryPreviewFrame} /> : null}
    {model.type === "gallery" ? <><span className={styles.customLibraryPreviewTile} /><span className={styles.customLibraryPreviewTile} /><span className={styles.customLibraryPreviewTile} /></> : null}
    {model.type === "code" || model.type === "scripted" ? <><span className={styles.customLibraryPreviewCodeLine} /><span className={styles.customLibraryPreviewCodeLine} /><span className={styles.customLibraryPreviewCodeLine} /></> : null}
    {model.type === "terminal" ? <span className={styles.customLibraryPreviewPrompt}>›_</span> : null}
    {model.type === "table" ? <span className={styles.customLibraryPreviewGrid} /> : null}
    {model.type === "chart" ? <><span className={styles.customLibraryPreviewBar} /><span className={styles.customLibraryPreviewBar} /><span className={styles.customLibraryPreviewBar} /></> : null}
    {model.type === "interactive" ? <><span className={styles.customLibraryPreviewNode} /><span className={styles.customLibraryPreviewNode} /><span className={styles.customLibraryPreviewNode} /></> : null}
    {model.type === "divider" ? <span className={styles.customLibraryPreviewDivider} /> : null}
    {model.type === "blocks" ? <><span className={styles.customLibraryPreviewBlock} /><span className={styles.customLibraryPreviewBlock} /></> : null}
    {model.type === "topics" ? <><span className={styles.customLibraryPreviewBullet} /><span className={styles.customLibraryPreviewBullet} /><span className={styles.customLibraryPreviewBullet} /></> : null}
  </span>;
}
