import {
  PresentationSchema,
} from "@powershow/document-schema";

export const demoPresentation =
  PresentationSchema.parse({
    schemaVersion: 1,

    id: "powershow-demo",

    title: "PowerShow Player Demo",

    description:
      "First PowerShow Player presentation.",

    aspectRatio: "16:9",

    slides: [
      {
        id: "slide-1",

        title: "PowerShow",

        background: {
          color: "#0f1117",

          pattern: {
            type: "dots",
            color: "#3b4252",
            size: 24,
            opacity: 0.8,
          },
        },

        elements: [
          {
            type: "container",

            id: "content-shell",

            role: "content",

            hidden: false,

            direction: "column",

            horizontalAlign: "center",

            verticalAlign: "center",

            style: {
              width: "100%",
              height: "100%",
            },

            children: [
              {
                type: "container",

                id: "content-panel",

                role: "main",

                hidden: false,

                direction: "column",

                gap: 24,

                horizontalAlign: "center",

                verticalAlign: "center",

                style: {
                  width: "78%",
                  height: "72%",
                  padding: 48,
                  background:
                    "rgba(20, 24, 34, 0.92)",
                  borderRadius: 24,
                },

                children: [
                  {
                    type: "text",

                    id: "title",

                    hidden: false,

                    variant: "title",

                    content: "PowerShow",
                  },

                  {
                    type: "text",

                    id: "subtitle",

                    hidden: false,

                    variant: "subtitle",

                    content:
                      "Structured for authoring. Native for presenting.",
                  },

                  {
                    type: "textbox",

                    id: "message",

                    hidden: false,

                    content:
                      "This content area is independent from the static slide background and from the Player navigation.",
                  },
                ],
              },
            ],
          },
        ],
      },

      {
        id: "slide-2",

        title: "Native rendering",

        background: {
          color: "#151922",

          pattern: {
            type: "grid",
            color: "#303744",
            size: 32,
          },
        },

        elements: [
          {
            type: "container",

            id: "slide-2-content",

            role: "content",

            hidden: false,

            direction: "column",

            gap: 28,

            horizontalAlign: "center",

            verticalAlign: "center",

            style: {
              width: "100%",
              height: "100%",
              padding: 64,
            },

            children: [
              {
                type: "text",

                id: "slide-2-title",

                hidden: false,

                variant: "title",

                content:
                  "Native HTML rendering",
              },

              {
                type: "code",

                id: "slide-2-code",

                hidden: false,

                language: "typescript",

                code:
                  'const html = renderSlide(slide);\nplayer.show(html);',

                showLineNumbers: true,

                highlightedLines: [1],
              },
            ],
          },
        ],
      },

      {
        id: "slide-3",

        title: "Terminal",

        background: {
          color: "#0c0f14",
        },

        elements: [
          {
            type: "container",

            id: "slide-3-content",

            role: "content",

            hidden: false,

            direction: "column",

            horizontalAlign: "center",

            verticalAlign: "center",

            style: {
              width: "100%",
              height: "100%",
              padding: 72,
            },

            children: [
              {
                type: "terminal",

                id: "terminal",

                hidden: false,

                title: "PowerShow",

                lines: [
                  {
                    type: "command",
                    content:
                      "pnpm --filter @powershow/player dev",
                  },

                  {
                    type: "output",
                    content:
                      "PowerShow Player running",
                  },

                  {
                    type: "comment",
                    content:
                      "Renderer connected successfully",
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  });