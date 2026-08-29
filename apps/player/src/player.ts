import type { Presentation } from "@powershow/document-schema";

import {
  fitLogicalSlideGeometry,
  hydrateRendererRuntime,
  paletteColorCssVariableName,
  renderFontResources,
  renderSlide,
} from "@powershow/renderer";

// ============================================================
// TIPOS PÚBLICOS DO PLAYER
// ============================================================

export type PlayerTransition = "none" | "fade";

// ============================================================
// BEGIN: POSIÇÃO DOS CONTROLES
//
// NOVO nesta etapa.
//
// Mantemos um conjunto pequeno e controlado de posições.
// O usuário do Editor não terá acesso a top/left/right em CSS.
// ============================================================

export type PlayerControlsPosition =
  | "bottom-center"
  | "bottom-left"
  | "bottom-right"
  | "top-center"
  | "top-left"
  | "top-right";
// ============================================================
// BEGIN: OPÇÕES DOS CONTROLES
// ============================================================

export interface PlayerControlsOptions {
  // Onde a barra é posicionada.
  position?: PlayerControlsPosition;

  // Mostra ou oculta "1 / 3".
  showCounter?: boolean;

  // Aparência estrutural:
  // floating | minimal | compact
  style?: PlayerControlsStyle;

  // Como a barra aparece/desaparece:
  // fade | slide | none
  animation?: PlayerControlsAnimation;
}

// ============================================================
// END: OPÇÕES DOS CONTROLES
// ============================================================

// ============================================================
// BEGIN: VARIANTES VISUAIS DOS CONTROLES
//
// São opções estruturadas e limitadas.
//
// O Editor futuramente poderá apresentar algo como:
//
// Aparência:
// - Flutuante
// - Minimalista
// - Compacta
//
// Não expomos propriedades CSS ao usuário.
// ============================================================

export type PlayerControlsStyle = "floating" | "minimal" | "compact";

// ============================================================
// END: VARIANTES VISUAIS DOS CONTROLES
// ============================================================

// ============================================================
// BEGIN: ANIMAÇÃO DOS CONTROLES
//
// Define como a barra aparece e desaparece.
//
// "fade":
//   Transição suave de opacidade.
//
// "slide":
//   Opacidade + pequeno deslocamento.
//
// "none":
//   Mudança imediata.
//
// São opções prontas. O usuário não configura duração,
// transform ou curvas CSS diretamente.
// ============================================================

export type PlayerControlsAnimation = "fade" | "slide" | "none";

// ============================================================
// END: ANIMAÇÃO DOS CONTROLES
// ============================================================

// ============================================================
// END: POSIÇÃO DOS CONTROLES
// ============================================================

export interface PlayerOptions {
  transition?: PlayerTransition;

  // Mantemos esta opção como já existia.
  // Não vamos movê-la para "controls" nesta etapa,
  // para evitar quebrar código e testes existentes.
  controlsAutoHideMs?: number | null;

  // ==========================================================
  // BEGIN: CONFIGURAÇÃO DOS CONTROLES
  // ==========================================================

  controls?: PlayerControlsOptions;

  // ==========================================================
  // END: CONFIGURAÇÃO DOS CONTROLES
  // ==========================================================
}

export interface PlayerController {
  next(): void;

  previous(): void;

  goTo(index: number): void;

  fullscreen(): Promise<void>;

  getCurrentIndex(): number;

  destroy(): void;
}

// ============================================================
// DEFAULTS
// ============================================================

const DEFAULT_TRANSITION: PlayerTransition = "fade";

const DEFAULT_CONTROLS_AUTO_HIDE_MS = 2500;

// ============================================================
// BEGIN: DEFAULTS DOS CONTROLES
// ============================================================

const DEFAULT_CONTROLS: Required<PlayerControlsOptions> = {
  position: "bottom-center",

  showCounter: true,

  // Mantém a aparência que já tínhamos como padrão.
  style: "floating",
  animation: "fade",
};

// ============================================================
// END: DEFAULTS DOS CONTROLES
// ============================================================

// ============================================================
// AUXILIAR DE QUERY
//
// Garante para o TypeScript que o elemento existe.
// ============================================================

