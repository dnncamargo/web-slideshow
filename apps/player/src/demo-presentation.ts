// ============================================================
// BEGIN: PRESETS DE TAMANHO
// ============================================================

import {
  resolvePanelSize,
} from "@powershow/theme/panel-size";

// ============================================================
// END: PRESETS DE TAMANHO
// ============================================================

import {
  PresentationSchema,
} from "@powershow/document-schema";


// ============================================================
// BEGIN: IMAGEM LOCAL DA DEMO
//
// Usamos um SVG embutido como data URI.
//
// Vantagens:
// - não depende da internet;
// - não exige arquivo adicional em public/;
// - permite comparar contain / cover / fill.
//
// O desenho propositalmente tem proporção 16:9.
// Nos slides vamos colocá-lo dentro de caixas quadradas,
// deixando as diferenças entre os modos de fit bem visíveis.
// ============================================================

const demoImageSvg = `
<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 800 450"
>
  <defs>
    <linearGradient
      id="background"
      x1="0"
      y1="0"
      x2="1"
      y2="1"
    >
      <stop
        offset="0%"
        stop-color="#7c3aed"
      />

      <stop
        offset="100%"
        stop-color="#06b6d4"
      />
    </linearGradient>
  </defs>

  <rect
    width="800"
    height="450"
    fill="url(#background)"
  />

  <circle
    cx="175"
    cy="225"
    r="105"
    fill="#f8fafc"
    fill-opacity="0.92"
  />

  <rect
    x="340"
    y="105"
    width="330"
    height="240"
    rx="30"
    fill="#020617"
    fill-opacity="0.78"
  />

  <text
    x="505"
    y="210"
    text-anchor="middle"
    fill="#f8fafc"
    font-family="Arial, sans-serif"
    font-size="46"
    font-weight="700"
  >
    PowerShow
  </text>

  <text
    x="505"
    y="265"
    text-anchor="middle"
    fill="#cbd5e1"
    font-family="Arial, sans-serif"
    font-size="24"
  >
    Image demo
  </text>
</svg>
`;

const demoImageSrc =
  `data:image/svg+xml,${encodeURIComponent(
    demoImageSvg,
  )}`;

// ============================================================
// END: IMAGEM LOCAL DA DEMO
// ============================================================


// ============================================================
// BEGIN: APRESENTAÇÃO DE DEMONSTRAÇÃO
// ============================================================

type DemoRecord = Record<string, unknown>;

function isDemoRecord(value: unknown): value is DemoRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function migrateLegacyStyle(style: DemoRecord): {
  style: DemoRecord | undefined;
  effect: DemoRecord | undefined;
} {
  const {
    width: _width,
    height: _height,
    padding: _padding,
    paddingTop: _paddingTop,
    paddingRight: _paddingRight,
    paddingBottom: _paddingBottom,
    paddingLeft: _paddingLeft,
    margin: _margin,
    marginTop: _marginTop,
    marginRight: _marginRight,
    marginBottom: _marginBottom,
    marginLeft: _marginLeft,
    backgroundGradient,
    shadow,
    background,
    ...remainingStyle
  } = style;

  const migratedStyle: DemoRecord = { ...remainingStyle };
  if (isDemoRecord(background)) {
    migratedStyle.background = background;
  } else if (typeof background === "string") {
    migratedStyle.background = { color: background };
  }

  if (backgroundGradient !== undefined) {
    const currentBackground = isDemoRecord(migratedStyle.background)
      ? migratedStyle.background
      : {};
    migratedStyle.background = { ...currentBackground, gradient: backgroundGradient };
  }

  return {
    style: Object.keys(migratedStyle).length > 0 ? migratedStyle : undefined,
    effect: isDemoRecord(shadow) ? { shadow } : undefined,
  };
}

