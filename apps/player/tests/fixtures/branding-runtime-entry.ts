import { displayName } from "@web-slideshow/instance-branding";

const browserGlobal = globalThis as typeof globalThis & {
  __instanceDisplayName?: string;
};

browserGlobal.__instanceDisplayName = displayName;
