export const STUDIO_ROUTES = {
  root: "/",
  studio: "/studio",
  login: "/login",
  library: "/studio/library",
  editor: "/studio/editor",
  control: "/studio/control",
} as const;

export function buildStudioEditorHref(presentationId: string): string {
  return `${STUDIO_ROUTES.editor}?id=${encodeURIComponent(presentationId)}`;
}
