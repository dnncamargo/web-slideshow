import type {
  BlockItem,
  PowerShowElement,
  Slide,
  StructuredTableElement,
  TopicItem,
} from "@powershow/document-schema";


// ============================================================
// BEGIN: COLETA DE IDs
//
// Tratamos IDs de slides e elementos como um único namespace
// dentro da Presentation.
//
// O schema exige apenas strings não vazias, mas o Editor evita
// colisões deliberadamente.
// ============================================================

function collectElementIds(
  elements: readonly PowerShowElement[],
  ids: Set<string>,
) {
  for (const element of elements) {
    ids.add(
      element.id,
    );


    if (
      element.type ===
      "container"
    ) {
      collectElementIds(
        element.children,
        ids,
      );
    }

    if (
      element.type ===
      "blocks"
    ) {
      collectBlockItemIds(
        element.items,
        ids,
      );
    }

    if (
      element.type ===
      "topics"
    ) {
      collectTopicSlotElementIds(
        element.items,
        ids,
      );
    }

    if (
      element.type ===
        "table" &&
      element.mode ===
        "structured"
    ) {
      collectStructuredTableSlotElementIds(
        element,
        ids,
      );
    }
  }
}


/**
 * Reaches every PowerShowElement array owned by the TopicItem
 * ContentSlots, recursively through nested TopicItems. Blocks (and
 * Containers containing Blocks) located there must participate in the
 * authoring ID inventory.
 *
 * TopicItem/ContentSlot structure IDs are NOT collected here: they are
 * not PowerShowElements and this duplicate-slide path has always
 * preserved them.
 */
function collectTopicSlotElementIds(
  items: readonly TopicItem[],
  ids: Set<string>,
): void {
  for (const item of items) {
    collectElementIds(
      item.content.children,
      ids,
    );

    collectTopicSlotElementIds(
      item.children,
      ids,
    );
  }
}


/**
 * Reaches every PowerShowElement array owned by the Structured Table
 * header/column and row cell ContentSlots.
 *
 * Column/header/row/cell structural IDs are NOT collected here.
 */
function collectStructuredTableSlotElementIds(
  table: StructuredTableElement,
  ids: Set<string>,
): void {
  for (const column of table.columns) {
    collectElementIds(
      column.header.children,
      ids,
    );
  }

  for (const row of table.rows) {
    for (const cell of row.cells) {
      collectElementIds(
        cell.children,
        ids,
      );
    }
  }
}


/**
 * Slide duplication runs on its own ID inventory path. BlockItem ids
 * must participate so duplicated slides containing Blocks never
 * collide with existing BlockItem ids.
 */
function collectBlockItemIds(
  items: readonly BlockItem[],
  ids: Set<string>,
): void {
  for (const item of items) {
    ids.add(
      item.id,
    );

    collectBlockItemIds(
      item.children,
      ids,
    );
  }
}


function collectPresentationIds(
  slides: readonly Slide[],
): Set<string> {
  const ids =
    new Set<string>();


  for (const slide of slides) {
    ids.add(
      slide.id,
    );


    collectElementIds(
      slide.elements,
      ids,
    );
  }


  return ids;
}

// ============================================================
// END: COLETA DE IDs
// ============================================================


// ============================================================
// BEGIN: GERAÇÃO DE ID ÚNICO
//
// Exemplos:
//
// slide
// slide-2
// slide-3
//
// editor-slide-1-copy
// editor-slide-1-copy-2
// ============================================================

function createUniqueId(
  baseId: string,
  usedIds: Set<string>,
): string {
  if (
    !usedIds.has(
      baseId,
    )
  ) {
    return baseId;
  }


  let suffix = 2;


  while (
    usedIds.has(
      `${baseId}-${suffix}`,
    )
  ) {
    suffix += 1;
  }


  return `${baseId}-${suffix}`;
}

// ============================================================
// END: GERAÇÃO DE ID ÚNICO
// ============================================================


