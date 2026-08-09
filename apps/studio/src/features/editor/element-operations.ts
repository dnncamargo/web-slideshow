import type {
  PowerShowElement,
  Slide,
} from "@powershow/document-schema";


// ============================================================
// BEGIN: TIPOS DE ELEMENTOS CRIÁVEIS
//
// Chart e Interactive ficam fora desta primeira rodada porque
// ainda não possuem edição/renderização completa no Editor.
// ============================================================

export type ElementCreateType =
  | "text"
  | "textbox"
  | "container"
  | "image"
  | "code"
  | "terminal"
  | "table";

// ============================================================
// END: TIPOS DE ELEMENTOS CRIÁVEIS
// ============================================================


// ============================================================
// BEGIN: COLETA DE IDS
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
  }
}


function collectPresentationElementIds(
  slides: readonly Slide[],
): Set<string> {
  const ids =
    new Set<string>();


  for (const slide of slides) {
    collectElementIds(
      slide.elements,
      ids,
    );
  }


  return ids;
}

// ============================================================
// END: COLETA DE IDS
// ============================================================


// ============================================================
// BEGIN: ID ÚNICO
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
// END: ID ÚNICO
// ============================================================


// ============================================================
// BEGIN: CREATE ELEMENT
//
// Os defaults são deliberadamente pequenos.
//
// Estamos criando elementos válidos e imediatamente editáveis,
// sem tentar criar um "design inteligente" automaticamente.
// ============================================================

export function createElement(
  type: ElementCreateType,
  slides: readonly Slide[],
): PowerShowElement {
  const usedIds =
    collectPresentationElementIds(
      slides,
    );


  switch (type) {
    case "text": {
      return {
        id:
          createUniqueId(
            "text-element",
            usedIds,
          ),

        type:
          "text",

        hidden:
          false,

        content:
          "New text",

        variant:
          "body",
      };
    }


    case "textbox": {
      return {
        id:
          createUniqueId(
            "textbox-element",
            usedIds,
          ),

        type:
          "textbox",

        hidden:
          false,

        content:
          "New textbox",
      };
    }


    case "container": {
      return {
        id:
          createUniqueId(
            "container-element",
            usedIds,
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
            "70%",

          height:
            "60%",

          padding:
            24,

          background:
            "rgba(15, 23, 42, 0.55)",
        },

        children:
          [],
      };
    }


    case "image": {
      return {
        id:
          createUniqueId(
            "image-element",
            usedIds,
          ),

        type:
          "image",

        hidden:
          false,

        src:
          "/powershow-demo.svg",

        alt:
          "New image",

        fit:
          "contain",

        style: {
          width:
            "60%",

          height:
            "55%",
        },
      };
    }


    case "code": {
      return {
        id:
          createUniqueId(
            "code-element",
            usedIds,
          ),

        type:
          "code",

        hidden:
          false,

        code:
          "const message = \"Hello PowerShow\";",

        language:
          "typescript",

        showLineNumbers:
          true,

        highlightedLines:
          [],
      };
    }


    case "terminal": {
      return {
        id:
          createUniqueId(
            "terminal-element",
            usedIds,
          ),

        type:
          "terminal",

        hidden:
          false,

        title:
          "Terminal",

        lines: [
          {
            type:
              "command",

            content:
              "pnpm dev",
          },
        ],
      };
    }


    case "table": {
      return {
        id:
          createUniqueId(
            "table-element",
            usedIds,
          ),

        type:
          "table",

        hidden:
          false,

        columns: [
          {
            key:
              "column_1",

            label:
              "Column 1",
          },
        ],

        rows: [
          {
            column_1:
              "Value",
          },
        ],
      };
    }
  }
}

// ============================================================
// END: CREATE ELEMENT
// ============================================================


// ============================================================
// BEGIN: CLONE COM IDS ÚNICOS
// ============================================================

function cloneElementWithUniqueIds(
  source: PowerShowElement,
  usedIds: Set<string>,
): PowerShowElement {
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


  return {
    ...clone,

    id,
  };
}


export function duplicateElement(
  source: PowerShowElement,
  slides: readonly Slide[],
): PowerShowElement {
  const usedIds =
    collectPresentationElementIds(
      slides,
    );


  return cloneElementWithUniqueIds(
    source,
    usedIds,
  );
}

// ============================================================
// END: CLONE COM IDS ÚNICOS
// ============================================================


// ============================================================
// BEGIN: INSERIR APÓS ELEMENTO
//
// Procura recursivamente o elemento e insere o novo elemento
// como irmão imediatamente depois dele.
// ============================================================

export function insertElementAfterId(
  elements: PowerShowElement[],
  targetId: string,
  newElement: PowerShowElement,
): PowerShowElement[] {
  const result:
    PowerShowElement[] = [];


  for (const element of elements) {
    result.push(
      element,
    );


    if (
      element.id ===
      targetId
    ) {
      result.push(
        newElement,
      );

      continue;
    }


    if (
      element.type ===
      "container"
    ) {
      const children =
        insertElementAfterId(
          element.children,
          targetId,
          newElement,
        );


      if (
        children !==
        element.children
      ) {
        result[
          result.length - 1
        ] = {
          ...element,

          children,
        };
      }
    }
  }


  return result;
}

