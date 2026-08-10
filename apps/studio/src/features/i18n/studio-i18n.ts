import type { PowerShowElement } from "@powershow/document-schema";

// ============================================================
// BEGIN: STUDIO LOCALES
// ============================================================

export type StudioLocale = "en" | "pt-BR";

export const DEFAULT_STUDIO_LOCALE: StudioLocale = "en";

export const STUDIO_LOCALE_STORAGE_KEY = "powershow-studio-locale";

export const STUDIO_LOCALES: readonly StudioLocale[] = ["en", "pt-BR"];

export function isStudioLocale(value: string | null): value is StudioLocale {
  return value === "en" || value === "pt-BR";
}

// ============================================================
// END: STUDIO LOCALES
// ============================================================

// ============================================================
// BEGIN: ENGLISH MESSAGES
// ============================================================

const englishMessages = {
  "locale.language": "Language",
  "locale.en": "English",
  "locale.pt-BR": "Português",

  "topbar.editor": "Editor",
  "topbar.localDraft": "Local draft",

  "slides.title": "Slides",
  "slides.new": "+ New slide",
  "slides.close": "Close",
  "slides.chooseLayout": "Choose layout",
  "slides.layout.blank": "Blank",
  "slides.layout.blankDescription": "Empty slide",
  "slides.layout.centered": "Centered",
  "slides.layout.centeredDescription": "Centered content",
  "slides.layout.titleContent": "Title + Content",
  "slides.layout.titleContentDescription": "Title and body",
  "slides.layout.twoColumns": "Two Columns",
  "slides.layout.twoColumnsDescription": "50 / 50 layout",
  "slides.layout.threeColumns": "Three Columns",
  "slides.layout.threeColumnsDescription": "Three sections",
  "slides.layout.titleTwoColumns": "Title + 2 Cols",
  "slides.layout.titleTwoColumnsDescription": "Title with columns",
  "slides.cancel": "Cancel",
  "slides.create": "+ New",
  "slides.up": "↑ Up",
  "slides.down": "↓ Down",
  "slides.duplicate": "Duplicate",
  "slides.delete": "Delete",
  "slides.moveUpTitle": "Move slide up",
  "slides.moveDownTitle": "Move slide down",
  "slides.deleteConfirm": 'Delete slide "{title}"?',
  "slides.untitled": "Untitled slide",
  "slides.current": "Slide {number}",
  "slides.emptyPresentation": "Presentation has no slides.",

  "canvas.noElementSelected": "No element selected",

  "inspector.title": "Inspector",
  "inspector.element": "Element",
  "inspector.slide": "Slide",
  "inspector.id": "ID",
  "inspector.rootElements": "Root elements",
  "inspector.selectElementHint":
    "Click an element directly on the canvas to inspect it.",
  "inspector.unsupportedElementHint":
    "This element is connected to the document. Specific editing controls will be added in the next rounds.",
  "inspector.paddingSides": "Padding sides",
  "inspector.marginSides": "Margin sides",
  "inspector.top": "Top",
  "inspector.right": "Right",
  "inspector.bottom": "Bottom",
  "inspector.left": "Left",

  "element.text": "Text",
  "element.textbox": "Textbox",
  "element.image": "Image",
  "element.code": "Code",
  "element.terminal": "Terminal",
  "element.table": "Table",
  "element.chart": "Chart",
  "element.interactive": "Interactive",
  "element.container": "Container",

  "elementCrud.add": "+ Add",
  "elementCrud.addInsideContainer": "Adds inside selected container.",
  "elementCrud.addAfterElement": "Adds after selected element.",
  "elementCrud.addToSlideRoot": "Adds to slide root.",
  "elementCrud.up": "↑ Up",
  "elementCrud.down": "↓ Down",
  "elementCrud.moveUpTitle": "Move element up",
  "elementCrud.moveDownTitle": "Move element down",
  "elementCrud.duplicate": "Duplicate",
  "elementCrud.delete": "Delete",
  "elementCrud.deleteContainerConfirm":
    'Delete container "{id}" and all its children?',
  "elementCrud.deleteElementConfirm": 'Delete {type} "{id}"?',

  "inspector.layout": "Layout",
  "inspector.direction": "Direction",
  "inspector.vertical": "Vertical",
  "inspector.horizontal": "Horizontal",
  "inspector.default": "Default",
  "inspector.start": "Start",
  "inspector.center": "Center",
  "inspector.end": "End",
  "inspector.stretch": "Stretch",
  "inspector.size": "Size",
  "inspector.preset": "Preset",
  "inspector.small": "Small",
  "inspector.medium": "Medium",
  "inspector.large": "Large",
  "inspector.wide": "Wide",
  "inspector.custom": "Custom",
  "inspector.width": "Width",
  "inspector.height": "Height",
  "inspector.spacing": "Spacing",
  "inspector.padding": "Padding",
  "inspector.gap": "Gap",
  "inspector.margin": "Margin",
  "inspector.paddingTooltip":
    "Space between the container border and its content.",
  "inspector.gapTooltip": "Space between the container's child elements.",
  "inspector.marginTooltip": "Space outside the container.",
  "inspector.content": "Content",
  "inspector.display": "Display",
  "inspector.text": "Text",
  "inspector.style": "Style",
  "inspector.titleField": "Title",
  "inspector.subtitle": "Subtitle",
  "inspector.body": "Body",
  "inspector.caption": "Caption",
  "inspector.appearance": "Appearance",
  "inspector.background": "Background",
  "inspector.backgroundHelp": "Background color of the element.",
  "inspector.clearBackground": "Clear",
  "inspector.roundedCorners": "Rounded corners",
  "inspector.roundedCornersHelp":
    "Controls the corner radius of the element.",
  "inspector.opacity": "Opacity",
  "inspector.opacityHelp": "Controls the transparency of the element.",
  "inspector.border": "Border",
  "inspector.borderHelp": "Controls the border around the element.",
  "inspector.border.none": "None",
  "inspector.border.solid": "Solid",
  "inspector.border.dashed": "Dashed",
  "inspector.border.dotted": "Dotted",
  "inspector.borderWidth": "Width",
  "inspector.borderColor": "Color",
  "inspector.effects": "Effects",
  "inspector.shadow": "Shadow",
  "inspector.shadowHelp": "Controls the shadow around the element.",
  "inspector.shadow.none": "None",
  "inspector.shadow.outer": "Outer",
  "inspector.shadow.inset": "Inset",
  "inspector.shadowX": "X",
  "inspector.shadowY": "Y",
  "inspector.shadowBlur": "Blur",
  "inspector.shadowSpread": "Spread",
  "inspector.shadowColor": "Color",
  "inspector.color": "Color",
  "inspector.useThemeDefault": "Use theme default",
  "inspector.source": "Source",
  "inspector.language": "Language",
  "inspector.showLineNumbers": "Show line numbers",
  "inspector.highlightedLines": "Highlighted lines",
  "inspector.highlightedLinesHint": "Separate line numbers with commas.",
  "inspector.optional": "Optional",
  "inspector.lines": "Lines",
  "inspector.noTerminalLines": "No terminal lines.",
  "inspector.command": "Command",
  "inspector.output": "Output",
  "inspector.comment": "Comment",
  "inspector.error": "Error",
  "inspector.removeLine": "Remove line",
  "inspector.removeTerminalLine": "Remove terminal line {number}",
  "inspector.addLine": "+ Add line",
  "inspector.distribution": "Distribution",
  "inspector.distributionHelp":
    "Controls spacing between children along the container's main axis.",
  "inspector.distribution.packed": "Packed",
  "inspector.distribution.spaceBetween": "Space between",
  "inspector.distribution.spaceAround": "Space around",
  "inspector.distribution.spaceEvenly": "Space evenly",
  "inspector.alignmentDisabledByDistribution":
    "Main-axis alignment is controlled by Distribution.",

  "image.sourceHint": "Image path or source.",
  "image.alternativeText": "Alternative text",
  "image.fit": "Fit",
  "image.contain": "Contain",
  "image.cover": "Cover",
  "image.fill": "Fill",

  "table.text": "Text",
  "table.number": "Number",
  "table.boolean": "Boolean",
  "table.null": "Null",
  "table.true": "True",
  "table.false": "False",
  "table.columns": "Columns",
  "table.column": "Column {number}",
  "table.removeColumn": "Remove column {number}",
  "table.label": "Label",
  "table.key": "Key",
  "table.addColumn": "+ Add column",
  "table.rows": "Rows",
  "table.noRows": "No rows.",
  "table.row": "Row {number}",
  "table.removeRow": "Remove row {number}",
  "table.addRow": "+ Add row",

  "home.nextLogoAlt": "Next.js logo",
  "home.vercelLogoAlt": "Vercel logomark",
  "home.getStartedPrefix": "To get started, edit the",
  "home.getStartedSuffix": " file.",
  "home.instructionsPrefix":
    "Looking for a starting point or more instructions? Head over to",
  "home.templates": "Templates",
  "home.or": "or the",
  "home.learning": "Learning",
  "home.center": "center.",
  "home.deploy": "Deploy Now",
  "home.documentation": "Documentation",
} as const;