// ============================================================
// BEGIN: CLONE RECURSIVO DE ELEMENTO
//
// Ao duplicar um slide não copiamos apenas o ID do slide.
//
// Todos os elementos internos também recebem novos IDs,
// inclusive filhos de containers aninhados.
// ============================================================

function cloneElementWithUniqueIds(
  element: PowerShowElement,
  usedIds: Set<string>,
): PowerShowElement {
  const clone =
    structuredClone(
      element,
    );


  const id =
    createUniqueId(
      `${element.id}-copy`,
      usedIds,
    );


  usedIds.add(
    id,
  );


  if (
    clone.type ===
    "container"
  ) {
    return {
      ...clone,

      id,

      children:
        clone.children.map(
          (child) =>
            cloneElementWithUniqueIds(
              child,
              usedIds,
            ),
        ),
    };
  }


  if (
    clone.type ===
    "blocks"
  ) {
    return {
      ...clone,

      id,

      items:
        clone.items.map(
          (item) =>
            cloneBlockItemWithUniqueIds(
              item,
              usedIds,
            ),
        ),
    };
  }


  if (
    clone.type ===
    "topics"
  ) {
    return {
      ...clone,

      id,

      items:
        clone.items.map(
          (item) =>
            cloneTopicItemRenewingBlocks(
              item,
              usedIds,
            ),
        ),
    };
  }


  if (
    clone.type ===
      "table" &&
    clone.mode ===
      "structured"
  ) {
    return {
      ...clone,

      id,

      columns:
        clone.columns.map(
          (column) => ({
            ...column,

            header: {
              ...column.header,

              children:
                cloneContentSlotElementsRenewingBlocksOnly(
                  column.header.children,
                  usedIds,
                ),
            },
          }),
        ),

      rows:
        clone.rows.map(
          (row) => ({
            ...row,

            cells:
              row.cells.map(
                (cell) => ({
                  ...cell,

                  children:
                    cloneContentSlotElementsRenewingBlocksOnly(
                      cell.children,
                      usedIds,
                    ),
                }),
              ),
          }),
        ),
    };
  }


  return {
    ...clone,

    id,
  };
}


/**
 * Renews ids of a cloned TopicsElement reached through the NORMAL
 * historical slide clone path.
 *
 * The Topics PowerShowElement id follows the normal -copy convention,
 * and the TopicItem/ContentSlot structural ids are preserved. The
 * PowerShowElements inside each ContentSlot only get Blocks roots and
 * BlockItems renewed; every other inner element id is preserved.
 */
function cloneTopicItemRenewingBlocks(
  item: TopicItem,
  usedIds: Set<string>,
): TopicItem {
  return {
    ...item,

    content: {
      ...item.content,

      children:
        cloneContentSlotElementsRenewingBlocksOnly(
          item.content.children,
          usedIds,
        ),
    },

    children:
      item.children.map(
        (child) =>
          cloneTopicItemRenewingBlocks(
            child,
            usedIds,
          ),
      ),
  };
}


/**
 * Blocks-only traversal for PowerShowElements inside a ContentSlot
 * (TopicItem ContentSlot, Structured Table header/cell ContentSlot).
 *
 * Blocks roots are renewed (with all BlockItems), while every other
 * PowerShowElement keeps its own id exactly and is only recursed into
 * where Blocks may live (Containers, Topics, Structured Tables). This
 * preserves the historical duplicate-slide semantics for unrelated
 * ContentSlot elements while extending reachability to nested Blocks.
 *
 * Returns an independent clone in every case so the duplicated slide
 * never shares references with the source.
 */
