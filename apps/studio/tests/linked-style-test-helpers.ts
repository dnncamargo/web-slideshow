import { isLinkedContainerStyle, type LinkedContainerStyle, type LinkedStyle } from "@web-slideshow/document-schema";

export function containerLinkedStyle(style: LinkedStyle | undefined): LinkedContainerStyle | undefined {
  return style !== undefined && isLinkedContainerStyle(style) ? style : undefined;
}
