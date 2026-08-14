export const STUDIO_ROUTES = {
  root: "/",
  studio: "/studio",
  library: "/studio/library",
  editor: "/studio/editor",
} as const;

export function buildStudioEditorHref(presentationId: string): string {
  return `${STUDIO_ROUTES.editor}?id=${encodeURIComponent(presentationId)}`;
}
