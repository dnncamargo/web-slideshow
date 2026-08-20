import type { ReactNode } from "react";

import { TopbarBrand } from "@powershow/ui";

import {
  PRODUCT_NAME,
  PRODUCT_SURFACE_LABELS,
  type ProductSurfaceName,
} from "./product-labels";

/**
 * Canonical application-level brand composition for the left Topbar brand
 * slot: the product name is strong and the surface name is regular and
 * quieter. Studio, Editor, and Control all consume this component so the
 * pair never drifts. `@powershow/ui` stays product-agnostic.
 */
export function ProductSurfaceBrand({
  surface,
  className,
  children,
}: {
  surface: ProductSurfaceName;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <TopbarBrand className={className}>
      <strong>{PRODUCT_NAME}</strong>
      <span className="ps-ui-topbar__product-surface">
        {PRODUCT_SURFACE_LABELS[surface]}
      </span>
      {children}
    </TopbarBrand>
  );
}