import {
  PresentationSchema,
  type Presentation,
} from "@powershow/document-schema";

// Ordered fixture used by the Scripted Player runtime-lifecycle tests.
//
// Slide order (by index):
//   0 — one Scripted element + ordinary text   (initial Scripted mount)
//   1 — ordinary non-Scripted content only     (navigate-away destination)
//   2 — two Scripted elements                  (multiple-Scripted regression)
//   3 — one hidden Scripted + ordinary text    (hidden-Scripted behavior)
//
// The authored html/css/script below are canonical data transported by the
// renderer into the sandboxed iframe srcdoc. They are never executed by the
// test process (no eval/Function). The Player lifecycle tests only assert
// DOM / browsing-context structure and the renderer-owned iframe transport.
const scriptedHtml = `<div id="counter">0</div>`;

const scriptedCss = `#counter { font-weight: bold; }`;

const scriptedScript =
  `window.__powershowScriptedBootCount = ` +
  `(window.__powershowScriptedBootCount || 0) + 1;`;

export const scriptedLifecyclePresentation: Presentation =
  PresentationSchema.parse({
    schemaVersion: 1,

    id: "scripted-lifecycle-test",

    title: "Scripted Lifecycle Test",

    description: "",

    aspectRatio: "16:9",

    slides: [
      {
        id: "slide-scripted-1",

        elements: [
          {
            type: "scripted",
            id: "scripted-1",
            title: "Scripted One",
            html: scriptedHtml,
            css: scriptedCss,
            script: scriptedScript,
          },

          {
            type: "text",
            id: "text-1",
            variant: "title",
            content: "Scripted Slide",
          },
        ],
      },

      {
        id: "slide-ordinary",

        elements: [
          {
            type: "text",
            id: "text-2",
            variant: "title",
            content: "Ordinary Slide",
          },
        ],
      },

      {
        id: "slide-scripted-two",

        elements: [
          {
            type: "scripted",
            id: "scripted-2",
            title: "Scripted Two",
            html: scriptedHtml,
            css: scriptedCss,
            script: scriptedScript,
          },

          {
            type: "scripted",
            id: "scripted-3",
            title: "Scripted Three",
            html: scriptedHtml,
            css: scriptedCss,
            script: scriptedScript,
          },
        ],
      },

      {
        id: "slide-hidden-scripted",

        elements: [
          {
            type: "scripted",
            id: "scripted-hidden-1",
            title: "Hidden Scripted",
            html: scriptedHtml,
            css: scriptedCss,
            script: scriptedScript,
            hidden: true,
          },

          {
            type: "text",
            id: "text-4",
            variant: "title",
            content: "Ordinary Content On Hidden Slide",
          },
        ],
      },
    ],
  });