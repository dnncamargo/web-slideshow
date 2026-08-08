import { PresentationSchema } from "@powershow/document-schema";

export const demoPresentation = PresentationSchema.parse({
  schemaVersion: 1,

  id: "powershow-demo",

  title: "PowerShow Player Demo",

  description: "Visual primitives demonstration.",

  aspectRatio: "16:9",

  slides: [
    {
      id: "slide-1",

      title: "PowerShow",

      background: {
        color: "#080b12",

        gradient: {
          type: "linear",
          angle: 135,

          stops: [
            {
              color: "#080b12",
              position: 0,
            },
            {
              color: "#121b35",
              position: 52,
            },
            {
              color: "#23133d",
              position: 100,
            },
          ],
        },

        pattern: {
          type: "dots",
          color: "rgba(148,163,184,0.20)",
          size: 24,
          opacity: 0.7,
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
            padding: 64,
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

                borderRadius: 28,

                backgroundGradient: {
                  type: "linear",
                  angle: 145,

                  stops: [
                    {
                      color: "rgba(15,23,42,0.96)",
                      position: 0,
                    },
                    {
                      color: "rgba(30,41,59,0.88)",
                      position: 55,
                    },
                    {
                      color: "rgba(49,46,129,0.72)",
                      position: 100,
                    },
                  ],
                },

                border: {
                  width: 2,

                  gradient: {
                    type: "linear",
                    angle: 135,

                    stops: [
                      {
                        color: "#8b5cf6",
                        position: 0,
                      },
                      {
                        color: "#22d3ee",
                        position: 100,
                      },
                    ],
                  },
                },

                shadow: {
                  x: 0,
                  y: 24,
                  blur: 72,
                  spread: -16,
                  color: "rgba(0,0,0,0.58)",
                },
              },

              children: [
                {
                  type: "text",

                  id: "title",

                  hidden: false,

                  variant: "title",

                  content: "PowerShow",

                  style: {
                    color: "#f8fafc",
                  },
                },

                {
                  type: "text",

                  id: "subtitle",

                  hidden: false,

                  variant: "subtitle",

                  content: "Structured for authoring. Native for presenting.",

                  style: {
                    color: "#cbd5e1",
                  },
                },

                {
                  type: "textbox",

                  id: "message",

                  hidden: false,

                  content:
                    "Background, content and Player navigation are independent visual layers.",

                  style: {
                    color: "#94a3b8",
                  },
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
        color: "#07111c",

        gradient: {
          type: "radial",
          shape: "ellipse",

          stops: [
            {
              color: "#183a52",
              position: 0,
            },
            {
              color: "#0d1d2c",
              position: 48,
            },
            {
              color: "#05090f",
              position: 100,
            },
          ],
        },

        pattern: {
          type: "grid",
          color: "rgba(125,211,252,0.12)",
          size: 32,
          opacity: 0.7,
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
            padding: 72,
          },

          children: [
            {
              type: "container",

              id: "code-panel",

              role: "main",

              hidden: false,

              direction: "column",

              gap: 24,

              horizontalAlign: "stretch",

              verticalAlign: "center",

              style: {
                width: "76%",
                padding: 40,

                borderRadius: 24,

                backgroundGradient: {
                  type: "linear",
                  angle: 160,

                  stops: [
                    {
                      color: "rgba(8,15,27,0.96)",
                      position: 0,
                    },
                    {
                      color: "rgba(15,30,48,0.92)",
                      position: 100,
                    },
                  ],
                },

                border: {
                  width: 1,
                  style: "solid",
                  color: "rgba(125,211,252,0.30)",
                },

                shadow: {
                  x: 0,
                  y: 20,
                  blur: 60,
                  spread: -14,
                  color: "rgba(0,0,0,0.65)",
                },
              },

              children: [
                {
                  type: "text",

                  id: "slide-2-title",

                  hidden: false,

                  variant: "title",

                  content: "Native HTML rendering",

                  style: {
                    color: "#f0f9ff",
                  },
                },

                {
                  type: "code",

                  id: "slide-2-code",

                  hidden: false,

                  language: "typescript",

                  code: "const html = renderSlide(slide);\nplayer.show(html);",

                  showLineNumbers: true,

                  highlightedLines: [1],

                  style: {
                    color: "#e2e8f0",
                    background: "rgba(2,6,23,0.72)",
                    padding: 24,
                    borderRadius: 16,
                  },
                },
              ],
            },
          ],
        },
      ],
    },

    {
      id: "slide-3",

      title: "Terminal",

      background: {
        gradient: {
          type: "linear",
          angle: 120,

          stops: [
            {
              color: "#050505",
              position: 0,
            },
            {
              color: "#101513",
              position: 55,
            },
            {
              color: "#092019",
              position: 100,
            },
          ],
        },

        pattern: {
          type: "diagonal-lines",
          color: "rgba(52,211,153,0.09)",
          size: 28,
          opacity: 0.8,
        },
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
              type: "container",

              id: "terminal-panel",

              role: "main",

              hidden: false,

              direction: "column",

              style: {
                width: "72%",

                padding: 32,

                borderRadius: 22,

                backgroundGradient: {
                  type: "linear",
                  angle: 145,

                  stops: [
                    {
                      color: "rgba(3,7,6,0.97)",
                      position: 0,
                    },
                    {
                      color: "rgba(10,25,20,0.94)",
                      position: 100,
                    },
                  ],
                },

                border: {
                  width: 1,
                  style: "solid",
                  color: "rgba(52,211,153,0.35)",
                },

                shadow: {
                  x: 0,
                  y: 24,
                  blur: 64,
                  spread: -12,
                  color: "rgba(0,0,0,0.72)",
                },
              },

              children: [
                {
                  type: "terminal",

                  id: "terminal",

                  hidden: false,

                  title: "PowerShow",

                  style: {
                    width: "100%",
                    color: "#d1fae5",
                  },

                  lines: [
                    {
                      type: "command",
                      content: "pnpm --filter @powershow/player dev",
                    },

                    {
                      type: "output",
                      content: "PowerShow Player running",
                    },

                    {
                      type: "comment",
                      content: "Renderer connected successfully",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
});