function legacyLayout(style: DemoRecord, layout: unknown): DemoRecord {
  const currentLayout = isDemoRecord(layout) ? layout : {};
  const sizing = Object.fromEntries(
    [
      "width", "height", "padding", "paddingTop", "paddingRight", "paddingBottom",
      "paddingLeft", "margin", "marginTop", "marginRight", "marginBottom", "marginLeft",
    ].flatMap((key) => style[key] === undefined ? [] : [[key, style[key]]]),
  );

  return { ...currentLayout, ...sizing };
}

function migrateLegacyElement(element: unknown): unknown {
  if (!isDemoRecord(element) || typeof element.type !== "string") return element;

  if (element.type === "container") {
    const {
      direction,
      gap,
      distribution,
      horizontalAlign,
      verticalAlign,
      style: styleValue,
      layout: layoutValue,
      children: childrenValue,
      ...container
    } = element;
    const style = isDemoRecord(styleValue) ? styleValue : {};
    const migrated = migrateLegacyStyle(style);
    const currentLayout = legacyLayout(style, layoutValue);
    const currentChildren = isDemoRecord(currentLayout.children)
      ? currentLayout.children
      : {};
    const childrenLayout = {
      ...currentChildren,
      ...(direction === undefined ? {} : { direction }),
      ...(gap === undefined ? {} : { gap }),
      ...(distribution === undefined ? {} : { distribution }),
      ...(horizontalAlign === undefined ? {} : { horizontalAlign }),
      ...(verticalAlign === undefined ? {} : { verticalAlign }),
    };

    return {
      ...container,
      layout: {
        ...currentLayout,
        ...(Object.keys(childrenLayout).length === 0 ? {} : { children: childrenLayout }),
      },
      ...(migrated.style === undefined ? {} : { style: migrated.style }),
      ...(migrated.effect === undefined ? {} : { effect: migrated.effect }),
      children: Array.isArray(childrenValue)
        ? childrenValue.map(migrateLegacyElement)
        : childrenValue,
    };
  }

  if (element.type === "image") {
    const { style: styleValue, layout: layoutValue, ...image } = element;
    const style = isDemoRecord(styleValue) ? styleValue : {};
    const migrated = migrateLegacyStyle(style);
    const imageStyle = migrated.style;
    const hasBackground = isDemoRecord(imageStyle?.background);
    const { background: _background, ...imageVisualStyle } = imageStyle ?? {};
    const imageElement = {
      ...image,
      layout: legacyLayout(style, layoutValue),
      ...(Object.keys(imageVisualStyle).length === 0 ? {} : { style: imageVisualStyle }),
      ...(migrated.effect === undefined ? {} : { effect: migrated.effect }),
    };

    return hasBackground
      ? {
          type: "container",
          id: `${String(image.id)}-frame`,
          hidden: false,
          style: { background: imageStyle?.background },
          children: [imageElement],
        }
      : imageElement;
  }

  if (element.type === "table") {
    const { style: styleValue, layout: layoutValue, ...table } = element;
    const style = isDemoRecord(styleValue) ? styleValue : {};
    const migrated = migrateLegacyStyle(style);
    return {
      ...table,
      layout: legacyLayout(style, layoutValue),
      ...(migrated.style === undefined ? {} : { style: migrated.style }),
      ...(migrated.effect === undefined ? {} : { effect: migrated.effect }),
    };
  }

  if (element.type === "chart" || element.type === "interactive") {
    const { style: styleValue, layout: layoutValue, id, ...component } = element;
    const style = isDemoRecord(styleValue) ? styleValue : {};
    const migrated = migrateLegacyStyle(style);
    const layout = legacyLayout(style, layoutValue);
    return {
      type: "container",
      id: `${String(id)}-frame`,
      hidden: false,
      layout,
      ...(migrated.style === undefined ? {} : { style: migrated.style }),
      ...(migrated.effect === undefined ? {} : { effect: migrated.effect }),
      children: [{ ...component, id }],
    };
  }

  return element;
}

function migrateLegacyDemoDocument(document: DemoRecord): DemoRecord {
  return {
    ...document,
    slides: Array.isArray(document.slides)
      ? document.slides.map((slide) => {
          if (!isDemoRecord(slide)) return slide;
          return {
            ...slide,
            elements: Array.isArray(slide.elements)
              ? slide.elements.map(migrateLegacyElement)
              : slide.elements,
          };
        })
      : document.slides,
  };
}

