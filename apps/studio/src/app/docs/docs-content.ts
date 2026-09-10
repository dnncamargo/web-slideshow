export interface DocsSection {
  title: string;
  paragraphs?: readonly string[];
  bullets?: readonly string[];
  code?: string;
}

export interface DocsTopic {
  id: string;
  title: string;
  summary: string;
  sections: readonly DocsSection[];
}

export interface DocsGroup {
  title: string;
  topics: readonly DocsTopic[];
}

export const docsGroups: readonly DocsGroup[] = [
  {
    title: "Comece aqui",
    topics: [
      {
        id: "overview",
        title: "Visão geral",
        summary:
          "O PowerShow é um sistema web para criar, publicar, exibir e controlar apresentações interativas.",
        sections: [
          {
            title: "O que é o PowerShow",
            paragraphs: [
              "O PowerShow separa autoria, publicação e reprodução. A apresentação é um documento estruturado, validado e independente das superfícies que o editam ou reproduzem.",
              "A prioridade arquitetural é permitir autoria rica sem transformar o Player em um segundo Editor. O documento deve continuar previsível e o playback deve permanecer leve.",
            ],
          },
          {
            title: "Superfícies principais",
            bullets: [
              "PowerShow Library: gerenciamento de apresentações e organização.",
              "PowerShow Editor: autoria de slides, elementos, estilos e recursos.",
              "PowerShow Control: controle remoto da apresentação e ferramentas operacionais.",
              "PowerShow Player: runtime moderno de apresentação.",
              "PowerShow Watch: acompanhamento público read-only da apresentação ao vivo.",
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
          "O PowerShow é um monorepo pnpm com apps de produto e packages compartilhados.",
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
          "A raiz canônica permanece em schemaVersion 1 e contém identidade, recursos, estilos e slides.",
        sections: [
          {
            title: "Shape raiz",
            code: "Presentation\n├── schemaVersion: 1\n├── id\n├── title\n├── description\n├── aspectRatio\n├── resources?\n├── palette?\n├── textStyles?\n├── linkedStyles?\n└── slides[]",
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