function queryRequired<T extends Element>(
  root: ParentNode,
  selector: string,
): T {
  const element = root.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Required Player element not found: ${selector}`);
  }

  return element;
}

// ============================================================
// BEGIN: API PÚBLICA DO PLAYER
//
// Mantemos o nome "mountPlayer" porque:
// - main.ts já importa mountPlayer
// - os testes já importam mountPlayer
// - não queremos quebrar a API existente
// ============================================================

export function mountPlayer(
  root: HTMLElement,
  presentation: Presentation,
  options: PlayerOptions = {},
): PlayerController {
  // ============================================================
  // END: API PÚBLICA DO PLAYER
  // ============================================================

  const transition = options.transition ?? DEFAULT_TRANSITION;

  const controlsAutoHideMs =
    options.controlsAutoHideMs === undefined
      ? DEFAULT_CONTROLS_AUTO_HIDE_MS
      : options.controlsAutoHideMs;

  // ==========================================================
  // BEGIN: RESOLVE CONFIGURAÇÃO DOS CONTROLES
  // ==========================================================

  const controlsOptions: Required<PlayerControlsOptions> = {
    ...DEFAULT_CONTROLS,
    ...options.controls,
  };

  // ==========================================================
  // END: RESOLVE CONFIGURAÇÃO DOS CONTROLES
  // ==========================================================

  // ----------------------------------------------------------
  // Estado interno
  // ----------------------------------------------------------

  let currentIndex = 0;

  let controlsHideTimer: ReturnType<typeof setTimeout> | undefined;

  let destroyed = false;

  // ----------------------------------------------------------
  // Estrutura HTML do Player
  //
  // IMPORTANTE:
  // - slide-host contém somente o slide.
  // - controls é irmão do slide-host.
  // - navegação não pertence ao renderSlide().
  // ----------------------------------------------------------

  root.innerHTML = `
    <div class="powershow-player">
      <div class="powershow-player-stage">

        <div
          class="powershow-player-slide-host"
        >
          <div
            class="powershow-player-slide-surface"
          ></div>
        </div>

        <div
          class="powershow-player-controls"
        >
          <button
            type="button"
            data-player-action="previous"
            aria-label="Previous slide"
          >
            ←
          </button>

          <!-- ======================================================
              CONTADOR DE SLIDES

              Usamos <output> porque ele possui semanticamente
              uma propriedade "value", preservando o contrato
              já utilizado pelos testes do Player.
              ====================================================== -->

          <output
            class="powershow-player-counter"
          ></output>

          <button
            type="button"
            data-player-action="next"
            aria-label="Next slide"
          >
            →
          </button>

          <button
            type="button"
            data-player-action="fullscreen"
            aria-label="Fullscreen"
          >
            ⛶
          </button>
        </div>

      </div>
    </div>
  `;

  // ----------------------------------------------------------
  // Elementos necessários
  // ----------------------------------------------------------

  const player = queryRequired<HTMLElement>(root, ".powershow-player");

  const fontResourceCss = renderFontResources(presentation.resources?.fonts);

  if (fontResourceCss) {
    const fontResourceStyle = document.createElement("style");

    fontResourceStyle.setAttribute("data-powershow-font-resources", "");
    fontResourceStyle.textContent = fontResourceCss;
    player.prepend(fontResourceStyle);
  }

  const stage = queryRequired<HTMLElement>(root, ".powershow-player-stage");

  const slideHost = queryRequired<HTMLElement>(
    root,
    ".powershow-player-slide-host",
  );

  const slideSurface = queryRequired<HTMLElement>(
    root,
    ".powershow-player-slide-surface",
  );

  const controls = queryRequired<HTMLElement>(
    root,
    ".powershow-player-controls",
  );

  for (const color of presentation.palette?.colors ?? []) {
    slideSurface.style.setProperty(
      paletteColorCssVariableName(color.id),
      color.value,
    );
  }

  // ==========================================================
  // BEGIN: REFERÊNCIA AO CONTADOR
  //
  // <output> expõe a propriedade "value".
  // ==========================================================

  const counter = queryRequired<HTMLOutputElement>(
    root,
    ".powershow-player-counter",
  );

  // ==========================================================
  // END: REFERÊNCIA AO CONTADOR
  // ==========================================================

  const previousButton = queryRequired<HTMLButtonElement>(
    root,
    '[data-player-action="previous"]',
  );

  const nextButton = queryRequired<HTMLButtonElement>(
    root,
    '[data-player-action="next"]',
  );

  const fullscreenButton = queryRequired<HTMLButtonElement>(
    root,
    '[data-player-action="fullscreen"]',
  );

  // ============================================================
  // BEGIN: VISIBILIDADE DO CONTADOR
  //
  // Usamos a propriedade HTML "hidden".
  // Isso mantém a decisão simples e sem CSS customizado.
  //
  // showCounter: true
  //   → mostra "1 / 3"
  //
  // showCounter: false
  //   → contador não aparece
  // ============================================================

  counter.hidden = !controlsOptions.showCounter;

  // ============================================================
  // END: VISIBILIDADE DO CONTADOR
  // ============================================================
  
  // ==========================================================
  // BEGIN: CLASSES ESTRUTURAIS DOS CONTROLES
  //
  // Exemplo:
  //
  // powershow-player-controls
  // powershow-player-controls-top-right
  // powershow-player-controls-compact
  // powershow-player-controls-slide
  //
  // Cada aspecto permanece independente.
  // ==========================================================

  controls.classList.add(
    `powershow-player-controls-${controlsOptions.position}`,
  );

  controls.classList.add(`powershow-player-controls-${controlsOptions.style}`);

  controls.classList.add(
    `powershow-player-controls-${controlsOptions.animation}`,
  );

  // ==========================================================
  // END: CLASSES ESTRUTURAIS DOS CONTROLES
  // ==========================================================

  // ----------------------------------------------------------
  // Ajusta o tamanho do stage mantendo o aspect ratio
  // ----------------------------------------------------------

  function updateStageSize(): void {
    const geometry = fitLogicalSlideGeometry(
      presentation.aspectRatio,
      window.innerWidth,
      window.innerHeight,
    );

    stage.style.width = `${geometry.physicalWidth}px`;

    stage.style.height = `${geometry.physicalHeight}px`;

    slideSurface.style.width = `${geometry.logicalWidth}px`;

    slideSurface.style.height = `${geometry.logicalHeight}px`;

    slideSurface.style.transform = `scale(${geometry.scale})`;

    hydrateRendererRuntime(slideHost);
  }

  // ============================================================
  // BEGIN: ATUALIZA ESTADO DOS CONTROLES
  //
  // Atualiza:
  // - contador;
  // - botão anterior;
  // - botão próximo.
  // ============================================================

  function updateControls(): void {
    const slideCount = presentation.slides.length;

    // ----------------------------------------------------------
    // Apresentação vazia
    // ----------------------------------------------------------

    if (slideCount === 0) {
      counter.value = "0 / 0";

      previousButton.disabled = true;

      nextButton.disabled = true;

      return;
    }

    // ----------------------------------------------------------
    // Contador no formato:
    //
    // 1 / 3
    // 2 / 3
    // 3 / 3
    // ----------------------------------------------------------

    counter.value = `${currentIndex + 1} / ${slideCount}`;

    // ----------------------------------------------------------
    // Estado dos botões nos limites da apresentação.
    // ----------------------------------------------------------

    previousButton.disabled = currentIndex === 0;

    nextButton.disabled = currentIndex === slideCount - 1;
  }

  // ============================================================
  // END: ATUALIZA ESTADO DOS CONTROLES
  // ============================================================

  // ----------------------------------------------------------
  // Animação do slide
  // ----------------------------------------------------------

  function animateSlide(): void {
    if (transition !== "fade") {
      return;
    }

    // Element.animate não existe em alguns
    // ambientes de teste / browsers antigos.
    if (typeof slideHost.animate !== "function") {
      return;
    }

    slideHost.animate(
      [
        {
          opacity: 0,
          transform: "scale(0.995)",
        },

        {
          opacity: 1,
          transform: "scale(1)",
        },
      ],
      {
        duration: 180,
        easing: "ease-out",
      },
    );
  }

  // ----------------------------------------------------------
  // Renderiza o slide atual
  // ----------------------------------------------------------

  function renderCurrentSlide(): void {
    const slide = presentation.slides[currentIndex];

    if (!slide) {
      slideSurface.innerHTML = `
        <div
          class="powershow-player-empty"
        >
          No slides
        </div>
      `;

      updateControls();

      return;
    }

    slideSurface.innerHTML = renderSlide(slide, { presentation });

    hydrateRendererRuntime(slideSurface);

    animateSlide();

    updateControls();
  }

  // ----------------------------------------------------------
  // Auto-hide dos controles
  // ----------------------------------------------------------

  function clearControlsTimer(): void {
    if (controlsHideTimer === undefined) {
      return;
    }

    clearTimeout(controlsHideTimer);

    controlsHideTimer = undefined;
  }

  function showControls(): void {
    controls.classList.remove("powershow-player-controls-hidden");

    clearControlsTimer();

    if (controlsAutoHideMs === null) {
      return;
    }

    controlsHideTimer = setTimeout(
      () => {
        controls.classList.add("powershow-player-controls-hidden");
      },

      controlsAutoHideMs,
    );
  }

  // ============================================================
  // BEGIN: NAVEGAÇÃO DIRETA PARA UM SLIDE
  //
  // CONTRATO DO PLAYER:
  //
  // - índice válido:
  //   navega normalmente.
  //
  // - índice negativo:
  //   ignora.
  //
  // - índice maior que o último slide:
  //   ignora.
  //
  // Não fazemos "clamp" para o primeiro/último slide.
  // Esse comportamento já é coberto pelos testes existentes.
  // ============================================================

  function goTo(index: number): void {
    // ----------------------------------------------------------
    // Se não há slides, não há navegação possível.
    // ----------------------------------------------------------

    if (presentation.slides.length === 0) {
      return;
    }

    // ----------------------------------------------------------
    // Ignora índices fora dos limites da apresentação.
    // ----------------------------------------------------------

    if (index < 0 || index >= presentation.slides.length) {
      return;
    }

    // ----------------------------------------------------------
    // Se já estamos nesse slide, não precisamos renderizar
    // novamente.
    // ----------------------------------------------------------

    if (index === currentIndex) {
      updateControls();

      return;
    }

    // ----------------------------------------------------------
    // Atualiza estado e renderiza o novo slide.
    // ----------------------------------------------------------

    currentIndex = index;

    renderCurrentSlide();

    showControls();
  }

  // ============================================================
  // END: NAVEGAÇÃO DIRETA PARA UM SLIDE
  // ============================================================

  function next(): void {
    goTo(currentIndex + 1);
  }

  function previous(): void {
    goTo(currentIndex - 1);
  }

  // ----------------------------------------------------------
  // Fullscreen
  // ----------------------------------------------------------

  async function fullscreen(): Promise<void> {
    // Se já estamos em fullscreen,
    // tenta sair.
    if (document.fullscreenElement) {
      if (typeof document.exitFullscreen === "function") {
        await document.exitFullscreen();
      }

      return;
    }

    // Caso contrário,
    // entra em fullscreen pelo root.
    if (typeof root.requestFullscreen === "function") {
      await root.requestFullscreen();
    }
  }

  // ----------------------------------------------------------
  // Eventos dos botões
  // ----------------------------------------------------------

  function handlePreviousClick(): void {
    previous();
  }

  function handleNextClick(): void {
    next();
  }

  function handleFullscreenClick(): void {
    void fullscreen();
  }

  previousButton.addEventListener("click", handlePreviousClick);

  nextButton.addEventListener("click", handleNextClick);

  fullscreenButton.addEventListener("click", handleFullscreenClick);

  // ----------------------------------------------------------
  // Eventos do mouse / pointer
  //
  // Estes listeners são registrados UMA única vez.
  // Não devem entrar dentro de updateStageSize().
  // ----------------------------------------------------------

  function handlePointerActivity(): void {
    showControls();
  }

  stage.addEventListener("pointermove", handlePointerActivity);

  stage.addEventListener("pointerdown", handlePointerActivity);

  // ----------------------------------------------------------
  // Keyboard
  // ----------------------------------------------------------

  function handleKeyDown(event: KeyboardEvent): void {
    switch (event.key) {
      case "ArrowRight":
      case "PageDown": {
        event.preventDefault();

        next();

        break;
      }

      case "ArrowLeft":
      case "PageUp": {
        event.preventDefault();

        previous();

        break;
      }

      case "Home": {
        event.preventDefault();

        goTo(0);

        break;
      }

      case "End": {
        event.preventDefault();

        goTo(presentation.slides.length - 1);

        break;
      }

      case "f":
      case "F": {
        event.preventDefault();

        void fullscreen();

        break;
      }
    }
  }

  window.addEventListener("keydown", handleKeyDown);

  // ----------------------------------------------------------
  // Resize
  // ----------------------------------------------------------

  function handleResize(): void {
    updateStageSize();
  }

  window.addEventListener("resize", handleResize);

  // ----------------------------------------------------------
  // Inicialização
  // ----------------------------------------------------------

  updateStageSize();

  renderCurrentSlide();

  showControls();

  // ----------------------------------------------------------
  // API pública
  // ----------------------------------------------------------

  return {
    next,

    previous,

    goTo,

    fullscreen,

    getCurrentIndex(): number {
      return currentIndex;
    },

    destroy(): void {
      // destroy precisa ser idempotente.
      if (destroyed) {
        return;
      }

      destroyed = true;

      clearControlsTimer();

      // ------------------------------------------------------
      // Remove listeners dos botões
      // ------------------------------------------------------

      previousButton.removeEventListener("click", handlePreviousClick);

      nextButton.removeEventListener("click", handleNextClick);

      fullscreenButton.removeEventListener("click", handleFullscreenClick);

      // ------------------------------------------------------
      // Remove pointer listeners
      // ------------------------------------------------------

      stage.removeEventListener("pointermove", handlePointerActivity);

      stage.removeEventListener("pointerdown", handlePointerActivity);

      // ------------------------------------------------------
      // Remove listeners globais
      // ------------------------------------------------------

      window.removeEventListener("keydown", handleKeyDown);

      window.removeEventListener("resize", handleResize);

      // ------------------------------------------------------
      // Remove Player do DOM
      // ------------------------------------------------------

      root.innerHTML = "";
    },
  };
}