function cloneContentSlotElementRenewingBlocksOnly(
  element: PowerShowElement,
  usedIds: Set<string>,
): PowerShowElement {
  if (
    element.type ===
    "blocks"
  ) {
    return cloneElementWithUniqueIds(
      element,
      usedIds,
    );
  }

  if (
    element.type ===
    "container"
  ) {
    return {
      ...structuredClone(
        element,
      ),

      children:
        element.children.map(
          (child) =>
            cloneContentSlotElementRenewingBlocksOnly(
              child,
              usedIds,
            ),
        ),
    };
  }

  if (
    element.type ===
    "topics"
  ) {
    return {
      ...structuredClone(
        element,
      ),

      items:
        element.items.map(
          (item) =>
            cloneTopicItemRenewingBlocks(
              item,
              usedIds,
            ),
        ),
    };
  }

  if (
    element.type ===
      "table" &&
    element.mode ===
      "structured"
  ) {
    return {
      ...structuredClone(
        element,
      ),

      columns:
        element.columns.map(
          (column) => ({
            ...column,

            header: {
              ...column.header,

              children:
                cloneContentSlotElementsRenewingBlocksOnly(
                  column.header.children,
                  usedIds,
                ),
            },
          }),
        ),

      rows:
        element.rows.map(
          (row) => ({
            ...row,

            cells:
              row.cells.map(
                (cell) => ({
                  ...cell,

                  children:
                    cloneContentSlotElementsRenewingBlocksOnly(
                      cell.children,
                      usedIds,
                    ),
                }),
              ),
          }),
        ),
    };
  }

  return structuredClone(
    element,
  );
}


function cloneContentSlotElementsRenewingBlocksOnly(
  elements: readonly PowerShowElement[],
  usedIds: Set<string>,
): PowerShowElement[] {
  return elements.map(
    (element) =>
      cloneContentSlotElementRenewingBlocksOnly(
        element,
        usedIds,
      ),
  );
}


/**
 * Recursively renews every BlockItem id inside a duplicated Blocks
 * element, preserving text, tree shape, and order exactly.
 */
function cloneBlockItemWithUniqueIds(
  item: BlockItem,
  usedIds: Set<string>,
): BlockItem {
  const id =
    createUniqueId(
      `${item.id}-copy`,
      usedIds,
    );


  usedIds.add(
    id,
  );


  return {
    ...item,

    id,

    children:
      item.children.map(
        (child) =>
          cloneBlockItemWithUniqueIds(
            child,
            usedIds,
          ),
      ),
  };
}

// ============================================================
// END: CLONE RECURSIVO DE ELEMENTO
// ============================================================

// ============================================================
// BEGIN: SLIDE LAYOUT PRESETS
//
// O preset é somente uma ferramenta de autoria.
//
// Depois que o slide é criado, o documento contém apenas:
// - containers;
// - textos;
// - dimensões;
// - espaçamentos.
//
// Não armazenamos "preset: two-columns" no documento.
// ============================================================

export type SlideLayoutPreset =
  | "blank"
  | "full"
  | "centered"
  | "title-content"
  | "two-columns"
  | "three-columns"
  | "title-two-columns";


// ============================================================
// BEGIN: CREATE SLIDE FROM PRESET
// ============================================================

