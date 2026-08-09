// ============================================================
// BEGIN: PRESETS SEMÂNTICOS DE TAMANHO DE PAINEL
//
// Estes presets existem para simplificar a interface do Editor.
//
// O documento NÃO precisa armazenar:
//
//   sizePreset: "medium"
//
// Em vez disso, o Editor resolve o preset para:
//
//   style.width
//   style.height
//
// Isso mantém o documento independente da interface de edição.
// ============================================================

export type PanelSizePreset =
  | "small"
  | "medium"
  | "large"
  | "wide";


// ============================================================
// BEGIN: DIMENSÕES RELATIVAS
//
// Painéis são dimensionados proporcionalmente ao seu
// container.
//
// Portanto:
// width  → %
// height → %
//
// Padding, margin, gap, radius, border e shadow NÃO usam este
// tipo. Eles permanecem valores absolutos em pixels.
// ============================================================

export type PercentageSize =
  `${number}%`;

export interface PanelSize {
  width: PercentageSize;

  height: PercentageSize;
}

// ============================================================
// END: DIMENSÕES RELATIVAS
// ============================================================


// ============================================================
// PRESETS
//
// Valores iniciais.
//
// Podemos refiná-los depois da inspeção visual sem alterar
// renderer ou schema.
// ============================================================

export const PANEL_SIZE_PRESETS: Readonly<
  Record<
    PanelSizePreset,
    Readonly<PanelSize>
  >
> = {
  small: {
    width: "56%",
    height: "48%",
  },

  medium: {
    width: "70%",
    height: "60%",
  },

  large: {
    width: "82%",
    height: "72%",
  },

  wide: {
    width: "88%",
    height: "58%",
  },
};


// ============================================================
// OVERRIDES MANUAIS
//
// Permite que o preset seja apenas o ponto de partida.
//
// Exemplo:
//
// resolvePanelSize(
//   "medium",
//   {
//     width: "74%",
//   },
// )
//
// Resultado:
//
// {
//   width: "74%",
//   height: "60%",
// }
//
// Ou seja:
// preset + ajuste manual coexistem.
// ============================================================

export type PanelSizeOverride =
  Partial<PanelSize>;


export function resolvePanelSize(
  preset: PanelSizePreset,
  override: PanelSizeOverride = {},
): PanelSize {
  return {
    ...PANEL_SIZE_PRESETS[preset],
    ...override,
  };
}

// ============================================================
// END: PRESETS SEMÂNTICOS DE TAMANHO DE PAINEL
// ============================================================

