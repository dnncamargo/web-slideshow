export const PRODUCT_SURFACE_LABELS = {
  library: "Library",
  editor: "Editor",
  control: "Control",
} as const;

export type ProductSurfaceName = keyof typeof PRODUCT_SURFACE_LABELS;