export function createSlideFromPreset(
  preset: SlideLayoutPreset,
  slides: readonly Slide[],
): Slide {
  const usedIds =
    collectPresentationIds(
      slides,
    );


  const slideId =
    createUniqueId(
      "slide",
      usedIds,
    );


  usedIds.add(
    slideId,
  );


  // ----------------------------------------------------------
  // Cria IDs de elementos derivados do slide, mas ainda
  // garantindo unicidade global.
  // ----------------------------------------------------------

  function elementId(
    name: string,
  ): string {
    const id =
      createUniqueId(
        `${slideId}-${name}`,
        usedIds,
      );


    usedIds.add(
      id,
    );


    return id;
  }


  // ----------------------------------------------------------
  // Base comum para todos os presets.
  // ----------------------------------------------------------

  function buildSlide(
    elements: PowerShowElement[],
  ): Slide {
    return {
      id:
        slideId,

      title:
        "Untitled slide",

      summary:
        "",

      speakerNotes:
        "",

      background: {
        color:
          "#0b1020",
      },

      elements,
    };
  }


  switch (preset) {
    // ========================================================
    // BEGIN: BLANK
    // ========================================================

    case "blank":
      return buildSlide(
        [],
      );

    // ========================================================
    // END: BLANK
    // ========================================================


    // ========================================================
    // BEGIN: FULL
    // ========================================================

    case "full":
      return buildSlide([
        {
          id:
            elementId(
              "root",
            ),

          type:
            "container",

          hidden:
            false,

          direction:
            "column",

          gap:
            24,

          horizontalAlign:
            "stretch",

          verticalAlign:
            "stretch",

          style: {
            width:
              "100%",

            height:
              "100%",

            padding:
              56,
          },

          children: [
            {
              id:
                elementId(
                  "title",
                ),

              type:
                "text",

              hidden:
                false,

              variant:
                "title",

              content:
                "Slide title",

              style: {
                width:
                  "100%",
              },
            },

            {
              id:
                elementId(
                  "content",
                ),

              type:
                "textbox",

              hidden:
                false,

              content:
                "Add your content here.",

              style: {
                width:
                  "100%",

                height:
                  "100%",
              },
            },
          ],
        },
      ]);

    // ========================================================
    // END: FULL
    // ========================================================


    // ========================================================
    // BEGIN: CENTERED
    // ========================================================

    case "centered":
      return buildSlide([
        {
          id:
            elementId(
              "root",
            ),

          type:
            "container",

          hidden:
            false,

          direction:
            "column",

          gap:
            20,

          horizontalAlign:
            "center",

          verticalAlign:
            "center",

          style: {
            width:
              "100%",

            height:
              "100%",

            padding:
              64,
          },

          children: [
            {
              id:
                elementId(
                  "title",
                ),

              type:
                "text",

              hidden:
                false,

              variant:
                "title",

              content:
                "Centered slide",
            },

            {
              id:
                elementId(
                  "content",
                ),

              type:
                "textbox",

              hidden:
                false,

              content:
                "Add your content here.",

              style: {
                width:
                  "70%",
              },
            },
          ],
        },
      ]);

    // ========================================================
    // END: CENTERED
    // ========================================================


    // ========================================================
    // BEGIN: TITLE + CONTENT
    // ========================================================

    case "title-content":
      return buildSlide([
        {
          id:
            elementId(
              "root",
            ),

          type:
            "container",

          hidden:
            false,

          direction:
            "column",

          gap:
            32,

          horizontalAlign:
            "center",

          verticalAlign:
            "center",

          style: {
            width:
              "100%",

            height:
              "100%",

            padding:
              56,
          },

          children: [
            {
              id:
                elementId(
                  "title",
                ),

              type:
                "text",

              hidden:
                false,

              variant:
                "title",

              content:
                "Slide title",

              style: {
                width:
                  "90%",
              },
            },

            {
              id:
                elementId(
                  "content",
                ),

              type:
                "container",

              hidden:
                false,

              direction:
                "column",

              gap:
                16,

              horizontalAlign:
                "center",

              verticalAlign:
                "center",

              style: {
                width:
                  "90%",

                height:
                  "68%",

                padding:
                  32,

                background:
                  "rgba(15, 23, 42, 0.45)",
              },

              children: [
                {
                  id:
                    elementId(
                      "body",
                    ),

                  type:
                    "textbox",

                  hidden:
                    false,

                  content:
                    "Add your content here.",
                },
              ],
            },
          ],
        },
      ]);

    // ========================================================
    // END: TITLE + CONTENT
    // ========================================================


    // ========================================================
    // BEGIN: TWO COLUMNS
    // ========================================================

    case "two-columns":
      return buildSlide([
        {
          id:
            elementId(
              "root",
            ),

          type:
            "container",

          hidden:
            false,

          direction:
            "row",

          gap:
            32,

          horizontalAlign:
            "center",

          verticalAlign:
            "center",

          style: {
            width:
              "100%",

            height:
              "100%",

            padding:
              48,
          },

          children: [
            {
              id:
                elementId(
                  "left",
                ),

              type:
                "container",

              hidden:
                false,

              direction:
                "column",

              gap:
                16,

              horizontalAlign:
                "center",

              verticalAlign:
                "center",

              style: {
                width:
                  "47%",

                height:
                  "82%",

                padding:
                  24,

                background:
                  "rgba(15, 23, 42, 0.45)",
              },

              children:
                [],
            },

            {
              id:
                elementId(
                  "right",
                ),

              type:
                "container",

              hidden:
                false,

              direction:
                "column",

              gap:
                16,

              horizontalAlign:
                "center",

              verticalAlign:
                "center",

              style: {
                width:
                  "47%",

                height:
                  "82%",

                padding:
                  24,

                background:
                  "rgba(15, 23, 42, 0.45)",
              },

              children:
                [],
            },
          ],
        },
      ]);

    // ========================================================
    // END: TWO COLUMNS
    // ========================================================


    // ========================================================
    // BEGIN: THREE COLUMNS
    // ========================================================

    case "three-columns":
      return buildSlide([
        {
          id:
            elementId(
              "root",
            ),

          type:
            "container",

          hidden:
            false,

          direction:
            "row",

          gap:
            24,

          horizontalAlign:
            "center",

          verticalAlign:
            "center",

          style: {
            width:
              "100%",

            height:
              "100%",

            padding:
              48,
          },

          children: [
            {
              id:
                elementId(
                  "column-1",
                ),

              type:
                "container",

              hidden:
                false,

              direction:
                "column",

              gap:
                16,

              horizontalAlign:
                "center",

              verticalAlign:
                "center",

              style: {
                width:
                  "30%",

                height:
                  "82%",

                padding:
                  20,

                background:
                  "rgba(15, 23, 42, 0.45)",
              },

              children:
                [],
            },

            {
              id:
                elementId(
                  "column-2",
                ),

              type:
                "container",

              hidden:
                false,

              direction:
                "column",

              gap:
                16,

              horizontalAlign:
                "center",

              verticalAlign:
                "center",

              style: {
                width:
                  "30%",

                height:
                  "82%",

                padding:
                  20,

                background:
                  "rgba(15, 23, 42, 0.45)",
              },

              children:
                [],
            },

            {
              id:
                elementId(
                  "column-3",
                ),

              type:
                "container",

              hidden:
                false,

              direction:
                "column",

              gap:
                16,

              horizontalAlign:
                "center",

              verticalAlign:
                "center",

              style: {
                width:
                  "30%",

                height:
                  "82%",

                padding:
                  20,

                background:
                  "rgba(15, 23, 42, 0.45)",
              },

              children:
                [],
            },
          ],
        },
      ]);

    // ========================================================
    // END: THREE COLUMNS
    // ========================================================


    // ========================================================
    // BEGIN: TITLE + TWO COLUMNS
    // ========================================================

    case "title-two-columns":
      return buildSlide([
        {
          id:
            elementId(
              "root",
            ),

          type:
            "container",

          hidden:
            false,

          direction:
            "column",

          gap:
            28,

          horizontalAlign:
            "center",

          verticalAlign:
            "center",

          style: {
            width:
              "100%",

            height:
              "100%",

            padding:
              48,
          },

          children: [
            {
              id:
                elementId(
                  "title",
                ),

              type:
                "text",

              hidden:
                false,

              variant:
                "title",

              content:
                "Slide title",

              style: {
                width:
                  "94%",
              },
            },

            {
              id:
                elementId(
                  "columns",
                ),

              type:
                "container",

              hidden:
                false,

              direction:
                "row",

              gap:
                28,

              horizontalAlign:
                "center",

              verticalAlign:
                "center",

              style: {
                width:
                  "94%",

                height:
                  "70%",
              },

              children: [
                {
                  id:
                    elementId(
                      "left",
                    ),

                  type:
                    "container",

                  hidden:
                    false,

                  direction:
                    "column",

                  gap:
                    16,

                  horizontalAlign:
                    "center",

                  verticalAlign:
                    "center",

                  style: {
                    width:
                      "48%",

                    height:
                      "100%",

                    padding:
                      24,

                    background:
                      "rgba(15, 23, 42, 0.45)",
                  },

                  children:
                    [],
                },

                {
                  id:
                    elementId(
                      "right",
                    ),

                  type:
                    "container",

                  hidden:
                    false,

                  direction:
                    "column",

                  gap:
                    16,

                  horizontalAlign:
                    "center",

                  verticalAlign:
                    "center",

                  style: {
                    width:
                      "48%",

                    height:
                      "100%",

                    padding:
                      24,

                    background:
                      "rgba(15, 23, 42, 0.45)",
                  },

                  children:
                    [],
                },
              ],
            },
          ],
        },
      ]);

    // ========================================================
    // END: TITLE + TWO COLUMNS
    // ========================================================
  }
}