// ============================================================
// END: ENGLISH MESSAGES
// ============================================================

export type StudioMessageKey = keyof typeof englishMessages;

type StudioMessages = Record<StudioMessageKey, string>;

// ============================================================
// BEGIN: PORTUGUESE MESSAGES
// ============================================================

const portugueseMessages = {
  "locale.language": "Idioma",
  "locale.en": "English",
  "locale.pt-BR": "Português",

  "topbar.editor": "Editor",
  "topbar.localDraft": "Rascunho local",

  "slides.title": "Slides",
  "slides.new": "+ Novo slide",
  "slides.close": "Fechar",
  "slides.chooseLayout": "Escolher layout",
  "slides.layout.blank": "Em branco",
  "slides.layout.blankDescription": "Slide vazio",
  "slides.layout.centered": "Centralizado",
  "slides.layout.centeredDescription": "Conteúdo centralizado",
  "slides.layout.titleContent": "Título + Conteúdo",
  "slides.layout.titleContentDescription": "Título e corpo",
  "slides.layout.twoColumns": "Duas colunas",
  "slides.layout.twoColumnsDescription": "Layout 50 / 50",
  "slides.layout.threeColumns": "Três colunas",
  "slides.layout.threeColumnsDescription": "Três seções",
  "slides.layout.titleTwoColumns": "Título + 2 cols",
  "slides.layout.titleTwoColumnsDescription": "Título com colunas",
  "slides.cancel": "Cancelar",
  "slides.create": "+ Novo",
  "slides.up": "↑ Subir",
  "slides.down": "↓ Descer",
  "slides.duplicate": "Duplicar",
  "slides.delete": "Excluir",
  "slides.moveUpTitle": "Mover slide para cima",
  "slides.moveDownTitle": "Mover slide para baixo",
  "slides.deleteConfirm": 'Excluir o slide "{title}"?',
  "slides.untitled": "Slide sem título",
  "slides.current": "Slide {number}",
  "slides.emptyPresentation": "A apresentação não possui slides.",

  "canvas.noElementSelected": "Nenhum elemento selecionado",

  "inspector.title": "Inspetor",
  "inspector.element": "Elemento",
  "inspector.slide": "Slide",
  "inspector.id": "ID",
  "inspector.rootElements": "Elementos raiz",
  "inspector.selectElementHint":
    "Clique em um elemento diretamente no canvas para inspecioná-lo.",
  "inspector.unsupportedElementHint":
    "Este elemento está conectado ao documento. Controles de edição específicos serão adicionados nas próximas rodadas.",
  "inspector.paddingSides": "Padding individual",
  "inspector.marginSides": "Margem individual",
  "inspector.top": "Superior",
  "inspector.right": "Direita",
  "inspector.bottom": "Inferior",
  "inspector.left": "Esquerda",

  "element.text": "Texto",
  "element.textbox": "Caixa de texto",
  "element.image": "Imagem",
  "element.code": "Código",
  "element.terminal": "Terminal",
  "element.table": "Tabela",
  "element.chart": "Gráfico",
  "element.interactive": "Interativo",
  "element.container": "Contêiner",

  "elementCrud.add": "+ Adicionar",
  "elementCrud.addInsideContainer": "Adiciona dentro do contêiner selecionado.",
  "elementCrud.addAfterElement": "Adiciona após o elemento selecionado.",
  "elementCrud.addToSlideRoot": "Adiciona à raiz do slide.",
  "elementCrud.up": "↑ Subir",
  "elementCrud.down": "↓ Descer",
  "elementCrud.moveUpTitle": "Mover elemento para cima",
  "elementCrud.moveDownTitle": "Mover elemento para baixo",
  "elementCrud.duplicate": "Duplicar",
  "elementCrud.delete": "Excluir",
  "elementCrud.deleteContainerConfirm":
    'Excluir o contêiner "{id}" e todos os seus elementos filhos?',
  "elementCrud.deleteElementConfirm": 'Excluir {type} "{id}"?',

  "inspector.layout": "Layout",
  "inspector.direction": "Direção",
  "inspector.vertical": "Vertical",
  "inspector.horizontal": "Horizontal",
  "inspector.default": "Padrão",
  "inspector.start": "Início",
  "inspector.center": "Centro",
  "inspector.end": "Fim",
  "inspector.stretch": "Esticar",
  "inspector.size": "Tamanho",
  "inspector.preset": "Predefinição",
  "inspector.small": "Pequeno",
  "inspector.medium": "Médio",
  "inspector.large": "Grande",
  "inspector.wide": "Largo",
  "inspector.custom": "Personalizado",
  "inspector.width": "Largura",
  "inspector.height": "Altura",
  "inspector.spacing": "Espaçamentos",
  "inspector.padding": "Preenchimento",
  "inspector.gap": "Espaçamento",
  "inspector.margin": "Margem",
  "inspector.paddingTooltip":
    "Espaço entre a borda do container e seu conteúdo.",
  "inspector.gapTooltip": "Espaço entre os elementos filhos do container.",
  "inspector.marginTooltip": "Espaço externo ao container.",

  "inspector.content": "Conteúdo",
  "inspector.display": "Exibição",
  "inspector.text": "Texto",
  "inspector.style": "Estilo",
  "inspector.titleField": "Título",
  "inspector.subtitle": "Subtítulo",
  "inspector.body": "Corpo",
  "inspector.caption": "Legenda",
  "inspector.appearance": "Aparência",
  "inspector.background": "Fundo",
  "inspector.backgroundHelp": "Cor de fundo do elemento.",
  "inspector.clearBackground": "Remover",
  "inspector.roundedCorners": "Cantos arredondados",
  "inspector.roundedCornersHelp":
    "Controla o arredondamento dos cantos do elemento.",
  "inspector.opacity": "Opacidade",
  "inspector.opacityHelp": "Controla a transparência do elemento.",
  "inspector.border": "Borda",
  "inspector.borderHelp": "Controla a borda ao redor do elemento.",
  "inspector.border.none": "Nenhuma",
  "inspector.border.solid": "Sólida",
  "inspector.border.dashed": "Tracejada",
  "inspector.border.dotted": "Pontilhada",
  "inspector.borderWidth": "Largura",
  "inspector.borderColor": "Cor",
  "inspector.effects": "Efeitos",
  "inspector.shadow": "Sombra",
  "inspector.shadowHelp": "Controla a sombra ao redor do elemento.",
  "inspector.shadow.none": "Nenhuma",
  "inspector.shadow.outer": "Externa",
  "inspector.shadow.inset": "Interna",
  "inspector.shadowX": "X",
  "inspector.shadowY": "Y",
  "inspector.shadowBlur": "Desfoque",
  "inspector.shadowSpread": "Expansão",
  "inspector.shadowColor": "Cor",
  "inspector.color": "Cor",
  "inspector.useThemeDefault": "Usar padrão do tema",
  "inspector.source": "Origem",
  "inspector.language": "Linguagem",
  "inspector.showLineNumbers": "Mostrar números de linha",
  "inspector.highlightedLines": "Linhas destacadas",
  "inspector.highlightedLinesHint":
    "Separe os números das linhas com vírgulas.",
  "inspector.optional": "Opcional",
  "inspector.lines": "Linhas",
  "inspector.noTerminalLines": "Nenhuma linha de terminal.",
  "inspector.command": "Comando",
  "inspector.output": "Saída",
  "inspector.comment": "Comentário",
  "inspector.error": "Erro",
  "inspector.removeLine": "Remover linha",
  "inspector.removeTerminalLine": "Remover linha de terminal {number}",
  "inspector.addLine": "+ Adicionar linha",
  "inspector.distribution": "Distribuição",
  "inspector.distributionHelp":
    "Controla a distribuição dos elementos filhos ao longo do eixo principal do container.",
  "inspector.distribution.packed": "Agrupado",
  "inspector.distribution.spaceBetween": "Espaço entre",
  "inspector.distribution.spaceAround": "Espaço ao redor",
  "inspector.distribution.spaceEvenly": "Espaço uniforme",
  "inspector.alignmentDisabledByDistribution":
    "O alinhamento do eixo principal é controlado pela Distribuição.",

  "image.sourceHint": "Caminho ou origem da imagem.",
  "image.alternativeText": "Texto alternativo",
  "image.fit": "Ajuste",
  "image.contain": "Conter",
  "image.cover": "Cobrir",
  "image.fill": "Preencher",

  "table.text": "Texto",
  "table.number": "Número",
  "table.boolean": "Booleano",
  "table.null": "Nulo",
  "table.true": "Verdadeiro",
  "table.false": "Falso",
  "table.columns": "Colunas",
  "table.column": "Coluna {number}",
  "table.removeColumn": "Remover coluna {number}",
  "table.label": "Rótulo",
  "table.key": "Chave",
  "table.addColumn": "+ Adicionar coluna",
  "table.rows": "Linhas",
  "table.noRows": "Nenhuma linha.",
  "table.row": "Linha {number}",
  "table.removeRow": "Remover linha {number}",
  "table.addRow": "+ Adicionar linha",

  "home.nextLogoAlt": "Logo do Next.js",
  "home.vercelLogoAlt": "Símbolo da Vercel",
  "home.getStartedPrefix": "Para começar, edite o arquivo",
  "home.getStartedSuffix": ".",
  "home.instructionsPrefix":
    "Procurando um ponto de partida ou mais instruções? Acesse",
  "home.templates": "Modelos",
  "home.or": "ou o",
  "home.learning": "Aprendizado",
  "home.center": ".",
  "home.deploy": "Implantar agora",
  "home.documentation": "Documentação",
} satisfies StudioMessages;

