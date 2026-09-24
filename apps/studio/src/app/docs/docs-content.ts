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
          "Root Definitions são estruturas compartilhadas da Presentation. Elas normalizam a estrutura canônica para que vários Slides reutilizem o mesmo master sem copiar essa árvore em cada Slide.",
        sections: [
          {
            title: "What it is (O que é)",
            paragraphs: [
              "Uma Root Definition é uma estrutura reutilizável de elementos compartilhada e pertencente à Presentation. Seu objetivo é a normalização estrutural: reduzir a repetição da estrutura canônica, do JSON persistido e do JSON exportado, centralizando a estrutura e a estética que devem permanecer iguais entre Slides.",
              "A analogia com definições reutilizáveis de CSS é útil, mas a diferença é essencial: Linked Styles e Text Styles reutilizam propriedades; Root Definitions reutilizam estrutura. Uma Root não é um template que é copiado. Ela continua referenciada como um master compartilhado.",
              "A Presentation possui o master da Root Definition; o Slide guarda a associação; e o conteúdo local opcional continua pertencendo separadamente ao Slide. Editar o master compartilhado altera a estrutura vista por todos os Slides que resolvem essa Root.",
              "No documento canônico, rootDefinitions ficam na Presentation e um Slide referencia uma Root por rootDefinitionId. A Root não é copiada para slide.elements. A materialização produz a árvore efetiva para edição, preview e runtime sem expandir o documento persistido.",
            ],
          },
          {
            title: "How to use it (Como usar)",
            paragraphs: [
              "1. No fluxo New, escolha Slide ou Root Definition, selecione o preset/layout e crie a Root com um nome. 2. Abra a Root no mesmo workspace do Editor e construa seu master compartilhado. 3. Se necessário, marque Containers específicos como local content receivers. 4. Volte a um Slide e associe-o à Root pelo Slide Inspector, ou deixe-o resolver a Presentation default. 5. Adicione conteúdo específico do Slide apenas nos receivers autorizados. 6. Edite o master quando a alteração deve alcançar todos os Slides; edite o conteúdo local quando a alteração deve alcançar apenas aquele Slide.",
              "A resolução efetiva é: associação explícita do Slide → Presentation default → nenhum Root. Ao limpar uma associação explícita, a opção exibida é Use Presentation default quando houver uma Presentation default; isso não significa necessariamente escolher no Root.",
              "A associação é permitida em um Slide rootless vazio. Em um Slide Root-backed sem conteúdo Root local, é possível trocar ou remover a associação. Em um Slide Root-backed com conteúdo local, o seletor fica desabilitado até que esse conteúdo seja removido ou podado. Em um Slide rootless com conteúdo ordinário já criado, o seletor também fica desabilitado.",
              "A proteção evita substituir ou invalidar conteúdo de forma destrutiva: não há migração automática do conteúdo ordinário para Root local, nem cópia automática do master para o Slide. O conteúdo local precisa ser removido antes de uma reassociação que poderia quebrar sua relação com os receivers.",
              "Root Definitions existentes ficam em Custom Resources → This Presentation → Root Definitions. As linhas são expansíveis; o nome pode ser editado inline; Open/Edit abre o master; Reuse lista os Slides que usam a Root; Remove fica indisponível enquanto houver referência de ciclo de vida.",
            ],
          },
          {
            title: "What you can do with it",
            bullets: [
              "Reutilizar uma estrutura/layout compartilhado em vários Slides e editar essa estrutura uma vez para propagá-la aos Slides associados.",
              "Combinar um master estável com conteúdo local diferente em cada Slide, criar várias Root Definitions na mesma Presentation e definir uma Presentation default ou selecionar outra Root explicitamente em um Slide.",
              "Autorizar Containers específicos como local content receivers, mantendo a estrutura compartilhada separada do conteúdo local pertencente ao Slide.",
              "Usar Linked Styles em elementos dentro de uma Root Definition e Text Styles em textos dentro dela. Esses recursos continuam sendo referências Presentation-level; suas propriedades não são copiadas ou materializadas nos elementos da Root.",
              "Aplicar Element Styles a elementos comuns de Slide, a elementos editáveis do master da Root e ao conteúdo local de um Root-backed Slide. O master projetado em um Root-backed Slide é somente leitura e não pode ser alterado por Element Styles a partir desse Slide.",
              "Ver os recursos referenciados corretamente nas Library thumbnails, preservar as relações na persistência, exportação, importação e publicação, e usar Undo/Redo normal nas operações de Root e de conteúdo local suportadas.",
            ],
          },
          {
            title: "Master da Root e Slide Root-backed",
            paragraphs: [
              "Ao editar diretamente uma Root Definition, os elementos master são editáveis; as mudanças pertencem à Root e afetam todos os Slides que a resolvem. Ao visualizar um Root-backed Slide, os elementos master continuam visíveis e podem ser selecionados para contexto, mas são read-only; somente o conteúdo local do Slide permanece editável.",
              "Um Root-backed Slide não armazena uma cópia do master. O master continua pertencendo à Root Definition e o Slide mantém apenas sua associação e seus dados locais.",
            ],
          },
          {
            title: "Conteúdo local e receivers",
            paragraphs: [
              "Uma Root Definition pode autorizar Containers selecionados como local content receivers. Slides que usam essa Root podem inserir nesses receivers elementos específicos daquele Slide. O master compartilhado continua estável; o conteúdo variável continua pertencendo ao Slide, estruturalmente separado, e não modifica a Root Definition.",
              "No modelo canônico, localChildTargetIds autoriza os Containers master que podem receber conteúdo. localRootChildren armazena os elementos pertencentes ao Slide associados a esses receivers. A autorização não transforma conteúdo local em conteúdo do master e não preenche slide.elements com uma cópia da árvore compartilhada.",
            ],
            bullets: [
              "Somente receivers autorizados podem receber conteúdo local; desabilitar ou remover um receiver em uso é protegido para não apagar ou remapear conteúdo silenciosamente.",
              "Uma Root só pode ser removida quando não estiver referenciada pela Presentation default nem por uma associação explícita de Slide.",
            ],
          },
          {
            title: "Composição de recursos reutilizáveis",
            paragraphs: [
              "Root Definitions, Linked Styles e Text Styles são camadas de reutilização diferentes e podem ser compostas. A Root Definition reutiliza estrutura; o Linked Style reutiliza propriedades de elemento, layout e aparência; o Text Style reutiliza tipografia e aparência textual.",
              "Elementos pertencentes a uma Root Definition podem referenciar Linked Styles e Text Styles da Presentation. As referências permanecem referências: alterar um Linked Style pode atualizar elementos master da Root que o usam, e alterar um Text Style pode atualizar textos master que o usam. Estilos referenciados por uma Root contam como em uso, podem aparecer na navegação de Reuse/Usage e seguem as proteções normais do ciclo de vida de recursos.",
              "Ao editar diretamente o master da Root, a autoria de associação ou remoção de Linked Styles e Text Styles acontece no elemento dono da Root. Um Root-backed Slide não cria um override local da referência do master.",
            ],
          },
          {
            title: "This Presentation e estilos",
            paragraphs: [
              "No modelo This Presentation, Root Definitions aparecem junto de Linked Styles, Text Styles, Presentation Palette e Fonts. Para essas famílias reutilizáveis, linhas recolhidas mostram nome, resumo de uso e disclosure; a informação expandida usa o conceito compartilhado Reuse / Reutilização.",
            ],
            bullets: [
              "Para Root Definitions, o nome é editável inline quando expandido, Open/Edit entra no master, Reuse lista Slides que resolvem a Root por associação explícita ou pela Presentation default, e Remove fica protegido enquanto a Root estiver em uso.",
              "Element Styles podem ser aplicados a elementos ordinários de Slide, a elementos editáveis do master e ao conteúdo local de um Root-backed Slide; o master projetado visto por um Slide permanece read-only.",
            ],
          },
          {
            title: "Thumbnails, persistência e publicação",
            paragraphs: [
              "As Library thumbnails podem renderizar o primeiro Slide efetivo incluindo o master da Root, conteúdo local, Linked Styles, Text Styles, variáveis da Presentation Palette e fontes da Presentation.",
              "Save/persistence, export, import e publication preservam o relacionamento normalizado e referencial: a Presentation continua contendo rootDefinitions, associações e conteúdo local, em vez de expandir uma cópia privada do master em cada Slide. A importação remapeia as referências estruturais de forma determinística e schemaVersion permanece literalmente 1.",
              "As operações de Root, edição do master e autoria de conteúdo local suportada participam do Undo/Redo normal do Editor. O histórico é session-only e não é persistido no documento.",
            ],
          },
          {
            title: "Limites atuais da V1",
            bullets: [
              "Cada Slide tem no máximo uma Root Definition efetiva.",
              "Não há Root Definitions aninhadas.",
              "Não há uma camada de override de propriedades do master por Slide na V1.",
              "O master projetado é read-only quando visto através de um Root-backed Slide.",
              "Conteúdo local só pode ser inserido em receivers autorizados.",
              "Reassociação destrutiva é bloqueada; não existe migração automática de conteúdo.",
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