// ============================================================
// END: CREATE SLIDE FROM PRESET
// ============================================================


// ============================================================
// END: SLIDE LAYOUT PRESETS
// ============================================================

// ============================================================
// BEGIN: CREATE BLANK SLIDE
//
// Mantemos esta função por compatibilidade com código existente.
// ============================================================

export function createBlankSlide(
  slides: readonly Slide[],
): Slide {
  return createSlideFromPreset(
    "blank",
    slides,
  );
}

// ============================================================
// END: CREATE BLANK SLIDE
// ============================================================

// ============================================================
// BEGIN: DUPLICATE SLIDE
//
// structuredClone garante independência de:
//
// - background;
// - metadata;
// - arrays;
// - objetos internos.
//
// Depois substituímos todos os IDs que precisam ser únicos.
// ============================================================

export function duplicateSlideWithUniqueIds(
  source: Slide,
  slides: readonly Slide[],
): Slide {
  const usedIds =
    collectPresentationIds(
      slides,
    );


  const clone =
    structuredClone(
      source,
    );


  const id =
    createUniqueId(
      `${source.id}-copy`,
      usedIds,
    );


  usedIds.add(
    id,
  );


  return {
    ...clone,

    id,

    title:
      source.title.trim()
        ? `${source.title} copy`
        : "Untitled slide copy",

    elements:
      source.elements.map(
        (element) =>
          cloneElementWithUniqueIds(
            element,
            usedIds,
          ),
      ),
  };
}

// ============================================================
// END: DUPLICATE SLIDE
// ============================================================

// ============================================================
// BEGIN: MOVE SLIDE
//
// Move um slide de uma posição para outra.
//
// A função é pura:
// - não altera o array recebido;
// - preserva os objetos dos slides;
// - retorna uma nova ordem.
//
// Índices inválidos simplesmente mantêm a ordem atual.
// ============================================================

export function moveSlide(
  slides: readonly Slide[],
  fromIndex: number,
  toIndex: number,
): Slide[] {
  if (
    fromIndex < 0 ||
    fromIndex >= slides.length ||
    toIndex < 0 ||
    toIndex >= slides.length ||
    fromIndex === toIndex
  ) {
    return [
      ...slides,
    ];
  }


  const nextSlides = [
    ...slides,
  ];


  const slide =
    nextSlides[
      fromIndex
    ];


  if (!slide) {
    return nextSlides;
  }


  nextSlides.splice(
    fromIndex,
    1,
  );


  nextSlides.splice(
    toIndex,
    0,
    slide,
  );


  return nextSlides;
}

// ============================================================
// END: MOVE SLIDE
// ============================================================