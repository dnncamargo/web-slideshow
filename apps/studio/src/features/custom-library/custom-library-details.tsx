"use client";

import { Button } from "@powershow/ui";

import { ELEMENT_TYPE_MESSAGE_KEYS } from "../i18n/studio-i18n";
import { useStudioI18n } from "../i18n/studio-i18n-context";
import type { CustomLibraryElementRecipe } from "./custom-library-recipe";
import type { CustomLibraryItemRecord } from "./custom-library-repository";
import styles from "../library/presentation-library.module.css";

interface CustomLibraryDetailsProps {
  record: CustomLibraryItemRecord | null;
  onDelete: () => void;
}

function RecipeNode({ recipe, depth = 0 }: { recipe: CustomLibraryElementRecipe; depth?: number }) {
  const { t } = useStudioI18n();
  const label = t(ELEMENT_TYPE_MESSAGE_KEYS[recipe.type]);

  return (
    <li className={styles.recipeNode} style={{ paddingLeft: `${depth * 12}px` }}>
      <strong>{label}</strong>
      <ul className={styles.recipeProperties}>
        {recipe.properties.length === 0 ? (
          <li>{t("customLibrary.details.noProperties")}</li>
        ) : (
          recipe.properties.map((property) => <li key={property.path}>{property.path}</li>)
        )}
      </ul>
      {recipe.children?.length ? (
        <ul className={styles.recipeChildren}>
          {recipe.children.map((child, index) => (
            <RecipeNode key={`${child.type}-${index}`} recipe={child} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function CustomLibraryDetails({ record, onDelete }: CustomLibraryDetailsProps) {
  const { t } = useStudioI18n();

  if (!record) {
    return (
      <aside className={styles.detailsPane} aria-label={t("library.details")}>
        <h2 className={styles.detailsHeading}>{t("library.details")}</h2>
        <p className={styles.detailsEmpty}>{t("customLibrary.details.noSelection")}</p>
      </aside>
    );
  }

  return (
    <aside className={styles.detailsPane} aria-label={t("library.details")}>
      <h2 className={styles.detailsHeading}>{t("library.details")}</h2>
      <dl className={styles.detailsList}>
        <div className={styles.detailsRow}>
          <dt>{t("customLibrary.details.name")}</dt>
          <dd>{record.item.name}</dd>
        </div>
        <div className={styles.detailsRow}>
          <dt>{t("customLibrary.details.description")}</dt>
          <dd>{record.item.description ?? "—"}</dd>
        </div>
        <div className={styles.detailsRow}>
          <dt>{t("customLibrary.details.rootType")}</dt>
          <dd>{t(ELEMENT_TYPE_MESSAGE_KEYS[record.item.root.type])}</dd>
        </div>
        <div className={styles.detailsRow}>
          <dt>{t("customLibrary.details.structure")}</dt>
          <dd>
            <ul className={styles.recipeTree}>
              <RecipeNode recipe={record.item.root} />
            </ul>
          </dd>
        </div>
      </dl>
      <Button variant="danger" size="compact" onClick={onDelete}>
        {t("customLibrary.delete")}
      </Button>
    </aside>
  );
}
