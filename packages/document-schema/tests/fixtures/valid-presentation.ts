import type {
  Presentation,
} from "../../src";

export const validPresentation: Presentation = {
  schemaVersion: 1,

  id: "presentation-pwm",

  title: "Introdução ao PWM",

  description:
    "Apresentação demonstrativa para validar o schema inicial do PowerShow.",

  aspectRatio: "16:9",

  slides: [
    {
      id: "slide-001",

      title: "Modulação PWM",

      summary:
        "Introdução ao conceito de modulação por largura de pulso.",

      speakerNotes:
        "Explicar que a amplitude permanece constante e que o duty cycle altera o valor médio.",

      layoutPreset: "media-content",

      background: {
        color: "#ffffff",
      },

      elements: [
        {
          id: "main",

          type: "container",

          role: "main",

          direction: "row",

          gap: 32,

          hidden: false,

          children: [
            {
              id: "image-column",

              type: "container",

              role: "column",

              direction: "column",

              width: "45%",

              verticalAlign: "center",

              hidden: false,

              children: [
                {
                  id: "pwm-image",

                  type: "image",

                  src: "/assets/pwm-board.webp",

                  alt: "Circuito eletrônico demonstrando PWM",

                  fit: "contain",

                  hidden: false,
                },
              ],
            },

            {
              id: "content-column",

              type: "container",

              role: "column",

              direction: "column",

              width: "55%",

              gap: 24,

              verticalAlign: "center",

              hidden: false,

              children: [
                {
                  id: "slide-title",

                  type: "text",

                  variant: "title",

                  content: "Modulação PWM",

                  hidden: false,
                },

                {
                  id: "definition",

                  type: "textbox",

                  preset: "definition",

                  content:
                    "PWM controla o valor médio entregue à carga alterando a largura dos pulsos.",

                  hidden: false,

                  style: {
                    padding: 24,
                    borderRadius: 12,
                  },
                },

                {
                  id: "terminal",

                  type: "terminal",

                  title: "Serial Monitor",

                  hidden: false,

                  lines: [
                    {
                      type: "command",
                      content: "set-duty 75",
                    },
                    {
                      type: "output",
                      content: "Duty cycle: 75%",
                    },
                  ],
                },
              ],
            },
          ],
        },

        {
          id: "footer",

          type: "container",

          role: "footer",

          direction: "row",

          horizontalAlign: "center",

          hidden: false,

          style: {
            paddingTop: 12,
          },

          children: [
            {
              id: "footer-text",

              type: "text",

              variant: "caption",

              content:
                "PowerShow · Eletrônica · Slide 1",

              hidden: false,
            },
          ],
        },
      ],
    },

    {
      id: "slide-002",

      title: "Comparação de Duty Cycle",

      summary:
        "Exibe valores de duty cycle em tabela.",

      speakerNotes: "",

      layoutPreset: "single-column-centered",

      elements: [
        {
          id: "main",

          type: "container",

          role: "main",

          direction: "column",

          horizontalAlign: "center",

          verticalAlign: "center",

          gap: 24,

          hidden: false,

          children: [
            {
              id: "title",

              type: "text",

              variant: "title",

              content:
                "Duty Cycle e Tensão Média",

              hidden: false,
            },

            {
              id: "table",

              type: "table",

              hidden: false,

              columns: [
                {
                  key: "duty",
                  label: "Duty Cycle",
                },
                {
                  key: "voltage",
                  label: "Tensão Média",
                },
              ],

              rows: [
                {
                  duty: "25%",
                  voltage: "1,25 V",
                },
                {
                  duty: "50%",
                  voltage: "2,50 V",
                },
                {
                  duty: "75%",
                  voltage: "3,75 V",
                },
                {
                  duty: "100%",
                  voltage: "5,00 V",
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};