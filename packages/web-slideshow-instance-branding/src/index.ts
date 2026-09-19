const configuredDisplayName =
  typeof process !== "undefined"
    ? process.env.WEB_SLIDESHOW_DISPLAY_NAME?.trim()
    : undefined;

/** The effective instance display name, with a neutral template fallback. */
export const displayName = configuredDisplayName || "Presentation";
