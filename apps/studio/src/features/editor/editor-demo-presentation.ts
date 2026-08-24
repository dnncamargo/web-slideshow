import { PresentationSchema } from "@powershow/document-schema";

// ============================================================
// BEGIN: APRESENTAÇÃO LOCAL DO EDITOR
//
// Por enquanto:
//
// - não usamos Firebase;
// - não importamos a demo do Player;
// - não criamos dependência app → app.
//
// Esta apresentação existe apenas para desenvolver o Editor.
// ============================================================

export const editorDemoPresentation = PresentationSchema.parse({
  schemaVersion: 1,

  id: "editor-demo",

  title: "Editor Demo",

  description: "Local presentation used while developing PowerShow Editor.",

  aspectRatio: "16:9",

  slides: [
    {
      id: "editor-slide-1",

      title: "Welcome",

      background: {
        gradient: {
          type: "linear",

          angle: 135,

          stops: [
            {
              color: "#111827",
              position: 0,
            },

            {
              color: "#312e81",
              position: 100,
            },
          ],
        },

        pattern: {
          type: "dots",

          color: "rgba(255,255,255,0.12)",

          size: 24,
        },
      },

      elements: [
        {
          type: "container",

          id: "welcome-panel",

          role: "main",

          hidden: false,

          layout: {
            width: "70%",
            height: "60%",
            padding: 40,
            children: {
              direction: "column",
              gap: 24,
              horizontalAlign: "center",
              verticalAlign: "center",
            },
          },

          style: {
            borderRadius: 24,
            background: { color: "rgba(15,23,42,0.88)" },
          },

          effect: {
            shadow: {
              x: 0,
              y: 20,
              blur: 50,
              spread: -12,

              color: "rgba(0,0,0,0.5)",
            },
          },

          children: [
            {
              type: "text",

              id: "welcome-title",

              hidden: false,

              variant: "title",

              content: "PowerShow Editor",
            },

            {
              type: "textbox",

              id: "welcome-message",

              hidden: false,

              content:
                "The canvas is rendered by the same PowerShow renderer used by the Player.",
            },
          ],
        },
      ],
    },

    {
      id: "editor-slide-2",

      title: "Code",

      background: {
        color: "#08111f",

        pattern: {
          type: "grid",

          color: "rgba(125,211,252,0.12)",

          size: 32,
        },
      },

      elements: [
        {
          type: "container",

          id: "code-content",

          role: "content",

          hidden: false,

          layout: {
            width: "100%",
            height: "100%",
            padding: 64,
            children: {
              direction: "column",
              gap: 24,
              horizontalAlign: "center",
              verticalAlign: "center",
            },
          },

          children: [
            {
              type: "text",

              id: "code-title",

              hidden: false,

              variant: "title",

              content: "Live rendering",
            },

            {
              type: "code",

              id: "code-example",

              hidden: false,

              language: "typescript",

              code: "const html = renderSlide(slide);\ncanvas.innerHTML = html;",

              showLineNumbers: true,

              highlightedLines: [1],

              layout: {
                width: "72%",
              },
            },
          ],
        },
      ],
    },

    {
      id: "editor-slide-3",

      title: "Terminal",

      background: {
        color: "#07110d",
      },

      elements: [
        {
          type: "container",

          id: "terminal-content",

          role: "content",

          hidden: false,

          layout: {
            width: "100%",
            height: "100%",
            padding: 72,
            children: {
              direction: "column",
              horizontalAlign: "center",
              verticalAlign: "center",
            },
          },

          children: [
            {
              type: "terminal",

              id: "editor-terminal",

              hidden: false,

              title: "PowerShow",

              layout: {
                width: "70%",
              },

              lines: [
                {
                  type: "command",

                  content: "pnpm --filter @powershow/studio dev",
                },

                {
                  type: "output",

                  content: "PowerShow Editor running",
                },

                {
                  type: "comment",

                  content: "Same renderer. Different authoring surface.",
                },
              ],
            },
          ],
        },
      ],
    },
    // ======================================================
    // BEGIN: IMAGE SLIDE
    // ======================================================

    {
      id: "editor-slide-4",

      title: "Image",

      background: {
        gradient: {
          type: "linear",

          angle: 135,

          stops: [
            {
              color: "#100b22",
              position: 0,
            },

            {
              color: "#06202c",
              position: 100,
            },
          ],
        },
      },

      elements: [
        {
          type: "container",

          id: "image-content",

          role: "content",

          hidden: false,

          layout: {
            width: "100%",
            height: "100%",
            padding: 64,
            children: {
              direction: "column",
              gap: 24,
              horizontalAlign: "center",
              verticalAlign: "center",
            },
          },

          children: [
            {
              type: "text",

              id: "image-title",

              hidden: false,

              variant: "title",

              content: "Image editing",
            },

            {
              type: "image",

              id: "editor-image",

              hidden: false,

              src: "/powershow-demo.svg",

              alt: "PowerShow Image Element demonstration",

              fit: "contain",

              layout: {
                width: "62%",
                height: "58%",
              },
              style: {
                borderRadius: 20,

                border: {
                  width: 1,

                  color: "rgba(148,163,184,0.28)",
                },
              },
            },
          ],
        },
      ],
    },

    // ======================================================
    // END: IMAGE SLIDE
    // ======================================================

    // ======================================================
    // BEGIN: TABLE SLIDE
    // ======================================================

    {
      id: "editor-slide-5",

      title: "Table",

      background: {
        color: "#0b1020",

        pattern: {
          type: "grid",

          color: "rgba(99,102,241,0.12)",

          size: 32,
        },
      },

      elements: [
        {
          type: "container",

          id: "table-content",

          role: "content",

          hidden: false,

          layout: {
            width: "100%",
            height: "100%",
            padding: 64,
            children: {
              direction: "column",
              gap: 24,
              horizontalAlign: "center",
              verticalAlign: "center",
            },
          },

          children: [
            {
              type: "text",

              id: "table-title",

              hidden: false,

              variant: "title",

              content: "Structured data",
            },

            {
              type: "table",

              id: "editor-table",

              hidden: false,

              layout: {
                width: "82%",
              },

              columns: [
                {
                  key: "component",

                  label: "Component",
                },

                {
                  key: "status",

                  label: "Status",
                },

                {
                  key: "score",

                  label: "Score",
                },

                {
                  key: "enabled",

                  label: "Enabled",
                },
              ],

              rows: [
                {
                  component: "Renderer",

                  status: "Ready",

                  score: 98,

                  enabled: true,
                },

                {
                  component: "Theme",

                  status: "Ready",

                  score: 94,

                  enabled: true,
                },

                {
                  component: "Charts",

                  status: "Planned",

                  score: null,

                  enabled: false,
                },
              ],
            },
          ],
        },
      ],
    },

    // ======================================================
    // END: TABLE SLIDE
    // ======================================================
  ],
});

// ============================================================
// END: APRESENTAÇÃO LOCAL DO EDITOR
// ============================================================
