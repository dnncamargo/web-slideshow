import type { DocsGroup, DocsTopic } from "./docs-content-types";
import { advancedDocsGroup } from "./docs-content-advanced";
import { elementDocsGroup } from "./docs-content-elements";

export type { DocsCodeBlock, DocsGroup, DocsSection, DocsTable, DocsTopic } from "./docs-content-types";

export const docsGroups: readonly DocsGroup[] = [
  {
    title: "Comece aqui",
    topics: [
      {
        id: "overview",
        title: "Visão geral",
        summary:
          "A aplicação é um sistema web para criar, publicar, exibir e controlar apresentações interativas.",
        sections: [
          {
            title: "O que é a aplicação",
            paragraphs: [
              "A aplicação separa autoria, publicação e reprodução. A apresentação é um documento estruturado, validado e independente das superfícies que o editam ou reproduzem.",
              "A prioridade arquitetural é permitir autoria rica sem transformar o Player em um segundo Editor. O documento deve continuar previsível e o playback deve permanecer leve.",
            ],
          },
          {
            title: "Superfícies principais",
            bullets: [
              "Library: gerenciamento de apresentações e organização.",
              "Editor: autoria de slides, elementos, estilos e recursos.",
              "Control: controle remoto da apresentação e ferramentas operacionais.",
              "Player: runtime moderno de apresentação.",
              "Watch: acompanhamento público read-only da apresentação ao vivo.",
              "Player Legacy: runtime de compatibilidade para ambientes mais limitados.",
              "Public Portal: porta de entrada pública para Studio, Player e sessão ao vivo.",
            ],
          },
        ],
      },
      {
        id: "principles",
        title: "Princípios",
        summary:
          "As decisões do sistema preservam um contrato único, boundaries explícitos e um runtime pequeno.",
        sections: [
          {
            title: "Princípios de primeira ordem",
            bullets: [
              "Um documento canônico define o que uma apresentação é.",
              "O renderer compartilhado define como o documento validado é apresentado.",
              "Studio e Player são superfícies diferentes e não devem depender um do outro.",
              "Firestore é persistência durável; RTDB coordena estado efêmero de sessão.",
              "Versões publicadas são imutáveis.",
              "Custom Library pertence à autoria; o Player não depende dela para reproduzir uma publicação.",
              "Segurança e autorização devem ser aplicadas na camada de dados, não apenas pela interface.",
            ],
          },
          {
            title: "Preferências de implementação",
            bullets: [
              "Preferir HTML e CSS antes de SVG, JavaScript contínuo ou Canvas.",
              "Evitar dependências grandes no Player e no renderer.",
              "Slides inativos devem consumir quase nenhum processamento.",
              "Recursos interativos devem ser event-driven sempre que possível.",
            ],
          },
        ],
      },
      {
        id: "presentation-lifecycle",
        title: "Ciclo da apresentação",
        summary:
          "O fluxo principal é Draft → Publish → Version → Session.",
        sections: [
          {
            title: "Fluxo",
            code: "Draft\n  ↓\nPublish\n  ↓\nImmutable Version\n  ↓\nLive Session\n  ↓\nPlayer / Control / Watch",
          },
          {
            title: "Consequência",
            paragraphs: [
              "Editar um draft não altera silenciosamente o que já está sendo exibido. Uma sessão Live referencia uma versão publicada específica e usa essa identidade durante sua execução.",
            ],
          },
        ],
      },
    ],
  },
  {
    title: "Arquitetura",
    topics: [
      {
        id: "monorepo",
        title: "Monorepo e módulos",
        summary:
          "A aplicação é um monorepo pnpm com apps e packages compartilhados.",
        sections: [
          {
            title: "Apps",
            bullets: [
              "apps/studio: Public Portal, Library, Editor, Control e interfaces administrativas.",
              "apps/player: runtime moderno e público.",
              "apps/player-legacy: runtime de compatibilidade.",
            ],
          },
          {
            title: "Packages",
            bullets: [
              "packages/document-schema: contrato canônico e validação.",
              "packages/renderer: transformação do documento em saída visual.",
              "packages/firebase: codec canônico de presentationJson para persistência Firestore e limites de payload.",
              "packages/math-source: parsing e geometria matemática restrita para Plot.",
              "packages/theme: fundamentos visuais compartilhados.",
              "packages/ui: componentes reutilizáveis de aplicação.",
            ],
          },
        ],
      },
      {
        id: "ownership",
        title: "Ownership e boundaries",
        summary:
          "Cada camada possui um tipo de estado e responsabilidade próprios.",
        sections: [
          {
            title: "Ownership principal",
            code: "document-schema → verdade persistível\nStudio          → autoria e organização\nrenderer        → interpretação visual\nFirestore       → estado durável\nRTDB            → execução Live\nPlayer          → estado aplicado no runtime",
          },
          {
            title: "Regra prática",
            paragraphs: [
              "Uma nova feature deve ser colocada no owner que realmente possui seu estado. Estado transitório de UI não deve migrar para o documento sem necessidade; estado Live não deve virar persistência durável; e detalhes de Firebase não devem virar tipos de domínio.",
            ],
          },
          {
            title: "Styles da Presentation",
            paragraphs: [
              "Para uma propriedade P pertencente a um Style, a resolução é: propriedade local autorada > propriedade do Style mestre > Theme, role ou default do elemento. A presença ou ausência autorada define ownership; não há timestamp nem metadado persistente de proveniência.",
            ],
            code: "local authored P\n> master Style P\n> Theme / role / element default",
          },
          {
            title: "Inspector e Resources",
            paragraphs: [
              "O Inspector edita localmente o elemento selecionado e mantém a relação com o Style. Resources edita o Style compartilhado e afeta todos os usos aplicáveis atualmente vinculados. Add, Edit ou Remove da propriedade P pelo master limpa apenas P nos usos vinculados; propriedades não relacionadas permanecem intactas. Em Text, content e rich content estão fora dessa ownership.",
            ],
          },
          {
            title: "Attach, Switch e Detach",
            bullets: [
              "Attach aplica as propriedades definidas pelo destino.",
              "Switch usa somente a ownership do destino: propriedades definidas pelo destino limpam o local; propriedades omitidas preservam um local existente e deixam uma propriedade ausente continuar no default normal. Um valor não é materializado apenas porque existia no Style de origem.",
              "Detach remove a relação, preserva os locais existentes e materializa o estado efetivo fornecido pelo master quando necessário para preservar a aparência. Detach não é Switch.",
              "Essas regras descrevem relações de Text Styles e Linked Styles. Remover a aplicação explícita de uma Root Definition é diferente: não materializa a árvore master no Slide; o Slide volta ao defaultRootDefinitionId e, sem default, ao modo sem Root.",
            ],
          },
          {
            title: "Linked Styles e Topics",
            paragraphs: [
              "Linked Styles são target-aware e atualmente atendem Container e Topics. Eles não implicam suporte para todos os tipos de elemento. Em Topics, kind ausente é uma autoria diferente de kind = unordered; um unordered explícito pode ser propriedade do Linked Topics Style e aparecer como Linked no Inspector.",
            ],
          },
        ],
      },
      {
        id: "renderer",
        title: "Renderer compartilhado",
        summary:
          "Studio e Player consomem o mesmo modelo visual básico por meio do renderer.",
        sections: [
          {
            title: "Responsabilidade",
            paragraphs: [
              "O renderer recebe uma Presentation validada e transforma slides e elementos em saída visual. Ele conhece a semântica do documento, mas não deve fazer o documento depender de uma biblioteca ou implementação específica de renderização.",
            ],
          },
          {
            title: "Direção de dependência",
            code: "Canonical Presentation\n        │\n        ▼\n shared renderer\n    ┌───┴───┐\n    ▼       ▼\n Studio   Player",
          },
        ],
      },
    ],
  },
  {
    title: "Documento canônico",
    topics: [
      {
        id: "presentation-schema",
        title: "Presentation",
        summary:
          "A raiz canônica permanece em schemaVersion 1 e contém identidade, recursos, estilos, Root Definitions e slides.",
        sections: [
          {
            title: "Shape raiz",
            code: "Presentation\n├── schemaVersion: 1\n├── id\n├── title\n├── description\n├── aspectRatio\n├── resources?\n├── palette?\n├── textStyles?\n├── linkedStyles?\n├── rootDefinitions?\n├── defaultRootDefinitionId?\n└── slides[]",
          },
          {
            title: "Contrato",
            paragraphs: [
              "O schema é persistido e validado. Ele é a fonte de verdade para importação, edição, publicação e playback. O número de schema permanece literalmente 1; não existe um envelope paralelo de schema v2 no contrato atual.",
            ],
          },
        ],
      },
      {
        id: "slides-elements",
        title: "Slides e elementos",
        summary:
          "Slides contêm elementos, e Containers permitem composição hierárquica recursiva.",
        sections: [
          {
            title: "Elementos canônicos atuais",
            bullets: [
              "text",
              "image",
              "gallery",
              "code",
              "terminal",
              "table",
              "plot",
              "interactive",
              "divider",
              "embed",
              "blocks",
              "scripted",
              "topics",
              "container",
            ],
          },
          {
            title: "Não canônicos",
            paragraphs: [
              "chart e textbox não pertencem à union canônica atual. Composição visual deve reutilizar os tipos existentes em vez de inventar tipos de conteúdo redundantes.",
            ],
          },
        ],
      },
      {
        id: "root-definitions",
        title: "Root Definitions",
        summary:
          "Root Definitions existem para normalizar estruturalmente a Presentation e reduzir repetição persistida. O objetivo é manter menor a árvore canônica em JSON/Firebase e permitir reutilização estável de uma base estrutural sem copiar a mesma árvore para cada Slide.",
        sections: [
          {
            title: "Objetivo de produto e modelo canônico",
            paragraphs: [
              "Root Definitions fornecem normalização estrutural: reduzem a repetição da estrutura canônica e a duplicação do payload em JSON/Firestore, tornam reutilizáveis bases estruturais e estéticas compartilhadas e centralizam a edição de estrutura repetida. A analogia útil é a reutilização de estilos em CSS, mas Root Definition possui estrutura de PresentationElement, não apenas propriedades de estilo.",
              "A implementação canônica atual mantém rootDefinitions separadas dos Slides. Cada Root Definition contém id, name, root ContainerElement e, opcionalmente, localChildTargetIds; o Slide guarda apenas a referência rootDefinitionId e não copia a árvore Root em slide.elements.",
              "materializeSlide é uma projeção de runtime/autoria da árvore efetiva, não uma operação de persistência. A técnica pode variar internamente, mas não deve reintroduzir repetição no documento canônico nem alterar identidade, History, referências ou compatibilidade.",
            ],
          },
          {
            title: "Fluxo de autoria implementado",
            paragraphs: [
              "No fluxo New, o usuário escolhe Slide ou Root Definition e reutiliza o shared preset/layout picker. Para Root Definition, informa name, cria e continua no mesmo workspace do Editor.",
              "Canvas, Inspector, Elements/Selector, Clipboard, History e Custom Resources são a mesma experiência de autoria; não existe um segundo editor de Root.",
              "Roots existentes são reabertas e gerenciadas em Custom Resources → This Presentation → Root Definitions. O gerenciamento atual inclui Open/Edit, Rename e Delete quando a Root não está referenciada; uma Presentation pode possuir múltiplas Roots.",
              "Um Slide normal pode ser associado a uma Root Definition pelo Slide Inspector. A associação é referencial: não copia a Root para slide.elements, não limpa conteúdo preenchido automaticamente e não migra elementos para localRootChildren. Um Slide incompatível é recusado; switch/unlink permanece condicionado à validação.",
            ],
          },
          {
            title: "Estado arquitetural atual",
            paragraphs: [
              "No contrato canônico atual, uma Presentation pode conter múltiplas Root Definitions e cada Slide resolve no máximo uma Root Definition efetiva. A resolução atual é slide.rootDefinitionId ?? presentation.defaultRootDefinitionId ?? nenhuma Root.",
              "A forma canônica é Presentation → rootDefinitions? → RootDefinition → root, com slides[] contendo rootDefinitionId?, elements e localRootChildren?. Em um Slide Root-backed, elements permanece vazio para a estrutura compartilhada; a árvore efetiva é produzida por materializeSlide.",
            ],
            code: "Slide explicit Root\n  ?? Presentation default Root\n  ?? no Root\n\nRuntime: MaterializedSlide.elements = effective complete tree",
          },
          {
            title: "Receiver autorizado e segurança estrutural",
            bullets: [
              "Containers e demais elementos da Root Definition continuam master-owned no modelo atual; suas propriedades não se misturam com propriedades locais do Slide.",
              "Permitir conteúdo local é uma autorização estrutural explícita da própria Root. localChildTargetIds identifica os Containers master autorizados a receber conteúdo local do Slide; por default não há receiver autorizado.",
              "A autorização de um Container como receiver é o toggle implementado na edição da Root Definition. Ela não implementa a autoria dos filhos locais: localChildTargetIds são receivers master autorizados, enquanto slide.localRootChildren seriam o conteúdo efetivamente owned pelo Slide; essa autoria ainda não foi entregue.",
              "Desabilitar receiver em uso é bloqueado; excluir receiver/ancestral em uso é bloqueado; excluir receiver autorizado não usado remove a autorização obsoleta. Nenhum conteúdo local é silenciosamente excluído ou remapeado.",
              "Excluir uma Root é bloqueado enquanto ela for referenciada por defaultRootDefinitionId ou por rootDefinitionId explícito de qualquer Slide. Não há cascade unlink/delete.",
            ],
          },
          {
            title: "Unlink de Root não é Detach de Style",
            paragraphs: [
              "Text Styles e Linked Styles são relações de estilo. Seu Detach pode materializar valores efetivos no elemento local para preservar a aparência.",
              "No contrato atual, remover a referência explícita de Root remove slide.rootDefinitionId; a resolução volta ao defaultRootDefinitionId quando existir ou a nenhuma Root quando não existir default. Não existe sentinel de ignore default.",
            ],
            code: "Style detach: reference → local effective values\nRoot unlink: explicit Root → default Root → no Root",
          },
          {
            title: "Custom Resources no workspace de Root",
            paragraphs: [
              "Custom Resources faz parte do mesmo workspace de autoria da Root Definition. A restrição correta é por ownership da operação, não por estar ou não em modo Root.",
            ],
            bullets: [
              "Palette, Fonts e definições de Text Style e Linked Style são Presentation-global e podem ser usadas enquanto uma Root Definition está ativa.",
              "Attach, usage, navigation, detach e create-from-selected devem escrever na árvore canônica dona do elemento, seja Slide ou Root Definition.",
              "This Presentation é a superfície para reencontrar, abrir e gerenciar Root Definitions existentes sem criar um segundo editor ou uma segunda arquitetura de autoria.",
              "Operações que ainda têm implementação tecnicamente Slide-only continuam indisponíveis no Root até se tornarem owner-aware; isso não constitui uma proibição de produto para Custom Resources.",
              "O Apply de Element Style da Custom Library continua condicionado a uma implementação owner-aware; o contrato atual baseado em Slide não deve ser liberado no Root por simples remoção de guard.",
            ],
          },
          {
            title: "History, persistência e transferência",
            paragraphs: [
              "As ações de Presentation para Create Root Definition, Rename Root Definition, Delete Root Definition, Change Root Definition e Change local content receiver usam metadados semânticos no History. Edições de elementos da Root reutilizam o History normal orientado pelo owner. History é session-only e não é persistido; AuthoringTarget e navegação de UI não fazem parte do documento de History.",
              "O draft Firestore persiste a Presentation canônica completa como { presentationJson: string }. Root Definitions continuam dentro do JSON canônico; não existe modelo estruturado novo de Root no Firestore.",
              "Export exporta o JSON canônico diretamente. Import normaliza identidades de Root Definition e Root estrutural e remapeia defaultRootDefinitionId, slide.rootDefinitionId, localChildTargetIds e localRootChildren.targetContainerId, preservando imutabilidade da origem e normalização determinística. schemaVersion permanece literalmente 1.",
            ],
          },
          {
            title: "Publicação e runtime",
            paragraphs: [
              "Publish copia o presentationJson canônico autoritativo para uma versão imutável. A versão publicada continua referencial; Player, Control, Library thumbnails e renderer consomem projeções materializadas e têm cobertura de aceitação para Slides Root-backed.",
              "O MaterializedSlide de runtime expõe a árvore efetiva completa em elements e não expõe rootDefinitionId nem localRootChildren. Não há contrato DOM específico de Root no renderer.",
            ],
          },
          {
            title: "Ainda não implementado",
            bullets: [
              "autoria do conteúdo efetivo de Slide.localRootChildren;",
              "property overrides em elementos master;",
              "UI de gerenciamento do Root default;",
              "duplicação/reordenação de Roots, salvo onde já houver suporte explícito;",
              "Roots aninhadas.",
            ],
          },
        ],
      },
      {
        id: "containers-layout",
        title: "Containers e layout",
        summary:
          "Container é a primitiva estrutural fundamental para linhas, colunas e regiões do slide.",
        sections: [
          {
            title: "Composição",
            paragraphs: [
              "Uma coluna, linha, header, main ou footer pode ser representada por Containers genéricos. Um Container pode conter conteúdo misto e outros Containers.",
            ],
          },
          {
            title: "Presets",
            paragraphs: [
              "Layouts são presets de criação, não restrições permanentes do documento. Depois de criado, o tree canônico resultante é autoritativo e pode ser alterado pelo usuário.",
            ],
          },
          {
            title: "Posicionamento",
            paragraphs: [
              "Layout interno de Container e posicionamento do próprio elemento são responsabilidades diferentes. A composição preferencial parte de Containers hierárquicos; posicionamento absoluto é usado quando a geometria realmente exige.",
            ],
          },
        ],
      },
      {
        id: "resources-styles",
        title: "Recursos, paleta e estilos",
        summary:
          "A Presentation pode carregar recursos e estilos necessários à sua própria reprodução.",
        sections: [
          {
            title: "This Presentation",
            bullets: [
              "resources: recursos canônicos da apresentação, atualmente incluindo fontes por URL HTTP(S).",
              "palette: cores reutilizáveis pela Presentation.",
              "textStyles: estilos tipográficos reutilizáveis.",
              "linkedStyles: propriedades compartilhadas entre elementos por referência.",
            ],
          },
          {
            title: "Independência",
            paragraphs: [
              "Uma versão publicada deve conter ou referenciar pelo próprio documento tudo o que o Player precisa conhecer. O runtime não consulta a Custom Library privada para completar a Presentation.",
            ],
          },
        ],
      },
      {
        id: "validation",
        title: "Validação e limites",
        summary:
          "Documentos persistidos e externos passam pelo schema; presentationJson possui limite seguro explícito.",
        sections: [
          {
            title: "Validação",
            paragraphs: [
              "O documento é validado na entrada e novamente ao ser decodificado da persistência. Referências internas, tipos e propriedades devem satisfazer o contrato antes do uso.",
            ],
          },
          {
            title: "Persistência",
            bullets: [
              "presentationJson é serializado como JSON canônico validado.",
              "undefined é omitido durante a conversão para valor seguro de Firestore.",
              "null é preservado.",
              "o limite seguro atual de presentationJson é 800 KiB.",
            ],
          },
        ],
      },
    ],
  },
  elementDocsGroup,
  advancedDocsGroup,
  {
    title: "Superfícies de produto",
    topics: [
      {
        id: "studio-surfaces",
        title: "Library, Editor e Control",
        summary:
          "As três superfícies autenticadas compartilham o app Studio, mas possuem responsabilidades diferentes.",
        sections: [
          {
            title: "Library",
            paragraphs: [
              "Gerencia apresentações, pastas, arquivamento, criação, abertura e ações relacionadas à organização do acervo privado.",
            ],
          },
          {
            title: "Editor",
            paragraphs: [
              "Autoriza mudanças no documento canônico, gerencia seleção e estado transitório de autoria e salva o draft persistido.",
            ],
          },
          {
            title: "Control",
            paragraphs: [
              "Opera uma sessão publicada: navegação, estado desejado, controles específicos de elementos e Maintenance. O Control não é uma extensão do Editor.",
            ],
          },
        ],
      },
      {
        id: "delete-lifecycle",
        title: "Exclusão e ciclo de vida",
        summary:
          "Elementos e apresentações têm exclusões diferentes, com confirmação, History e autorização coerentes com seu owner.",
        sections: [
          {
            title: "Excluir elementos",
            paragraphs: [
              "A exclusão normal remove o elemento selecionado e seus descendentes como uma ação discreta de History. Para um Container compatível, não vazio e que não esteja em uma das posições incompatíveis abaixo, a confirmação oferece Cancelar, Delete container and children e Delete container, keep children.",
              "Manter os filhos remove somente o wrapper, promove os filhos diretos na posição dos irmãos do Container, preserva a ordem, os IDs e os dados dos filhos e registra uma ação única. Undo restaura o Container e a subárvore exatos; Redo reaplica o unwrap.",
            ],
          },
          {
            title: "Limites de preservar filhos",
            bullets: [
              "Containers vazios permanecem destructive-only.",
              "Containers diretamente pertencentes a ContentSlots de Structured Table permanecem destructive-only.",
              "Containers em ContentSlots de TopicItem cujos filhos diretos incluem Topics permanecem destructive-only.",
              "Nesses casos, a exclusão destrutiva existente continua disponível; não há flattening hierárquico genérico.",
            ],
          },
          {
            title: "Excluir apresentações da Library",
            paragraphs: [
              "Uma apresentação precisa estar arquivada para a exclusão permanente. O ciclo normal é Archive → Delete para drafts não publicados e Publish → Archive → Delete para apresentações publicadas. Uma apresentação Live precisa passar por Live → Stop antes de ser arquivada e excluída.",
              "Ao excluir uma apresentação publicada, a implementação remove as versões históricas em lotes limitados e, no lote final, remove a versão corrente, o pointer da publicação, as notas privadas e o draft privado. Falhas interrompem o ciclo sem fingir que a limpeza terminou.",
            ],
          },
          {
            title: "Autorização de publicação",
            paragraphs: [
              "A propriedade imutável publishedPresentations/{publicationId}.ownerUid é a vinculação de ownership usada pelas Rules e pelo código de publicação/exclusão. presentationId ou metadata pública copiada não provam ownership. Pointers legados sem ownerUid não podem ser reivindicados por um cliente normal; eventual backfill é tooling confiável/Admin e deve ocorrer somente depois da implantação do código owner-bound e das Firestore Rules correspondentes.",
            ],
          },
        ],
      },
      {
        id: "editor-history",
        title: "Histórico do Editor",
        summary:
          "Undo/Redo é uma capacidade de autoria baseada em snapshots da Presentation e válida somente na sessão atual do Editor.",
        sections: [
          {
            title: "Owner e lifetime",
            paragraphs: [
              "O estado undoable pertence ao snapshot da Presentation canônica. Cada ação mantém o estado anterior e o posterior; seleção, estado transitório da interface e clipboard não fazem parte do snapshot.",
              "O Editor retém no máximo 30 ações. History é somente de sessão: não é persistido na Presentation, não muda o schemaVersion e uma nova sessão ou reload começa sem ações anteriores.",
            ],
          },
          {
            title: "Ações semânticas",
            bullets: [
              "Mudanças discretas formam ações separadas; edição numérica, de cor, tamanho e gestos contínuos são coalescidos quando pertencem à mesma interação.",
              "Um gesto concluído de Canvas é uma ação semântica; a prévia intermediária não cria ações persistidas adicionais.",
              "Custom Library Apply é atômico do ponto de vista do usuário. Uma única ação pode criar o elemento e materializar/remapear Font, Text Style e Linked Style; um Undo reverte e um Redo restaura esse conjunto canônico.",
            ],
          },
          {
            title: "Integração com autoria e persistência",
            paragraphs: [
              "Undo e Redo restauram snapshots da Presentation e seguem o pipeline normal de autosave. Save e Publish não limpam History; a seleção é reconciliada separadamente depois de um replay.",
              "A integração cobre os caminhos atuais de Inspector, estrutura, Canvas, recursos e Custom Library para as famílias de elementos e recursos implementadas. Isso descreve a cobertura atual, não uma promessa automática para futuros controles.",
            ],
          },
          {
            title: "UI e teclado",
            bullets: [
              "O painel History é read-only e consome metadados das ações para seus rótulos; ele não deriva labels inspecionando snapshots nem implementa uma segunda History.",
              "Ações aplicadas aparecem da mais nova para a mais antiga. A lista de Redo começa pela próxima ação disponível.",
              "Ctrl/Cmd+Z desfaz e Ctrl/Cmd+Shift+Z refaz quando o alvo não é um controle editável. Campos editáveis mantêm o Undo nativo do input ou editor de texto.",
            ],
          },
        ],
      },
      {
        id: "player-watch-legacy",
        title: "Player, Watch e Legacy",
        summary:
          "O runtime moderno é leve; Watch acompanha; Legacy preserva compatibilidade.",
        sections: [
          {
            title: "Player",
            paragraphs: [
              "Carrega uma versão publicada, monta o renderer e aplica a sessão Live. Ele deve permanecer independente do Studio e evitar dependências grandes ou polling desnecessário.",
            ],
          },
          {
            title: "Watch",
            paragraphs: [
              "Acompanha a apresentação ao vivo de forma pública e read-only em relação ao estado compartilhado. Navegação local, quando disponível, não deve comandar a apresentação principal.",
            ],
          },
          {
            title: "Player Legacy",
            paragraphs: [
              "Existe intencionalmente como runtime de compatibilidade. Recursos modernos podem ter uma representação simplificada, desde que o conteúdo permaneça compreensível e utilizável.",
            ],
          },
        ],
      },
    ],
  },
  {
    title: "Dados e publicação",
    topics: [
      {
        id: "firestore",
        title: "Firestore",
        summary:
          "Firestore guarda o estado durável privado e as versões publicadas.",
        sections: [
          {
            title: "Dados privados",
            bullets: [
              "drafts de apresentação do usuário",
              "pastas",
              "notas de apresentação",
              "Custom Library",
              "paletas e fontes da Custom Library",
            ],
          },
          {
            title: "Dados públicos",
            paragraphs: [
              "A publicação cria um pointer público e versões imutáveis identificadas por publicationId e versionId. A leitura pública acontece por identidade; o conteúdo privado de autoria permanece separado.",
            ],
          },
        ],
      },
      {
        id: "publishing",
        title: "Publicação imutável",
        summary:
          "Publicar cria um snapshot; editar depois não altera a versão que já está em execução.",
        sections: [
          {
            title: "Modelo",
            code: "private draft\n   │ publish\n   ▼\npublishedPresentations/{publicationId}\n   ├── pointer → currentVersionId\n   └── versions/{versionId}\n       └── presentationJson",
          },
          {
            title: "Invariantes",
            bullets: [
              "versões publicadas são imutáveis",
              "o pointer identifica a versão pública corrente",
              "a sessão Live pode permanecer fixada em uma versão específica",
              "publicação e autoria são responsabilidades diferentes",
            ],
          },
        ],
      },
      {
        id: "custom-library",
        title: "Custom Library",
        summary:
          "A biblioteca privada auxilia a autoria, mas não é uma dependência do documento publicado.",
        sections: [
          {
            title: "Fluxo",
            code: "Custom Library\n      │ Apply\n      ▼\nCanonical Presentation\n      │ Publish\n      ▼\nImmutable Version\n      │\n      ▼\nPlayer",
          },
          {
            title: "Regra",
            paragraphs: [
              "Aplicar um item da Custom Library materializa a informação necessária no documento da apresentação. O Player não precisa conhecer o repositório privado que originou aquele conteúdo ou estilo.",
            ],
          },
        ],
      },
    ],
  },
  {
    title: "Live e tempo real",
    topics: [
      {
        id: "live-identity",
        title: "Identidade da sessão",
        summary:
          "live/current define qual publicação e versão pertencem à sessão ativa.",
        sections: [
          {
            title: "Identidade",
            code: "live/current\n├── publicationId\n├── currentVersionId\n└── revision",
          },
          {
            title: "Carregamento",
            paragraphs: [
              "O Player usa publicationId e currentVersionId da sessão para buscar a versão exata no Firestore. Durante o mount Live, essa identidade é mais importante que resolver novamente o pointer público, porque evita que uma publicação posterior troque silenciosamente o conteúdo da sessão já ativa.",
            ],
          },
        ],
      },
      {
        id: "desired-applied",
        title: "Desired e applied state",
        summary:
          "Control declara intenção; Player reporta o estado que efetivamente aplicou.",
        sections: [
          {
            title: "Modelo",
            code: "Control\n  │ desired state\n  ▼\nlive/controlState\n  │\n  ▼\nPlayer\n  │ applied state\n  ▼\nlive/playerState",
          },
          {
            title: "Fencing",
            paragraphs: [
              "Revisões, activationRevision e currentVersionId impedem que comandos e estados antigos sejam interpretados como pertencentes a uma ativação diferente.",
            ],
          },
        ],
      },
      {
        id: "commands-acks",
        title: "Comandos, ACK e presença",
        summary:
          "O RTDB coordena comandos estreitos, confirmação de aplicação e saúde do Player.",
        sections: [
          {
            title: "Protocolos",
            bullets: [
              "slideCommand / slideAck para navegação comandada e confirmação.",
              "playerPresence para boot atual, leases e estado de conexão.",
              "playerRecoveryRequest para retry, reload e clear-cache direcionados ao boot correto.",
              "fullscreenRequest, playerControls e playerLogs para controles operacionais específicos.",
            ],
          },
          {
            title: "Princípio",
            paragraphs: [
              "O RTDB não é usado como uma fila genérica de eventos. Cada protocolo possui identidade, revisão e validação estreitas de acordo com sua responsabilidade.",
            ],
          },
        ],
      },
      {
        id: "interactive-live",
        title: "Controles interativos",
        summary:
          "Gallery, Plot e Scripted usam protocolos Live específicos em vez de compartilhar estado genérico.",
        sections: [
          {
            title: "Exemplos",
            bullets: [
              "galleryControl: índice e expansão desejados por Gallery.",
              "plotAnimationAction: ações de animação direcionadas ao Plot correto.",
              "scriptedAction, scriptedInput, scriptedRuntime e scriptedReport: bridge estrita entre Control, Player e iframe sandboxed.",
            ],
          },
          {
            title: "Escopo",
            paragraphs: [
              "A identidade do comando deve continuar vinculada à ativação, versão, página, elemento e controle relevantes. Estado runtime não é persistido de volta na Presentation canônica.",
            ],
          },
        ],
      },
    ],
  },
  {
    title: "Segurança",
    topics: [
      {
        id: "authentication",
        title: "Autenticação",
        summary:
          "A autoria usa Firebase Auth e exige um usuário não anônimo.",
        sections: [
          {
            title: "Studio",
            paragraphs: [
              "O Studio normaliza usuários anônimos como não autenticados. O login atual usa Google Sign-In via popup, sem transformar uma sessão anônima em permissão de autoria.",
            ],
          },
          {
            title: "Separação público/privado",
            paragraphs: [
              "Drafts, Library e ferramentas de autoria são privados. Player e Watch consomem apenas os dados públicos e o estado Live permitido pelas regras de segurança.",
            ],
          },
        ],
      },
      {
        id: "firebase-rules",
        title: "Firestore e RTDB rules",
        summary:
          "As rules fazem parte do contrato de segurança e não são substituídas por controles ocultos na UI.",
        sections: [
          {
            title: "Firestore",
            bullets: [
              "dados de autoria pertencem ao usuário autenticado",
              "publicações são lidas por identidade pública",
              "versões publicadas não são tratadas como documentos mutáveis de autoria",
            ],
          },
          {
            title: "Realtime Database",
            bullets: [
              "writes de Control exigem autenticação quando aplicável",
              "campos de identidade e revisão são validados",
              "ações de recuperação são direcionadas ao boot e à versão correntes",
              "paths públicos de leitura não concedem autoridade de escrita.",
            ],
          },
        ],
      },
      {
        id: "scripted-security",
        title: "Scripted sandbox",
        summary:
          "JavaScript autoral não executa no contexto do aplicativo Player.",
        sections: [
          {
            title: "Boundary",
            paragraphs: [
              "Scripted é renderizado em iframe sandboxed e comunica-se com o Player por uma bridge explícita. O script não recebe Firebase, tokens, acesso ao DOM pai ou capacidade de executar código arbitrário dentro da aplicação principal.",
            ],
          },
          {
            title: "Direção",
            bullets: [
              "mensagens são validadas por source e envelope",
              "a API exposta é pequena e intencional",
              "estado de runtime permanece fora da Presentation persistida",
              "não usar eval, Function ou introspecção do contexto principal.",
            ],
          },
        ],
      },
    ],
  },
  {
    title: "Referência",
    topics: [
      {
        id: "element-families",
        title: "Famílias de elementos",
        summary:
          "Os elementos canônicos podem ser entendidos por função sem criar novos tipos de documento.",
        sections: [
          {
            title: "Conteúdo",
            bullets: [
              "Text, Code, Terminal e Table apresentam conteúdo textual ou estruturado.",
              "Image e Gallery apresentam mídia visual.",
              "Divider organiza visualmente a composição.",
              "Embed incorpora conteúdo remoto sob regras próprias.",
            ],
          },
          {
            title: "Estrutura e autoria",
            bullets: [
              "Container compõe a árvore e o layout.",
              "Topics representa conteúdo hierárquico especializado.",
              "Blocks representa programação visual estruturada.",
            ],
          },
          {
            title: "Interatividade",
            bullets: [
              "Plot descreve intenção matemática restrita.",
              "Interactive cobre componentes interativos oficiais com contrato explícito.",
              "Scripted oferece conteúdo HTML/CSS/JS isolado por sandbox e bridge controlada.",
            ],
          },
        ],
      },
      {
        id: "source-of-truth",
        title: "Fonte de verdade",
        summary:
          "Quando documentação e implementação divergem, o código atual e seus testes decidem o estado real.",
        sections: [
          {
            title: "Ordem prática",
            bullets: [
              "código atual em main",
              "testes do comportamento atual",
              "contrato canônico e ownership do renderer",
              "AGENTS.md e regras de segurança",
              "README, ROADMAP e documentação de produto",
              "branches históricas e documentos antigos",
            ],
          },
          {
            title: "Documentação viva",
            paragraphs: [
              "Esta área Docs deve acompanhar o sistema efetivamente entregue. Uma mudança arquitetural relevante deve atualizar código, testes e documentação coerentemente, sem usar Docs como uma fonte paralela de contrato.",
            ],
          },
        ],
      },
    ],
  },
];

export const allDocsTopics = docsGroups.flatMap((group) => group.topics);

export const defaultDocsTopicId = "overview";

export function findDocsTopic(id: string): DocsTopic | undefined {
  return allDocsTopics.find((topic) => topic.id === id);
}
