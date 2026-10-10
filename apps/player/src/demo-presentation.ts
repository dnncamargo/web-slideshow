import { PresentationSchema } from "@web-slideshow/document-schema";
import { displayName } from "@web-slideshow/instance-branding";

// Canonical public Demo content authored in the repository-root powershow export.
// The export is intentionally inlined so Player production has no root-file runtime dependency.
const demoDocument = {
  "schemaVersion": 1,
  "id": "presentation-mv1oi2rv-8qovqq",
  "title": `${displayName} Component Showcase`,
  "description": `Visual validation of ${displayName} renderer and theme components.`,
  "aspectRatio": "16:9",
  "textStyles": [
    {
      "id": "system:table-column-header",
      "name": "Column header",
      "role": "body"
    },
    {
      "id": "system:table-cell",
      "name": "Table cell",
      "role": "body"
    },
    {
      "id": "textbox",
      "name": "Textbox",
      "role": "body"
    },
    {
      "id": "subtitle",
      "typography": {
        "fontSize": 23
      }
    }
  ],
  "slides": [
    {
      "id": "slide-1",
      "title": "Visual primitives",
      "summary": "",
      "speakerNotes": "",
      "elements": [
        {
          "id": "container-1",
          "type": "container",
          "hidden": false,
          "children": [
            {
              "id": "container-2",
              "type": "container",
              "role": "content",
              "hidden": false,
              "layout": {
                "width": "100%",
                "height": "100%",
                "padding": 64,
                "children": {
                  "direction": "column",
                  "horizontalAlign": "center",
                  "verticalAlign": "center"
                }
              },
              "style": {
                "background": {
                  "color": "#080b12",
                  "gradient": {
                    "type": "linear",
                    "angle": 135,
                    "stops": [
                      {
                        "color": "#080b12",
                        "position": 0
                      },
                      {
                        "color": "#121b35",
                        "position": 52
                      },
                      {
                        "color": "#23133d",
                        "position": 100
                      }
                    ]
                  },
                  "pattern": {
                    "image": "radial-gradient(circle,rgba(148,163,184,0.20) 1px,transparent 1px)",
                    "size": "24px 24px",
                    "opacity": 0.7
                  }
                }
              },
              "children": [
                {
                  "id": "container-3",
                  "type": "container",
                  "role": "main",
                  "hidden": false,
                  "layout": {
                    "width": "82%",
                    "height": "72%",
                    "padding": 48,
                    "children": {
                      "direction": "column",
                      "gap": 24,
                      "horizontalAlign": "center",
                      "verticalAlign": "center"
                    }
                  },
                  "style": {
                    "background": {
                      "gradient": {
                        "type": "linear",
                        "angle": 145,
                        "stops": [
                          {
                            "color": "rgba(15, 23, 42, 0.96)",
                            "position": 0
                          },
                          {
                            "color": "rgba(30, 41, 59, 0.88)",
                            "position": 55
                          },
                          {
                            "color": "rgba(49, 46, 129, 0.72)",
                            "position": 100
                          }
                        ]
                      }
                    },
                    "border": {
                      "width": 2,
                      "gradient": {
                        "type": "linear",
                        "angle": 135,
                        "stops": [
                          {
                            "color": "#8b5cf6",
                            "position": 0
                          },
                          {
                            "color": "#22d3ee",
                            "position": 100
                          }
                        ]
                      }
                    },
                    "borderRadius": 28
                  },
                  "effect": {
                    "shadow": {
                      "x": 0,
                      "y": 24,
                      "blur": 72,
                      "spread": -16,
                      "color": "rgba(0, 0, 0, 0.58)"
                    }
                  },
                  "children": [
                    {
                      "id": "text-1",
                      "hidden": false,
                      "type": "text",
                      "content": displayName,
                      "variant": "title"
                    },
                    {
                      "id": "text-2",
                      "hidden": false,
                      "type": "text",
                      "content": "Structured for authoring. Native for presenting.",
                      "variant": "subtitle"
                    },
                    {
                      "id": "text-3",
                      "hidden": false,
                      "type": "text",
                      "content": "Background, content and Player navigation are independent visual layers.",
                      "variant": "body"
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "slide-2",
      "title": "Typography",
      "summary": "",
      "speakerNotes": "",
      "elements": [
        {
          "id": "container-4",
          "type": "container",
          "hidden": false,
          "children": [
            {
              "id": "container-5",
              "type": "container",
              "role": "content",
              "hidden": false,
              "layout": {
                "width": "100%",
                "height": "100%",
                "padding": 96,
                "children": {
                  "direction": "column",
                  "gap": 22,
                  "horizontalAlign": "start",
                  "verticalAlign": "center"
                }
              },
              "style": {
                "background": {
                  "gradient": {
                    "type": "linear",
                    "angle": 125,
                    "stops": [
                      {
                        "color": "#07111f",
                        "position": 0
                      },
                      {
                        "color": "#172554",
                        "position": 100
                      }
                    ]
                  },
                  "pattern": {
                    "image": "linear-gradient(rgba(148,163,184,0.08) 1px,transparent 1px)",
                    "size": "100% 32px",
                    "opacity": 0.7
                  }
                }
              },
              "children": [
                {
                  "id": "text-4",
                  "hidden": false,
                  "type": "text",
                  "content": "Presentation typography",
                  "variant": "title"
                },
                {
                  "id": "text-5",
                  "hidden": false,
                  "type": "text",
                  "content": "A structural hierarchy without exposing CSS.",
                  "variant": "subtitle"
                },
                {
                  "id": "text-6",
                  "hidden": false,
                  "type": "text",
                  "content": "Body text is intended for explanations, supporting information and normal slide content. The theme provides readable defaults while the document can still override selected visual properties.",
                  "variant": "body"
                },
                {
                  "id": "text-7",
                  "hidden": false,
                  "type": "text",
                  "content": "Caption — secondary information and contextual notes.",
                  "variant": "caption"
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "slide-3",
      "title": "Text and content",
      "summary": "",
      "speakerNotes": "",
      "elements": [
        {
          "id": "container-6",
          "type": "container",
          "hidden": false,
          "children": [
            {
              "id": "container-7",
              "type": "container",
              "role": "content",
              "hidden": false,
              "layout": {
                "width": "100%",
                "height": "100%",
                "padding": 72,
                "children": {
                  "direction": "column",
                  "gap": 30,
                  "horizontalAlign": "center",
                  "verticalAlign": "center"
                }
              },
              "style": {
                "background": {
                  "color": "#0b1020",
                  "pattern": {
                    "image": "linear-gradient(rgba(99,102,241,0.14) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,0.14) 1px,transparent 1px)",
                    "size": "36px 36px",
                    "opacity": 0.65
                  }
                }
              },
              "children": [
                {
                  "id": "text-8",
                  "hidden": false,
                  "type": "text",
                  "content": "Text and content panels",
                  "variant": "title"
                },
                {
                  "id": "container-8",
                  "type": "container",
                  "role": "main",
                  "hidden": false,
                  "layout": {
                    "width": "76%",
                    "padding": 36,
                    "children": {
                      "direction": "column",
                      "gap": 20
                    }
                  },
                  "style": {
                    "background": {
                      "color": "rgba(15, 23, 42, 0.88)"
                    },
                    "border": {
                      "width": 1,
                      "style": "solid",
                      "color": "rgba(148, 163, 184, 0.24)"
                    },
                    "borderRadius": 20
                  },
                  "effect": {
                    "shadow": {
                      "x": 0,
                      "y": 18,
                      "blur": 48,
                      "spread": -12,
                      "color": "rgba(0, 0, 0, 0.55)"
                    }
                  },
                  "children": [
                    {
                      "id": "text-9",
                      "hidden": false,
                      "type": "text",
                      "content": "Text blocks are designed for normal blocks of textual content. Their baseline typography comes from the shared theme.",
                      "variant": "body"
                    },
                    {
                      "id": "text-10",
                      "hidden": false,
                      "type": "text",
                      "content": "The author should not need to understand font-family, line-height, CSS selectors or browser layout rules to create a readable slide.",
                      "variant": "body",
                      "style": {
                        "color": "#a5b4fc"
                      }
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "slide-4",
      "title": "Code",
      "summary": "",
      "speakerNotes": "",
      "elements": [
        {
          "id": "container-9",
          "type": "container",
          "hidden": false,
          "children": [
            {
              "id": "container-10",
              "type": "container",
              "role": "content",
              "hidden": false,
              "layout": {
                "width": "100%",
                "height": "100%",
                "padding": 72,
                "children": {
                  "direction": "column",
                  "gap": 26,
                  "horizontalAlign": "center",
                  "verticalAlign": "center"
                }
              },
              "style": {
                "background": {
                  "gradient": {
                    "type": "radial",
                    "shape": "ellipse",
                    "stops": [
                      {
                        "color": "#183a52",
                        "position": 0
                      },
                      {
                        "color": "#0d1d2c",
                        "position": 48
                      },
                      {
                        "color": "#05090f",
                        "position": 100
                      }
                    ]
                  },
                  "pattern": {
                    "image": "linear-gradient(rgba(125,211,252,0.10) 1px,transparent 1px),linear-gradient(90deg,rgba(125,211,252,0.10) 1px,transparent 1px)",
                    "size": "32px 32px",
                    "opacity": 0.7
                  }
                }
              },
              "children": [
                {
                  "id": "text-11",
                  "hidden": false,
                  "type": "text",
                  "content": "Native HTML rendering",
                  "variant": "title"
                },
                {
                  "id": "code-1",
                  "hidden": false,
                  "layout": {
                    "width": "76%"
                  },
                  "type": "code",
                  "code": "const slide = presentation.slides[index];\nconst html = renderSlide(slide);\nslideHost.innerHTML = html;\nplayer.showControls();",
                  "language": "typescript",
                  "showLineNumbers": true,
                  "highlightedLines": [
                    2,
                    3
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "slide-5",
      "title": "Terminal",
      "summary": "",
      "speakerNotes": "",
      "elements": [
        {
          "id": "container-11",
          "type": "container",
          "hidden": false,
          "children": [
            {
              "id": "container-12",
              "type": "container",
              "role": "content",
              "hidden": false,
              "layout": {
                "width": "100%",
                "height": "100%",
                "padding": 72,
                "children": {
                  "direction": "column",
                  "gap": 28,
                  "horizontalAlign": "center",
                  "verticalAlign": "center"
                }
              },
              "style": {
                "background": {
                  "gradient": {
                    "type": "linear",
                    "angle": 120,
                    "stops": [
                      {
                        "color": "#050505",
                        "position": 0
                      },
                      {
                        "color": "#101513",
                        "position": 55
                      },
                      {
                        "color": "#092019",
                        "position": 100
                      }
                    ]
                  },
                  "pattern": {
                    "image": "repeating-linear-gradient(45deg,rgba(52,211,153,0.09) 0,rgba(52,211,153,0.09) 1px,transparent 1px,transparent 28px)",
                    "opacity": 0.8
                  }
                }
              },
              "children": [
                {
                  "id": "text-12",
                  "hidden": false,
                  "type": "text",
                  "content": "Terminal component",
                  "variant": "title"
                },
                {
                  "id": "container-13",
                  "type": "container",
                  "role": "main",
                  "hidden": false,
                  "layout": {
                    "width": "70%",
                    "height": "60%",
                    "padding": 28,
                    "children": {
                      "direction": "column"
                    }
                  },
                  "style": {
                    "background": {
                      "color": "rgba(3, 7, 6, 0.76)"
                    },
                    "border": {
                      "width": 1,
                      "color": "rgba(52, 211, 153, 0.28)"
                    },
                    "borderRadius": 22
                  },
                  "effect": {
                    "shadow": {
                      "x": 0,
                      "y": 24,
                      "blur": 64,
                      "spread": -12,
                      "color": "rgba(0, 0, 0, 0.72)"
                    }
                  },
                  "children": [
                    {
                      "id": "terminal-1",
                      "hidden": false,
                      "type": "terminal",
                      "title": displayName,
                      "lines": [
                        {
                          "type": "command",
                          "content": "pnpm --filter @web-slideshow/player dev"
                        },
                        {
                          "type": "output",
                          "content": `${displayName} Player running`
                        },
                        {
                          "type": "comment",
                          "content": "Renderer connected successfully"
                        },
                        {
                          "type": "error",
                          "content": "Example error message for visual validation"
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "slide-6",
      "title": "Table",
      "summary": "",
      "speakerNotes": "",
      "elements": [
        {
          "id": "container-14",
          "type": "container",
          "hidden": false,
          "children": [
            {
              "id": "container-15",
              "type": "container",
              "role": "content",
              "hidden": false,
              "layout": {
                "width": "100%",
                "height": "100%",
                "padding": 59,
                "children": {
                  "direction": "column",
                  "gap": 28,
                  "horizontalAlign": "center",
                  "verticalAlign": "center"
                }
              },
              "style": {
                "background": {
                  "gradient": {
                    "type": "linear",
                    "angle": 145,
                    "stops": [
                      {
                        "color": "#111827",
                        "position": 0
                      },
                      {
                        "color": "#172033",
                        "position": 100
                      }
                    ]
                  },
                  "pattern": {
                    "image": "linear-gradient(90deg,rgba(148,163,184,0.07) 1px,transparent 1px)",
                    "size": "40px 100%",
                    "opacity": 0.8
                  }
                }
              },
              "children": [
                {
                  "id": "text-13",
                  "hidden": false,
                  "type": "text",
                  "content": "Structured tables",
                  "variant": "title"
                },
                {
                  "id": "text-14",
                  "hidden": false,
                  "type": "text",
                  "content": "Semantic data without requiring HTML tables from the author.",
                  "variant": "subtitle"
                },
                {
                  "id": "table-element-copy-2",
                  "hidden": false,
                  "layout": {
                    "width": 701.0333,
                    "height": 276.7003
                  },
                  "type": "table",
                  "style": {
                    "headerBackground": "#20203e"
                  },
                  "mode": "structured",
                  "showHeader": true,
                  "columns": [
                    {
                      "id": "table-column-copy-2",
                      "header": {
                        "id": "table-header-slot-copy-2",
                        "children": [
                          {
                            "id": "table-header-text-copy-2",
                            "hidden": false,
                            "type": "text",
                            "content": "Component",
                            "variant": "system:table-column-header"
                          }
                        ]
                      }
                    },
                    {
                      "id": "table-column-2-copy-2",
                      "header": {
                        "id": "table-header-slot-2-copy-2",
                        "children": [
                          {
                            "id": "table-header-text-2-copy-2",
                            "hidden": false,
                            "type": "text",
                            "content": "Purpose",
                            "variant": "system:table-column-header"
                          }
                        ]
                      }
                    },
                    {
                      "id": "table-column-3-copy-2",
                      "header": {
                        "id": "table-header-slot-3-copy-2",
                        "children": [
                          {
                            "id": "table-header-text-3-copy-2",
                            "hidden": false,
                            "type": "text",
                            "content": "Status",
                            "variant": "system:table-column-header"
                          }
                        ]
                      }
                    }
                  ],
                  "rows": [
                    {
                      "id": "table-row-copy-2",
                      "cells": [
                        {
                          "id": "table-cell-slot-copy-2",
                          "children": [
                            {
                              "id": "table-cell-text-copy-2",
                              "hidden": false,
                              "type": "text",
                              "content": "Text",
                              "variant": "system:table-cell"
                            }
                          ]
                        },
                        {
                          "id": "table-cell-slot-2-copy-2",
                          "children": [
                            {
                              "id": "table-text-copy-2",
                              "hidden": false,
                              "type": "text",
                              "content": "Presentation typography",
                              "variant": "system:table-cell"
                            }
                          ]
                        },
                        {
                          "id": "table-cell-slot-3-copy-2",
                          "children": [
                            {
                              "id": "table-text-2-copy-2",
                              "hidden": false,
                              "type": "text",
                              "content": "Ready",
                              "variant": "system:table-cell"
                            }
                          ]
                        }
                      ]
                    },
                    {
                      "id": "table-row-2-copy-2",
                      "cells": [
                        {
                          "id": "table-cell-slot-4-copy-2",
                          "children": [
                            {
                              "id": "table-text-3-copy-2",
                              "hidden": false,
                              "type": "text",
                              "content": "Code",
                              "variant": "system:table-cell"
                            }
                          ]
                        },
                        {
                          "id": "table-cell-slot-5-copy-2",
                          "children": [
                            {
                              "id": "table-text-4-copy-2",
                              "hidden": false,
                              "type": "text",
                              "content": "Source examples",
                              "variant": "system:table-cell"
                            }
                          ]
                        },
                        {
                          "id": "table-cell-slot-6-copy-2",
                          "children": [
                            {
                              "id": "table-text-5-copy-2",
                              "hidden": false,
                              "type": "text",
                              "content": "Ready",
                              "variant": "system:table-cell"
                            }
                          ]
                        }
                      ]
                    },
                    {
                      "id": "table-row-3-copy-2",
                      "cells": [
                        {
                          "id": "table-cell-slot-7-copy-2",
                          "children": [
                            {
                              "id": "table-text-6-copy-2",
                              "hidden": false,
                              "type": "text",
                              "content": "Terminal",
                              "variant": "system:table-cell"
                            }
                          ]
                        },
                        {
                          "id": "table-cell-slot-8-copy-2",
                          "children": [
                            {
                              "id": "table-text-7-copy-2",
                              "hidden": false,
                              "type": "text",
                              "content": "Command-line demonstrations",
                              "variant": "system:table-cell"
                            }
                          ]
                        },
                        {
                          "id": "table-cell-slot-9-copy-2",
                          "children": [
                            {
                              "id": "table-text-8-copy-2",
                              "hidden": false,
                              "type": "text",
                              "content": "Ready",
                              "variant": "system:table-cell"
                            }
                          ]
                        }
                      ]
                    },
                    {
                      "id": "table-row-copy-3",
                      "cells": [
                        {
                          "id": "table-cell-slot-copy-3",
                          "children": [
                            {
                              "id": "table-text-copy-3",
                              "hidden": false,
                              "type": "text",
                              "content": "Table",
                              "variant": "system:table-cell"
                            }
                          ]
                        },
                        {
                          "id": "table-cell-slot-2-copy-3",
                          "children": [
                            {
                              "id": "table-text-2-copy-3",
                              "hidden": false,
                              "type": "text",
                              "content": "Structured information",
                              "variant": "system:table-cell"
                            }
                          ]
                        },
                        {
                          "id": "table-cell-slot-3-copy-3",
                          "children": [
                            {
                              "id": "table-text-3-copy-3",
                              "hidden": false,
                              "type": "text",
                              "content": "Ready",
                              "variant": "system:table-cell"
                            }
                          ]
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "slide",
      "title": "Scripted",
      "summary": "",
      "speakerNotes": "",
      "elements": [
        {
          "id": "container-element-2-root",
          "type": "container",
          "hidden": false,
          "children": [
            {
              "id": "container-element-2",
              "type": "container",
              "hidden": false,
              "layout": {
                "width": "100%",
                "height": "100%",
                "padding": 24,
                "children": {
                  "gap": 16,
                  "horizontalAlign": "center",
                  "verticalAlign": "center"
                }
              },
              "style": {
                "background": {
                  "color": "rgba(15, 23, 42, 0.55)",
                  "pattern": {
                    "image": "repeating-linear-gradient(to right, transparent 0, transparent 3.33px, var(--presentation-pattern-background-color) 3.33px, var(--presentation-pattern-background-color) 10px, transparent 10px, transparent 13.33px), repeating-linear-gradient(to bottom, transparent 0, transparent 3.33px, var(--presentation-pattern-background-color) 3.33px, var(--presentation-pattern-background-color) 10px, transparent 10px, transparent 13.33px), linear-gradient(to bottom, var(--presentation-pattern-color-1) 1.2px, transparent 1.2px), linear-gradient(to right, var(--presentation-pattern-color-1) 1.2px, transparent 1.2px)",
                    "size": "100% 100%, 100% 100%, 40px 40px, 40px 40px",
                    "position": "0 0, 0 0, 0 -0.4px, -0.4px 0",
                    "repeat": "repeat",
                    "colors": [
                      "#444cf7"
                    ]
                  }
                }
              },
              "children": [
                {
                  "id": "text-element-2",
                  "hidden": false,
                  "type": "text",
                  "content": "Scripted: local HTML, CSS, and JavaScript",
                  "variant": "title"
                },
                {
                  "id": "text-element-3",
                  "hidden": false,
                  "type": "text",
                  "content": "A sandboxed iframe can provide meaningful local interaction without Firebase, Live sessions, or parent application access.",
                  "variant": "subtitle"
                },
                {
                  "id": "scripted-element",
                  "hidden": false,
                  "layout": {
                    "width": "62.5713%",
                    "height": "59.6545%"
                  },
                  "style": {
                    "border": {
                      "width": 4,
                      "style": "solid",
                      "color": "#94a3b8"
                    },
                    "borderRadius": 33
                  },
                  "type": "scripted",
                  "title": "Scripted content",
                  "html": "<div class=\"circuit-app\">\n  <div class=\"controls\">\n    <label>\n      <span>Tensão da Fonte (V)</span>\n      <input id=\"voltage\" type=\"number\" min=\"1\" max=\"240\" step=\"1\" value=\"12\" />\n    </label>\n    <label>\n      <span>Resistência (Ω)</span>\n      <input id=\"resistance\" type=\"number\" min=\"1\" max=\"1000\" step=\"1\" value=\"100\" />\n    </label>\n    <div class=\"current-readout\">\n      Corrente: <span id=\"current\">0.12</span> A\n    </div>\n  </div>\n\n  <div class=\"circuit-stage\">\n    <!-- Um viewBox retangular amplia o circuito sem deformá-lo. -->\n    <svg xmlns=\"http://www.w3.org/2000/svg\"\n         viewBox=\"20 82 470 248\"\n         preserveAspectRatio=\"xMidYMid meet\"\n         role=\"img\"\n         aria-label=\"Circuito elétrico com lâmpada, fonte, resistência e chave interativa\">\n      <!-- Fios visíveis com interrupções nos componentes. -->\n      <path id=\"wirePath\"\n            d=\"M 72.031 102.635 H 172.031\n               M 212.031 102.635 H 433.047 V 187.08\n               M 433.047 207.08 V 290.825 H 304.92\n               M 204.92 290.825 H 72.031 V 237.159\n               M 72.031 164.159 V 102.635\"\n            fill=\"none\" stroke=\"#2ecc71\" stroke-width=\"6\"\n            stroke-linecap=\"round\" stroke-linejoin=\"round\" />\n\n      <!-- Trajetória contínua apenas para o movimento dos elétrons. -->\n      <path id=\"electronPath\"\n            d=\"M 72.031 102.635 H 433.047 V 290.825 H 72.031 Z\"\n            fill=\"none\" stroke=\"none\" pointer-events=\"none\" />\n\n      <!-- Chave. O braço gira em torno do contato esquerdo. -->\n      <g id=\"switchControl\" role=\"button\" tabindex=\"0\"\n         aria-label=\"Abrir ou fechar a chave do circuito\"\n         aria-pressed=\"true\">\n        <circle cx=\"172.031\" cy=\"102.635\" r=\"5\" fill=\"#2c3e50\" />\n        <circle cx=\"212.031\" cy=\"102.635\" r=\"5\" fill=\"#2c3e50\" />\n        <line id=\"switchArm\" x1=\"172.031\" y1=\"102.635\"\n              x2=\"212.031\" y2=\"102.635\"\n              stroke=\"#2c3e50\" stroke-width=\"5\" stroke-linecap=\"round\" />\n        <line x1=\"172.031\" y1=\"102.635\" x2=\"212.031\" y2=\"102.635\"\n              stroke=\"transparent\" stroke-width=\"26\" pointer-events=\"stroke\" />\n      </g>\n\n      <!-- Fonte. -->\n      <line x1=\"392.031\" y1=\"187.08\" x2=\"472.031\" y2=\"187.08\"\n            stroke=\"#2c3e50\" stroke-width=\"4\" />\n      <line x1=\"412.031\" y1=\"207.08\" x2=\"452.031\" y2=\"207.08\"\n            stroke=\"#2c3e50\" stroke-width=\"4\" />\n\n      <!-- Resistência com R centralizado nos dois eixos. -->\n      <rect x=\"204.92\" y=\"270.825\" width=\"100\" height=\"40\"\n            fill=\"#d4d4d4\" stroke=\"#2c3e50\" stroke-width=\"3\" />\n      <text x=\"254.92\" y=\"290.825\" text-anchor=\"middle\"\n            dominant-baseline=\"middle\" font-size=\"20\" font-weight=\"700\"\n            fill=\"#3d3a3a\">R</text>\n\n      <!-- Lâmpada. -->\n      <circle id=\"lamp\" cx=\"73.047\" cy=\"192.159\" r=\"28\"\n              fill=\"#f1c40f\" stroke=\"#2c3e50\" stroke-width=\"4\" />\n      <rect x=\"58.047\" y=\"219.159\" width=\"30\" height=\"18\"\n            fill=\"#bdc3c7\" stroke=\"#2c3e50\" stroke-width=\"3\" />\n\n      <!-- Sem transform: posições nas coordenadas do próprio SVG. -->\n      <g id=\"electrons\" pointer-events=\"none\"></g>\n    </svg>\n  </div>\n</div>\n",
                  "css": "html,\nbody,\n#scripted-runtime-root {\n  margin: 0;\n  width: 100%;\n  height: 100%;\n  overflow: hidden;\n  background: #d4d4d4;\n  font-family: Arial, sans-serif;\n  color: #3d3a3a;\n}\n\n.circuit-app {\n  box-sizing: border-box;\n  width: 100%;\n  height: 100%;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  gap: 0;\n}\n\n.controls {\n  display: flex;\n  gap: clamp(10px, 2.5vw, 24px);\n  flex-wrap: wrap;\n  justify-content: center;\n  align-items: end;\n  max-width: 100%;\n  padding: 10px 18px;\n  border-radius: 12px;\n  background: rgba(148, 163, 184, 0.15);\n  box-sizing: border-box;\n}\n\n.controls label {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  font-size: 14px;\n  font-weight: 600;\n}\n\n.controls input {\n  width: 100px;\n  padding: 6px;\n  border: 2px solid #db5b05;\n  border-radius: 6px;\n  background: #fff;\n  color: #111;\n  box-sizing: border-box;\n}\n\n.current-readout {\n  font-weight: 700;\n  font-size: 16px;\n  align-self: center;\n  padding-bottom: 7px;\n}\n\n.circuit-stage {\n  flex: 1;\n  min-height: 0;\n  width: 100%;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n}\n\n.circuit-stage svg {\n  display: block;\n  width: 100%;\n  height: 100%;\n  max-width: none;\n  max-height: none;\n}\n\n#switchControl {\n  cursor: pointer;\n  outline: none;\n}\n\n#switchControl:focus-visible circle {\n  stroke: #db5b05;\n  stroke-width: 3;\n}\n\n#switchArm {\n  transform-box: view-box;\n  transform-origin: 172.031px 102.635px;\n  transition: transform 0.3s;\n}\n\n#lamp {\n  transition: fill 0.2s, filter 0.2s;\n}\n",
                  "script": "(() => {\n  const voltageInput = document.getElementById('voltage');\n  const resistanceInput = document.getElementById('resistance');\n  const currentSpan = document.getElementById('current');\n  const switchControl = document.getElementById('switchControl');\n  const switchArm = document.getElementById('switchArm');\n  const lamp = document.getElementById('lamp');\n  const wire = document.getElementById('wirePath');\n  const electronPath = document.getElementById('electronPath');\n  const electronsGroup = document.getElementById('electrons');\n\n  let voltage = 12;\n  let resistance = 100;\n  let closed = true;\n  let current = 0;\n  let speed = 0;\n\n  const electronCount = 18;\n  const electrons = [];\n  for (let i = 0; i < electronCount; i += 1) {\n    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');\n    circle.setAttribute('r', '4');\n    circle.setAttribute('fill', '#f1c40f');\n    electronsGroup.appendChild(circle);\n    electrons.push({ el: circle, offset: i / electronCount });\n  }\n\n  const pathLength = electronPath.getTotalLength();\n\n  function updatePhysics() {\n    current = closed ? voltage / resistance : 0;\n    currentSpan.textContent = current.toFixed(2);\n    const glow = Math.min(current / 2, 1);\n    lamp.style.filter = closed\n      ? `drop-shadow(0 0 ${glow * 25}px rgba(255,223,0,.9))`\n      : 'none';\n    speed = current > 0 ? Math.min(280, Math.max(28, current * 120)) : 0;\n  }\n\n  function updateSwitch() {\n    switchArm.style.transform = closed ? 'rotate(0deg)' : 'rotate(-35deg)';\n    switchControl.setAttribute('aria-pressed', String(closed));\n    wire.setAttribute('stroke', closed ? '#2ecc71' : '#95a5a6');\n    lamp.setAttribute('fill', closed ? '#f1c40f' : '#bdc3c7');\n  }\n\n  // Scripted só permite usar portas declaradas no Inspector.\n  // A animação funciona mesmo se nenhuma porta tiver sido configurada.\n  const portsApi = typeof ScriptedRuntime !== 'undefined'\n    ? ScriptedRuntime.ports\n    : null;\n  const declaredPorts = portsApi && typeof portsApi.list === 'function'\n    ? portsApi.list()\n    : [];\n\n  function portFor(id, kind, direction) {\n    return declaredPorts.find(port =>\n      port.id === id &&\n      port.kind === kind &&\n      (port.direction === direction || port.direction === 'input-output')\n    );\n  }\n\n  function report(id, value) {\n    const kind = typeof value === 'boolean' ? 'boolean' : 'number';\n    const port = portFor(id, kind, 'output');\n    if (!port) return;\n    if (kind === 'number' &&\n        ((port.min !== undefined && value < port.min) ||\n         (port.max !== undefined && value > port.max))) return;\n    portsApi.report(id, value);\n  }\n\n  function onPortInput(id, kind, handler) {\n    if (portFor(id, kind, 'input')) portsApi.onInput(id, handler);\n  }\n\n  function applyVoltage(value, shouldReport) {\n    if (typeof value !== 'number' || !Number.isFinite(value) || value < 1 || value > 240) return;\n    voltage = value;\n    voltageInput.value = String(value);\n    updatePhysics();\n    if (shouldReport) report('tensao', voltage);\n  }\n\n  function applyResistance(value, shouldReport) {\n    if (typeof value !== 'number' || !Number.isFinite(value) || value < 1 || value > 1000) return;\n    resistance = value;\n    resistanceInput.value = String(value);\n    updatePhysics();\n    if (shouldReport) report('resistencia', resistance);\n  }\n\n  function applySwitch(value, shouldReport) {\n    if (typeof value !== 'boolean') return;\n    closed = value;\n    updateSwitch();\n    updatePhysics();\n    if (shouldReport) report('chave', closed);\n  }\n\n  onPortInput('chave', 'boolean', value => applySwitch(value, true));\n  onPortInput('resistencia', 'number', value => applyResistance(value, true));\n  onPortInput('tensao', 'number', value => applyVoltage(value, true));\n\n  voltageInput.addEventListener('input', () => {\n    const value = Number(voltageInput.value);\n    if (Number.isFinite(value)) applyVoltage(value, true);\n  });\n  resistanceInput.addEventListener('input', () => {\n    const value = Number(resistanceInput.value);\n    if (Number.isFinite(value)) applyResistance(value, true);\n  });\n\n  switchControl.addEventListener('click', () => applySwitch(!closed, true));\n  switchControl.addEventListener('keydown', event => {\n    if (event.key === 'Enter' || event.key === ' ') {\n      event.preventDefault();\n      applySwitch(!closed, true);\n    }\n  });\n\n  // Mantém os elétrons nos trechos livres dos fios, sem sobrepor os símbolos.\n  function onVisibleWire(point) {\n    const x = point.x;\n    const y = point.y;\n    if (x < 76 && y > 160 && y < 240) return false; // lâmpada\n    if (x > 429 && y > 183 && y < 211) return false; // bateria\n    if (y > 287 && x > 201 && x < 309) return false; // resistência\n    if (y < 107 && x > 169 && x < 215) return false; // chave\n    return true;\n  }\n\n  let previousTimestamp;\n  function animate(timestamp) {\n    const dt = previousTimestamp === undefined\n      ? 0\n      : Math.min((timestamp - previousTimestamp) / 1000, 0.05);\n    previousTimestamp = timestamp;\n\n    for (const electron of electrons) {\n      if (!closed) {\n        electron.el.style.display = 'none';\n        continue;\n      }\n      electron.offset = (electron.offset + (speed * dt) / pathLength) % 1;\n      const point = electronPath.getPointAtLength(electron.offset * pathLength);\n      electron.el.setAttribute('cx', String(point.x));\n      electron.el.setAttribute('cy', String(point.y));\n      electron.el.style.display = onVisibleWire(point) ? 'block' : 'none';\n    }\n    requestAnimationFrame(animate);\n  }\n\n  updateSwitch();\n  updatePhysics();\n\n  // A animação não pode depender de report() nem do registro das portas.\n  requestAnimationFrame(animate);\n  requestAnimationFrame(() => {\n    report('chave', closed);\n    report('resistencia', resistance);\n    report('tensao', voltage);\n  });\n})();\n",
                  "ports": [
                    {
                      "id": "chave",
                      "label": "Chave",
                      "kind": "boolean",
                      "direction": "input-output"
                    },
                    {
                      "id": "resistencia",
                      "label": "Resistencia",
                      "kind": "number",
                      "direction": "input-output",
                      "min": 1,
                      "max": 1000
                    },
                    {
                      "id": "tensao",
                      "label": "Tensão",
                      "kind": "number",
                      "direction": "input",
                      "min": 1,
                      "max": 240,
                      "step": 1
                    }
                  ],
                  "resourceIds": []
                }
              ]
            }
          ]
        }
      ],
      "background": {
        "color": "#0b1020"
      }
    },
    {
      "id": "slide-7",
      "title": "Images",
      "summary": "",
      "speakerNotes": "",
      "elements": [
        {
          "id": "container-16",
          "type": "container",
          "hidden": false,
          "children": [
            {
              "id": "container-17",
              "type": "container",
              "role": "content",
              "hidden": false,
              "layout": {
                "width": "100%",
                "height": "100%",
                "padding": 64,
                "children": {
                  "direction": "column",
                  "gap": 30,
                  "horizontalAlign": "center",
                  "verticalAlign": "center"
                }
              },
              "style": {
                "background": {
                  "gradient": {
                    "type": "linear",
                    "angle": 135,
                    "stops": [
                      {
                        "color": "#120b24",
                        "position": 0
                      },
                      {
                        "color": "#17112d",
                        "position": 50
                      },
                      {
                        "color": "#061724",
                        "position": 100
                      }
                    ]
                  },
                  "pattern": {
                    "image": "linear-gradient(transparent,transparent)",
                    "opacity": 0
                  }
                }
              },
              "children": [
                {
                  "id": "text-15",
                  "hidden": false,
                  "type": "text",
                  "content": "Image fitting and Gallery",
                  "variant": "title"
                },
                {
                  "id": "container-18",
                  "type": "container",
                  "role": "row",
                  "hidden": false,
                  "layout": {
                    "width": "107.1614%",
                    "children": {
                      "direction": "row",
                      "gap": 30,
                      "horizontalAlign": "center",
                      "verticalAlign": "center"
                    }
                  },
                  "children": [
                    {
                      "id": "container-19",
                      "type": "container",
                      "role": "column",
                      "hidden": false,
                      "layout": {
                        "children": {
                          "direction": "column",
                          "gap": 14,
                          "horizontalAlign": "center"
                        }
                      },
                      "children": [
                        {
                          "id": "text-16",
                          "hidden": false,
                          "type": "text",
                          "content": "contain",
                          "variant": "subtitle"
                        },
                        {
                          "id": "container-20",
                          "type": "container",
                          "hidden": false,
                          "style": {
                            "background": {
                              "color": "rgba(15, 23, 42, 0.72)"
                            }
                          },
                          "children": [
                            {
                              "id": "image-1",
                              "type": "image",
                              "hidden": false,
                              "layout": {
                                "width": 240,
                                "height": 240
                              },
                              "style": {
                                "border": {
                                  "width": 1,
                                  "color": "rgba(148, 163, 184, 0.28)"
                                },
                                "borderRadius": 18
                              },
                              "alt": `${displayName} demo graphic using contain`,
                              "fit": "contain",
                              "src": "https://plus.unsplash.com/premium_photo-1677545183884-421157b2da02?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTF8fGdhdG9zJTIwZm9mb3N8ZW58MHx8MHx8fDA%3D"
                            }
                          ]
                        }
                      ]
                    },
                    {
                      "id": "container-21",
                      "type": "container",
                      "role": "column",
                      "hidden": false,
                      "layout": {
                        "children": {
                          "direction": "column",
                          "gap": 14,
                          "horizontalAlign": "center"
                        }
                      },
                      "children": [
                        {
                          "id": "text-17",
                          "hidden": false,
                          "type": "text",
                          "content": "cover",
                          "variant": "subtitle"
                        },
                        {
                          "id": "image-2",
                          "type": "image",
                          "hidden": false,
                          "layout": {
                            "width": 240,
                            "height": 240
                          },
                          "style": {
                            "border": {
                              "width": 1,
                              "color": "rgba(148, 163, 184, 0.28)"
                            },
                            "borderRadius": 18
                          },
                          "alt": `${displayName} demo graphic using cover`,
                          "fit": "cover",
                          "src": "https://plus.unsplash.com/premium_photo-1677545183884-421157b2da02?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTF8fGdhdG9zJTIwZm9mb3N8ZW58MHx8MHx8fDA%3D"
                        }
                      ]
                    },
                    {
                      "id": "container-22",
                      "type": "container",
                      "role": "column",
                      "hidden": false,
                      "layout": {
                        "children": {
                          "direction": "column",
                          "gap": 14,
                          "horizontalAlign": "center"
                        }
                      },
                      "children": [
                        {
                          "id": "text-18",
                          "hidden": false,
                          "type": "text",
                          "content": "fill",
                          "variant": "subtitle"
                        },
                        {
                          "id": "image-3",
                          "type": "image",
                          "hidden": false,
                          "layout": {
                            "width": 240,
                            "height": 240
                          },
                          "style": {
                            "border": {
                              "width": 1,
                              "color": "rgba(148, 163, 184, 0.28)"
                            },
                            "borderRadius": 18
                          },
                          "alt": `${displayName} demo graphic using fill`,
                          "fit": "fill",
                          "src": "https://plus.unsplash.com/premium_photo-1677545183884-421157b2da02?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTF8fGdhdG9zJTIwZm9mb3N8ZW58MHx8MHx8fDA%3D"
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "id": "slide-8",
      "title": "Plot and interaction",
      "summary": "",
      "speakerNotes": "",
      "elements": [
        {
          "id": "container-23",
          "type": "container",
          "hidden": false,
          "children": [
            {
              "id": "container-24",
              "type": "container",
              "role": "content",
              "hidden": false,
              "layout": {
                "width": "100%",
                "height": "100%",
                "padding": 52,
                "children": {
                  "direction": "column",
                  "gap": 27,
                  "horizontalAlign": "center",
                  "verticalAlign": "center"
                }
              },
              "style": {
                "background": {
                  "color": "#080b12",
                  "pattern": {
                    "image": "radial-gradient(circle,rgba(139,92,246,0.18) 1px,transparent 1px)",
                    "size": "26px 26px",
                    "opacity": 0.8
                  }
                }
              },
              "children": [
                {
                  "id": "text-19",
                  "hidden": false,
                  "type": "text",
                  "content": "Plot and interaction",
                  "variant": "title"
                },
                {
                  "id": "text-20",
                  "hidden": false,
                  "type": "text",
                  "content": "Math intent stays in the document while the renderer owns the SVG geometry.",
                  "variant": "subtitle"
                },
                {
                  "id": "container-25",
                  "type": "container",
                  "role": "row",
                  "hidden": false,
                  "layout": {
                    "height": "89.5654%",
                    "children": {
                      "direction": "row",
                      "gap": 40,
                      "horizontalAlign": "center",
                      "verticalAlign": "center"
                    }
                  },
                  "children": [
                    {
                      "id": "container-26",
                      "type": "container",
                      "hidden": false,
                      "layout": {
                        "width": "36%",
                        "height": "91%",
                        "padding": 24,
                        "paddingRight": 0,
                        "paddingBottom": 0,
                        "paddingLeft": 0,
                        "children": {
                          "direction": "column",
                          "gap": 10,
                          "distribution": "space-between",
                          "horizontalAlign": "center",
                          "verticalAlign": "center"
                        }
                      },
                      "style": {
                        "background": {
                          "color": "rgba(15, 23, 42, 0.82)"
                        },
                        "border": {
                          "width": 1,
                          "color": "rgba(34, 211, 238, 0.4)"
                        },
                        "borderRadius": 18
                      },
                      "children": [
                        {
                          "id": "text-21",
                          "hidden": false,
                          "type": "text",
                          "content": "trigonometric functions",
                          "variant": "textbox"
                        },
                        {
                          "id": "container-element",
                          "type": "container",
                          "hidden": false,
                          "layout": {
                            "width": "74.5432%",
                            "height": "76.7243%",
                            "padding": 0,
                            "children": {
                              "mode": "stack",
                              "gap": 0,
                              "horizontalAlign": "center",
                              "verticalAlign": "center"
                            }
                          },
                          "style": {
                            "background": {}
                          },
                          "children": [
                            {
                              "id": "plot-element-2",
                              "hidden": false,
                              "layout": {
                                "width": "100%",
                                "height": "100%"
                              },
                              "type": "plot",
                              "source": "y = 2*sin(x+t)",
                              "fitToAxes": false,
                              "showAxes": true,
                              "style": {
                                "color": "#c4a000"
                              },
                              "animation": {
                                "parameter": "t",
                                "from": 0,
                                "to": 6.283185307179586,
                                "durationMs": 4000
                              }
                            },
                            {
                              "id": "plot-element-2-copy",
                              "hidden": false,
                              "layout": {
                                "width": "100%",
                                "height": "100%"
                              },
                              "type": "plot",
                              "source": "y = 4*cos(x+t)",
                              "fitToAxes": false,
                              "showAxes": false,
                              "style": {
                                "color": "#4b18ab"
                              },
                              "animation": {
                                "parameter": "t",
                                "from": 0,
                                "to": 6.283185307179586,
                                "durationMs": 4000
                              }
                            },
                            {
                              "id": "plot-element-2-copy-2",
                              "hidden": false,
                              "layout": {
                                "width": "98%",
                                "height": "98%"
                              },
                              "type": "plot",
                              "source": "y = sin(x+t) + cos(x+t)",
                              "fitToAxes": false,
                              "showAxes": false,
                              "style": {
                                "color": "#e96b6b"
                              },
                              "animation": {
                                "parameter": "t",
                                "from": 0,
                                "to": 6.283185307179586,
                                "durationMs": 4000
                              }
                            }
                          ]
                        }
                      ]
                    },
                    {
                      "id": "container-27",
                      "type": "container",
                      "hidden": false,
                      "layout": {
                        "width": "36%",
                        "height": "91%",
                        "padding": 24,
                        "paddingRight": 0,
                        "paddingBottom": 0,
                        "paddingLeft": 0,
                        "children": {
                          "distribution": "space-between",
                          "horizontalAlign": "center",
                          "verticalAlign": "center"
                        }
                      },
                      "style": {
                        "background": {
                          "color": "rgba(15, 23, 42, 0.82)"
                        },
                        "border": {
                          "width": 1,
                          "color": "rgba(34, 211, 238, 0.4)"
                        },
                        "borderRadius": 18
                      },
                      "children": [
                        {
                          "id": "text-element",
                          "hidden": false,
                          "type": "text",
                          "content": "3D mesh plot",
                          "variant": "textbox"
                        },
                        {
                          "id": "plot-element",
                          "hidden": false,
                          "layout": {
                            "width": "97.1449%",
                            "height": "91.1667%"
                          },
                          "type": "plot",
                          "source": "z = sin(x + t) * cos(y)",
                          "fitToAxes": true,
                          "showAxes": true,
                          "style": {
                            "zGradient": {
                              "minColor": "#e70129",
                              "maxColor": "#cbd605"
                            },
                            "axes": {
                              "strokeWidth": 5
                            }
                          },
                          "animation": {
                            "parameter": "t",
                            "from": 0,
                            "to": 6.283185307179586,
                            "durationMs": 4000
                          }
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
} satisfies Record<string, unknown>;

export const demoPresentation = PresentationSchema.parse(demoDocument);
