import type {
  PowerShowElement,
  Slide,
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


  return {
    ...clone,

    id,
  };
}

// ============================================================
// END: CLONE RECURSIVO DE ELEMENTO
// ============================================================


// ============================================================
// BEGIN: CREATE SLIDE
//
// Um novo slide começa propositalmente simples.
//
// Não criamos container/text automaticamente nesta fase.
// Element CRUD será responsável por isso posteriormente.
// ============================================================

export function createBlankSlide(
  slides: readonly Slide[],
): Slide {
  const usedIds =
    collectPresentationIds(
      slides,
    );


  const id =
    createUniqueId(
      "slide",
      usedIds,
    );


  return {
    id,

    title:
      "Untitled slide",

    summary:
      "",

    speakerNotes:
      "",

    elements:
      [],

    background: {
      color:
        "#0b1020",
    },
  };
}

// ============================================================
// END: CREATE SLIDE
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