// ============================================================
// END: INSERIR APÓS ELEMENTO
// ============================================================


// ============================================================
// BEGIN: APPEND EM CONTAINER
// ============================================================

export function appendElementToContainer(
  elements: PowerShowElement[],
  containerId: string,
  newElement: PowerShowElement,
): PowerShowElement[] {
  return elements.map(
    (element) => {
      if (
        element.id ===
          containerId &&
        element.type ===
          "container"
      ) {
        return {
          ...element,

          children: [
            ...element.children,

            newElement,
          ],
        };
      }


      if (
        element.type ===
        "container"
      ) {
        return {
          ...element,

          children:
            appendElementToContainer(
              element.children,
              containerId,
              newElement,
            ),
        };
      }


      return element;
    },
  );
}

// ============================================================
// END: APPEND EM CONTAINER
// ============================================================


// ============================================================
// BEGIN: DELETE ELEMENT
//
// Se um container for removido, todo o subtree dele desaparece
// naturalmente junto com o container.
// ============================================================

export function removeElementById(
  elements: PowerShowElement[],
  id: string,
): PowerShowElement[] {
  return elements
    .filter(
      (element) =>
        element.id !== id,
    )
    .map(
      (element) => {
        if (
          element.type !==
          "container"
        ) {
          return element;
        }


        return {
          ...element,

          children:
            removeElementById(
              element.children,
              id,
            ),
        };
      },
    );
}

// ============================================================
// END: DELETE ELEMENT
// ============================================================

// ============================================================
// BEGIN: ELEMENT SIBLING POSITION
//
// Localiza um elemento e informa sua posição dentro da lista
// de irmãos.
//
// parentId:
//
// null
//   → elemento está na raiz do slide
//
// string
//   → elemento é filho daquele container
//
// Essa informação será usada para habilitar/desabilitar
// Move Up e Move Down no Editor.
// ============================================================

export interface ElementSiblingPosition {
  index: number;

  count: number;

  parentId:
    | string
    | null;
}


export function findElementSiblingPosition(
  elements: readonly PowerShowElement[],
  id: string,
  parentId:
    | string
    | null = null,
): ElementSiblingPosition | null {
  for (
    let index = 0;
    index < elements.length;
    index += 1
  ) {
    const element =
      elements[index];


    if (!element) {
      continue;
    }


    if (
      element.id === id
    ) {
      return {
        index,

        count:
          elements.length,

        parentId,
      };
    }


    if (
      element.type ===
      "container"
    ) {
      const found =
        findElementSiblingPosition(
          element.children,
          id,
          element.id,
        );


      if (found) {
        return found;
      }
    }
  }


  return null;
}

// ============================================================
// END: ELEMENT SIBLING POSITION
// ============================================================


// ============================================================
// BEGIN: MOVE ELEMENT
//
// Move somente dentro da lista atual de irmãos.
//
// offset:
//
// -1 → uma posição para cima
// +1 → uma posição para baixo
//
// Não atravessamos boundaries de containers nesta fase.
// ============================================================

export function moveElementById(
  elements: PowerShowElement[],
  id: string,
  offset: -1 | 1,
): PowerShowElement[] {
  // ----------------------------------------------------------
  // Primeiro verificamos se o elemento está neste nível.
  // ----------------------------------------------------------

  const currentIndex =
    elements.findIndex(
      (element) =>
        element.id === id,
    );


  if (
    currentIndex !== -1
  ) {
    const targetIndex =
      currentIndex +
      offset;


    // --------------------------------------------------------
    // Está no início/fim da lista.
    // Nenhuma alteração.
    // --------------------------------------------------------

    if (
      targetIndex < 0 ||
      targetIndex >=
        elements.length
    ) {
      return elements;
    }


    const nextElements = [
      ...elements,
    ];


    const [
      movedElement,
    ] =
      nextElements.splice(
        currentIndex,
        1,
      );


    if (!movedElement) {
      return elements;
    }


    nextElements.splice(
      targetIndex,
      0,
      movedElement,
    );


    return nextElements;
  }


  // ----------------------------------------------------------
  // Não está neste nível.
  // Procuramos recursivamente nos containers.
  // ----------------------------------------------------------

  let changed =
    false;


  const nextElements =
    elements.map(
      (element) => {
        if (
          element.type !==
          "container"
        ) {
          return element;
        }


        const children =
          moveElementById(
            element.children,
            id,
            offset,
          );


        // ----------------------------------------------------
        // Nenhuma mudança ocorreu neste subtree.
        // Preservamos a referência original.
        // ----------------------------------------------------

        if (
          children ===
          element.children
        ) {
          return element;
        }


        changed =
          true;


        return {
          ...element,

          children,
        };
      },
    );


  return changed
    ? nextElements
    : elements;
}

// ============================================================
// END: MOVE ELEMENT
// ============================================================