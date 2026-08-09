import {
  describe,
  expect,
  it,
} from "vitest";

import {
  PANEL_SIZE_PRESETS,
  resolvePanelSize,
} from "../src/panel-size";


// ============================================================
// BEGIN: PRESETS DE TAMANHO
//
// Estes testes formalizam uma regra importante:
//
// width / height
// → porcentagens relativas ao container.
//
// Os presets são apenas uma facilidade de edição.
// ============================================================

describe(
  "panel size presets",
  () => {
    it(
      "defines the small preset",
      () => {
        expect(
          PANEL_SIZE_PRESETS.small,
        ).toEqual({
          width: "56%",
          height: "48%",
        });
      },
    );


    it(
      "defines the medium preset",
      () => {
        expect(
          PANEL_SIZE_PRESETS.medium,
        ).toEqual({
          width: "70%",
          height: "60%",
        });
      },
    );


    it(
      "defines the large preset",
      () => {
        expect(
          PANEL_SIZE_PRESETS.large,
        ).toEqual({
          width: "82%",
          height: "72%",
        });
      },
    );


    it(
      "defines the wide preset",
      () => {
        expect(
          PANEL_SIZE_PRESETS.wide,
        ).toEqual({
          width: "88%",
          height: "58%",
        });
      },
    );
  },
);

// ============================================================
// END: PRESETS DE TAMANHO
// ============================================================


// ============================================================
// BEGIN: RESOLUÇÃO DOS PRESETS
// ============================================================

describe(
  "resolvePanelSize",
  () => {
    it(
      "resolves a semantic preset",
      () => {
        expect(
          resolvePanelSize(
            "medium",
          ),
        ).toEqual({
          width: "70%",
          height: "60%",
        });
      },
    );


    it(
      "allows a manual width override",
      () => {
        expect(
          resolvePanelSize(
            "medium",
            {
              width: "76%",
            },
          ),
        ).toEqual({
          width: "76%",

          // A altura continua vindo do preset.
          height: "60%",
        });
      },
    );


    it(
      "allows a manual height override",
      () => {
        expect(
          resolvePanelSize(
            "large",
            {
              height: "68%",
            },
          ),
        ).toEqual({
          // A largura continua vindo do preset.
          width: "82%",

          height: "68%",
        });
      },
    );


    it(
      "allows fully custom dimensions",
      () => {
        expect(
          resolvePanelSize(
            "wide",
            {
              width: "91%",
              height: "64%",
            },
          ),
        ).toEqual({
          width: "91%",
          height: "64%",
        });
      },
    );
  },
);

// ============================================================
// END: RESOLUÇÃO DOS PRESETS
// ============================================================