// ============================================================
// END: PORTUGUESE MESSAGES
// ============================================================

const messages: Record<StudioLocale, StudioMessages> = {
  en: englishMessages,
  "pt-BR": portugueseMessages,
};

export type StudioMessageValues = Readonly<Record<string, string | number>>;

export type StudioTranslate = (
  key: StudioMessageKey,
  values?: StudioMessageValues,
) => string;

export function translateStudioMessage(
  locale: StudioLocale,
  key: StudioMessageKey,
  values?: StudioMessageValues,
): string {
  const message = messages[locale][key];

  if (!values) {
    return message;
  }

  return message.replace(/\{(\w+)\}/g, (token, name: string) => {
    const value = values[name];

    return value === undefined ? token : String(value);
  });
}

// ============================================================
// BEGIN: ELEMENT TYPE LABELS
// ============================================================

export const ELEMENT_TYPE_MESSAGE_KEYS = {
  text: "element.text",
  textbox: "element.textbox",
  image: "element.image",
  code: "element.code",
  terminal: "element.terminal",
  table: "element.table",
  chart: "element.chart",
  interactive: "element.interactive",
  container: "element.container",
} satisfies Record<PowerShowElement["type"], StudioMessageKey>;

// ============================================================
// END: ELEMENT TYPE LABELS
// ============================================================
