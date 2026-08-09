import type {
  PowerShowElement,
} from "@powershow/document-schema";


// ============================================================
// BEGIN: BUSCA DE ELEMENTO NA ÁRVORE
//
// Procura recursivamente um elemento pelo ID.
//
// Containers podem conter outros containers, portanto a busca
// não pode considerar somente os elementos raiz do slide.
// ============================================================

export function findElementById(
  elements: PowerShowElement[],
  id: string,
): PowerShowElement | null {
  for (const element of elements) {
    if (element.id === id) {
      return element;
    }

    if (element.type === "container") {
      const found =
        findElementById(
          element.children,
          id,
        );

      if (found) {
        return found;
      }
    }
  }

  return null;
}

// ============================================================
// END: BUSCA DE ELEMENTO NA ÁRVORE
// ============================================================


// ============================================================
// BEGIN: ATUALIZAÇÃO IMUTÁVEL DE ELEMENTO
//
// Recebe:
//
// - árvore atual;
// - ID do elemento;
// - função que produz a nova versão.
//
// A atualização é imutável para funcionar corretamente com
// React state.
//
// Não alteramos objetos existentes diretamente.
// ============================================================

export function updateElementById(
  elements: PowerShowElement[],
  id: string,
  update: (
    element: PowerShowElement,
  ) => PowerShowElement,
): PowerShowElement[] {
  return elements.map(
    (element) => {
      // ------------------------------------------------------
      // Encontramos o elemento.
      // ------------------------------------------------------

      if (element.id === id) {
        return update(
          element,
        );
      }


      // ------------------------------------------------------
      // Containers exigem busca recursiva.
      // ------------------------------------------------------

      if (
        element.type === "container"
      ) {
        return {
          ...element,

          children:
            updateElementById(
              element.children,
              id,
              update,
            ),
        };
      }


      return element;
    },
  );
}

// ============================================================
// END: ATUALIZAÇÃO IMUTÁVEL DE ELEMENTO
// ============================================================