export const demoPresentation =
  PresentationSchema.parse(migrateLegacyDemoDocument({
    schemaVersion: 1,

    id: "powershow-demo",

    title:
      "PowerShow Component Showcase",

    description:
      "Visual validation of PowerShow renderer and theme components.",

    aspectRatio: "16:9",

    slides: [

      // ======================================================
      // SLIDE 1
      // VISUAL PRIMITIVES
      //
      // Valida:
      // - slide gradient;
      // - pattern;
      // - content gradient;
      // - rounded corners;
      // - shadow;
      // - gradient border;
      // - title/subtitle/text.
      // ======================================================

      {
        id: "slide-1",

        title:
          "Visual primitives",

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

            color:
              "rgba(148,163,184,0.20)",

            size: 24,
            opacity: 0.7,
          },
        },

        elements: [
          {
            type: "container",

            id: "slide-1-shell",

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

                id: "slide-1-panel",

                role: "main",

                hidden: false,

                direction: "column",

                gap: 24,

                horizontalAlign:
                  "center",

                verticalAlign:
                  "center",

                style: {
                    ...resolvePanelSize(
                      "large",
                    ),

                  padding: 48,

                  borderRadius: 28,

                  backgroundGradient: {
                    type: "linear",
                    angle: 145,

                    stops: [
                      {
                        color:
                          "rgba(15,23,42,0.96)",

                        position: 0,
                      },
                      {
                        color:
                          "rgba(30,41,59,0.88)",

                        position: 55,
                      },
                      {
                        color:
                          "rgba(49,46,129,0.72)",

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
                          color:
                            "#8b5cf6",

                          position: 0,
                        },
                        {
                          color:
                            "#22d3ee",

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

                    color:
                      "rgba(0,0,0,0.58)",
                  },
                },

                children: [
                  {
                    type: "text",

                    id:
                      "slide-1-title",

                    hidden: false,

                    variant: "title",

                    content:
                      "PowerShow",
                  },

                  {
                    type: "text",

                    id:
                      "slide-1-subtitle",

                    hidden: false,

                    variant:
                      "subtitle",

                    content:
                      "Structured for authoring. Native for presenting.",
                  },

                  {
                    type: "text",

                    id:
                      "slide-1-message",

                    hidden: false,

                    variant: "body",

                    content:
                      "Background, content and Player navigation are independent visual layers.",
                  },
                ],
              },
            ],
          },
        ],
      },


      // ======================================================
      // SLIDE 2
      // TYPOGRAPHY
      //
      // Valida todos os variants de TextElement:
      // - title
      // - subtitle
      // - body
      // - caption
      //
      // Este slide deve usar principalmente os defaults
      // definidos por @powershow/theme.
      // ======================================================

      {
        id: "slide-2",

        title:
          "Typography",

        background: {
          gradient: {
            type: "linear",
            angle: 125,

            stops: [
              {
                color: "#07111f",
                position: 0,
              },
              {
                color: "#172554",
                position: 100,
              },
            ],
          },

          pattern: {
            type: "horizontal-lines",

            color:
              "rgba(148,163,184,0.08)",

            size: 32,
            opacity: 0.7,
          },
        },

        elements: [
          {
            type: "container",

            id:
              "slide-2-content",

            role: "content",

            hidden: false,

            direction: "column",

            gap: 22,

            horizontalAlign:
              "start",

            verticalAlign:
              "center",

            style: {
              width: "100%",
              height: "100%",

              padding: 96,
            },

            children: [
              {
                type: "text",

                id:
                  "typography-title",

                hidden: false,

                variant: "title",

                content:
                  "Presentation typography",
              },

              {
                type: "text",

                id:
                  "typography-subtitle",

                hidden: false,

                variant:
                  "subtitle",

                content:
                  "A structural hierarchy without exposing CSS.",
              },

              {
                type: "text",

                id:
                  "typography-body",

                hidden: false,

                variant: "body",

                content:
                  "Body text is intended for explanations, supporting information and normal slide content. The theme provides readable defaults while the document can still override selected visual properties.",
              },

              {
                type: "text",

                id:
                  "typography-caption",

                hidden: false,

                variant:
                  "caption",

                content:
                  "Caption — secondary information and contextual notes.",
              },
            ],
          },
        ],
      },


      // ======================================================
      // SLIDE 3
      // TEXT + CONTAINERS
      //
      // Valida:
      // - text em blocos dentro de containers;
      // - containers como infraestrutura de layout;
      // - overrides estruturados de background/border.
      // ======================================================

      {
        id: "slide-3",

        title:
          "Text and content",

        background: {
          color: "#0b1020",

          pattern: {
            type: "grid",

            color:
              "rgba(99,102,241,0.14)",

            size: 36,
            opacity: 0.65,
          },
        },

        elements: [
          {
            type: "container",

            id:
              "slide-3-content",

            role: "content",

            hidden: false,

            direction: "column",

            gap: 30,

            horizontalAlign:
              "center",

            verticalAlign:
              "center",

            style: {
              width: "100%",
              height: "100%",

              padding: 72,
            },

            children: [
              {
                type: "text",

                id:
                  "slide-3-title",

                hidden: false,

                variant: "title",

                content:
                  "Text and content panels",
              },

              {
                type: "container",

                id:
                  "content-panel",

                role: "main",

                hidden: false,

                direction: "column",

                gap: 20,

                style: {
                  width: "76%",

                  padding: 36,

                  borderRadius: 20,

                  background:
                    "rgba(15,23,42,0.88)",

                  border: {
                    width: 1,
                    style: "solid",

                    color:
                      "rgba(148,163,184,0.24)",
                  },

                  shadow: {
                    x: 0,
                    y: 18,
                    blur: 48,
                    spread: -12,

                    color:
                      "rgba(0,0,0,0.55)",
                  },
                },

                children: [
                  {
                    type: "text",

                    id:
                      "text-example-1",

                    hidden: false,

                    variant: "body",

                    content:
                      "Text blocks are designed for normal blocks of textual content. Their baseline typography comes from the shared theme.",
                  },

                  {
                    type: "text",

                    id:
                      "text-example-2",

                    hidden: false,

                    variant: "body",

                    content:
                      "The author should not need to understand font-family, line-height, CSS selectors or browser layout rules to create a readable slide.",

                    style: {
                      color:
                        "#a5b4fc",
                    },
                  },
                ],
              },
            ],
          },
        ],
      },


      // ======================================================
      // SLIDE 4
      // CODE
      //
      // Valida:
      // - base theme do code;
      // - fonte monospace;
      // - line numbers;
      // - highlighted lines.
      // ======================================================

      {
        id: "slide-4",

        title:
          "Code",

        background: {
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

            color:
              "rgba(125,211,252,0.10)",

            size: 32,
            opacity: 0.7,
          },
        },

        elements: [
          {
            type: "container",

            id:
              "slide-4-content",

            role: "content",

            hidden: false,

            direction: "column",

            gap: 26,

            horizontalAlign:
              "center",

            verticalAlign:
              "center",

            style: {
              width: "100%",
              height: "100%",

              padding: 72,
            },

            children: [
              {
                type: "text",

                id:
                  "slide-4-title",

                hidden: false,

                variant: "title",

                content:
                  "Native HTML rendering",
              },

              {
                type: "code",

                id:
                  "slide-4-code",

                hidden: false,

                language:
                  "typescript",

                code:
                  'const slide = presentation.slides[index];\nconst html = renderSlide(slide);\nslideHost.innerHTML = html;\nplayer.showControls();',

                showLineNumbers: true,

                highlightedLines:
                  [2, 3],

                layout: {
                  width: "76%",
                },
              },
            ],
          },
        ],
      },


      // ======================================================
      // SLIDE 5
      // TERMINAL
      //
      // Valida:
      // - titlebar;
      // - controles decorativos;
      // - command;
      // - output;
      // - comment;
      // - error.
      // ======================================================

      {
        id: "slide-5",

        title:
          "Terminal",

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
            type:
              "diagonal-lines",

            color:
              "rgba(52,211,153,0.09)",

            size: 28,
            opacity: 0.8,
          },
        },

        elements: [
          {
            type: "container",

            id:
              "slide-5-content",

            role: "content",

            hidden: false,

            direction: "column",

            gap: 28,

            horizontalAlign:
              "center",

            verticalAlign:
              "center",

            style: {
              width: "100%",
              height: "100%",

              padding: 72,
            },

            children: [
              {
                type: "text",

                id:
                  "slide-5-title",

                hidden: false,

                variant: "title",

                content:
                  "Terminal component",
              },

              {
                type: "container",

                id:
                  "terminal-panel",

                role: "main",

                hidden: false,

                direction: "column",

                style: {
                  ...resolvePanelSize(
                    "medium",
                  ),

                  padding: 28,

                  borderRadius: 22,

                  background:
                    "rgba(3,7,6,0.76)",

                  border: {
                    width: 1,

                    color:
                      "rgba(52,211,153,0.28)",
                  },

                  shadow: {
                    x: 0,
                    y: 24,
                    blur: 64,
                    spread: -12,

                    color:
                      "rgba(0,0,0,0.72)",
                  },
                },

                children: [
                  {
                    type: "terminal",

                    id:
                      "terminal",

                    hidden: false,

                    title:
                      "PowerShow",

                    lines: [
                      {
                        type:
                          "command",

                        content:
                          "pnpm --filter @powershow/player dev",
                      },

                      {
                        type:
                          "output",

                        content:
                          "PowerShow Player running",
                      },

                      {
                        type:
                          "comment",

                        content:
                          "Renderer connected successfully",
                      },

                      {
                        type:
                          "error",

                        content:
                          "Example error message for visual validation",
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },


      // ======================================================
      // SLIDE 6
      // TABLE
      //
      // O schema atual usa:
      //
      // columns: [
      //   { key, label }
      // ]
      //
      // rows: [
      //   { [key]: value }
      // ]
      //
      // Valida o estilo estrutural definido em
      // @powershow/theme.
      // ======================================================

      {
        id: "slide-6",

        title:
          "Table",

        background: {
          gradient: {
            type: "linear",
            angle: 145,

            stops: [
              {
                color: "#111827",
                position: 0,
              },
              {
                color: "#172033",
                position: 100,
              },
            ],
          },

          pattern: {
            type:
              "vertical-lines",

            color:
              "rgba(148,163,184,0.07)",

            size: 40,
            opacity: 0.8,
          },
        },

        elements: [
          {
            type: "container",

            id:
              "slide-6-content",

            role: "content",

            hidden: false,

            direction: "column",

            gap: 28,

            horizontalAlign:
              "center",

            verticalAlign:
              "center",

            style: {
              width: "100%",
              height: "100%",

              padding: 76,
            },

            children: [
              {
                type: "text",

                id:
                  "slide-6-title",

                hidden: false,

                variant: "title",

                content:
                  "Structured tables",
              },

              {
                type: "text",

                id:
                  "slide-6-subtitle",

                hidden: false,

                variant:
                  "subtitle",

                content:
                  "Semantic data without requiring HTML tables from the author.",
              },

              {
                type: "table",

                id:
                  "component-table",

                hidden: false,

                style: {
                  width: "84%",
                },

                columns: [
                  {
                    key:
                      "component",

                    label:
                      "Component",
                  },
                  {
                    key:
                      "purpose",

                    label:
                      "Purpose",
                  },
                  {
                    key:
                      "status",

                    label:
                      "Status",
                  },
                ],

                rows: [
                  {
                    component:
                      "Text",

                    purpose:
                      "Presentation typography",

                    status:
                      "Ready",
                  },
                  {
                    component:
                      "Code",

                    purpose:
                      "Source examples",

                    status:
                      "Ready",
                  },
                  {
                    component:
                      "Terminal",

                    purpose:
                      "Command-line demonstrations",

                    status:
                      "Ready",
                  },
                  {
                    component:
                      "Table",

                    purpose:
                      "Structured information",

                    status:
                      "Ready",
                  },
                ],
              },
            ],
          },
        ],
      },


      // ======================================================
      // SLIDE 7
      // IMAGE
      //
      // Mostra os três modos aceitos pelo schema:
      //
      // contain
      // cover
      // fill
      //
      // Usamos a mesma imagem e a mesma caixa quadrada
      // para tornar a diferença evidente.
      // ======================================================

      {
        id: "slide-7",

        title:
          "Images",

        background: {
          gradient: {
            type: "linear",
            angle: 135,

            stops: [
              {
                color: "#120b24",
                position: 0,
              },
              {
                color: "#17112d",
                position: 50,
              },
              {
                color: "#061724",
                position: 100,
              },
            ],
          },
        },

        elements: [
          {
            type: "container",

            id:
              "slide-7-content",

            role: "content",

            hidden: false,

            direction: "column",

            gap: 30,

            horizontalAlign:
              "center",

            verticalAlign:
              "center",

            style: {
              width: "100%",
              height: "100%",

              padding: 64,
            },

            children: [
              {
                type: "text",

                id:
                  "slide-7-title",

                hidden: false,

                variant: "title",

                content:
                  "Image fitting",
              },

              {
                type: "container",

                id:
                  "image-comparison",

                role: "row",

                hidden: false,

                direction: "row",

                gap: 30,

                horizontalAlign:
                  "center",

                verticalAlign:
                  "center",

                style: {
                  width: "92%",
                },

                children: [

                  // --------------------------------------------
                  // CONTAIN
                  // --------------------------------------------

                  {
                    type:
                      "container",

                    id:
                      "image-contain-column",

                    role: "column",

                    hidden: false,

                    direction:
                      "column",

                    gap: 14,

                    horizontalAlign:
                      "center",

                    children: [
                      {
                        type:
                          "text",

                        id:
                          "image-contain-label",

                        hidden: false,

                        variant:
                          "subtitle",

                        content:
                          "contain",
                      },

                      {
                        type:
                          "image",

                        id:
                          "image-contain",

                        hidden: false,

                        src:
                          demoImageSrc,

                        alt:
                          "PowerShow demo graphic using contain",

                        fit:
                          "contain",

                        style: {
                          width: 240,
                          height: 240,

                          background:
                            "rgba(15,23,42,0.72)",

                          borderRadius:
                            18,

                          border: {
                            width: 1,

                            color:
                              "rgba(148,163,184,0.28)",
                          },
                        },
                      },
                    ],
                  },


                  // --------------------------------------------
                  // COVER
                  // --------------------------------------------

                  {
                    type:
                      "container",

                    id:
                      "image-cover-column",

                    role: "column",

                    hidden: false,

                    direction:
                      "column",

                    gap: 14,

                    horizontalAlign:
                      "center",

                    children: [
                      {
                        type:
                          "text",

                        id:
                          "image-cover-label",

                        hidden: false,

                        variant:
                          "subtitle",

                        content:
                          "cover",
                      },

                      {
                        type:
                          "image",

                        id:
                          "image-cover",

                        hidden: false,

                        src:
                          demoImageSrc,

                        alt:
                          "PowerShow demo graphic using cover",

                        fit:
                          "cover",

                        style: {
                          width: 240,
                          height: 240,

                          borderRadius:
                            18,

                          border: {
                            width: 1,

                            color:
                              "rgba(148,163,184,0.28)",
                          },
                        },
                      },
                    ],
                  },


                  // --------------------------------------------
                  // FILL
                  // --------------------------------------------

                  {
                    type:
                      "container",

                    id:
                      "image-fill-column",

                    role: "column",

                    hidden: false,

                    direction:
                      "column",

                    gap: 14,

                    horizontalAlign:
                      "center",

                    children: [
                      {
                        type:
                          "text",

                        id:
                          "image-fill-label",

                        hidden: false,

                        variant:
                          "subtitle",

                        content:
                          "fill",
                      },

                      {
                        type:
                          "image",

                        id:
                          "image-fill",

                        hidden: false,

                        src:
                          demoImageSrc,

                        alt:
                          "PowerShow demo graphic using fill",

                        fit:
                          "fill",

                        style: {
                          width: 240,
                          height: 240,

                          borderRadius:
                            18,

                          border: {
                            width: 1,

                            color:
                              "rgba(148,163,184,0.28)",
                          },
                        },
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },


      // ======================================================
      // SLIDE 8
      // COMPONENTES AINDA NÃO IMPLEMENTADOS
      //
      // Chart e Interactive já existem no schema,
      // mas neste estágio o renderer ainda produz placeholders.
      //
      // Isso é proposital:
      // permite enxergar claramente o estágio atual do projeto.
      // ======================================================

      {
        id: "slide-8",

        title:
          "Chart and interaction",

        background: {
          color: "#080b12",

          pattern: {
            type: "dots",

            color:
              "rgba(139,92,246,0.18)",

            size: 26,
            opacity: 0.8,
          },
        },

        elements: [
          {
            type: "container",

            id:
              "slide-8-content",

            role: "content",

            hidden: false,

            direction: "column",

            gap: 30,

            horizontalAlign:
              "center",

            verticalAlign:
              "center",

            style: {
              width: "100%",
              height: "100%",

              padding: 72,
            },

            children: [
              {
                type: "text",

                id:
                  "slide-8-title",

                hidden: false,

                variant: "title",

                content:
                  "Interactive elements",
              },

              {
                type: "text",

                id:
                  "slide-8-subtitle",

                hidden: false,

                variant:
                  "subtitle",

                content:
                  "Chart renders 2D math geometry. Gallery and Scripted are interactive; the generic Interactive element remains a placeholder.",
              },

              {
                type: "container",

                id:
                  "future-components-row",

                role: "row",

                hidden: false,

                direction: "row",

                gap: 40,

                horizontalAlign:
                  "center",

                verticalAlign:
                  "center",

                children: [
                  {
                    type: "container",

                    id:
                      "demo-chart-card",

                    hidden: false,

                    direction: "column",

                    gap: 10,

                    horizontalAlign:
                      "center",

                    verticalAlign:
                      "center",

                    style: {
                      width: 280,
                      height: 260,

                      padding: 24,

                      borderRadius:
                        18,

                      background:
                        "rgba(15,23,42,0.82)",

                      border: {
                        width: 1,

                        color:
                          "rgba(34,211,238,0.40)",
                      },
                    },

                    children: [
                      {
                        type: "text",

                        id:
                          "demo-chart-title",

                        hidden: false,

                        variant:
                          "subtitle",

                        content:
                          "Quadratic function",
                      },

                      {
                        type: "chart",

                        id:
                          "demo-chart",

                        hidden: false,

                        source:
                          "y = x^2",

                        layout: {
                          width: 232,
                          height: 180,
                        },
                      },

                      {
                        type: "text",

                        id:
                          "demo-chart-function",

                        hidden: false,

                        variant:
                          "caption",

                        content:
                          "f(x) = x²",
                      },
                    ],
                  },

                  {
                    type:
                      "interactive",

                    id:
                      "demo-interactive",

                    hidden: false,

                    widget:
                      "function-plot",

                    config: {
                      expression:
                        "x^2",
                    },

                    style: {
                      width: 280,
                      height: 180,

                      padding: 24,

                      borderRadius:
                        18,

                      background:
                        "rgba(15,23,42,0.82)",

                      border: {
                        width: 1,

                        color:
                          "rgba(34,211,238,0.40)",
                      },
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  }));

// ============================================================
// END: APRESENTAÇÃO DE DEMONSTRAÇÃO
// ============================================================
