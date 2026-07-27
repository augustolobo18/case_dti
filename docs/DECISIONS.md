# 🧭 Registro de Decisões (ADR)

Log das decisões de projeto e suas justificativas, para consulta e defesa posterior.
Cada decisão registra o **contexto**, a **escolha** e o **porquê** (incluindo alternativas descartadas).

> Formato leve inspirado em ADR (Architecture Decision Records).
> Status: ✅ vigente · 🔄 revisável · ⛔ substituída

---

## D1 — Stack: Node.js + TypeScript, API REST + Dashboard ✅

- **Contexto:** case permite Java, JS/Node, React, Angular ou C#/.NET.
- **Escolha:** Node.js + TypeScript (ESM), expondo API REST + um dashboard/relatório simples.
- **Porquê:** desenvolvimento rápido, tipagem estática para modelar o domínio, ótimo
  ecossistema de testes (Vitest) e facilidade de expor REST com Express. O case sugere
  explicitamente endpoints REST.
- **Alternativas descartadas:** Java/Spring e C#/.NET (mais cerimônia p/ o prazo);
  front puro em React (menos foco na lógica de domínio, que é o mais avaliado).

## D2 — Testes com Vitest; Node >= 20.12 ✅

- **Contexto:** precisamos de testes unitários das regras (obrigatório no case).
- **Escolha:** Vitest 4 (cobertura v8); runtime Node 24 LTS (mínimo 20.12).
- **Porquê:** Vitest é leve, rápido e integra nativamente com TS/ESM. Vitest 4 exige
  Node >= 20.12 (usa `styleText` do `node:util`), então padronizamos o Node 24 LTS.
- **Alternativas descartadas:** Jest (mais configuração para ESM/TS).

## D3 — Validação com Zod nas bordas da API ✅

- **Contexto:** o case pede rejeitar entradas inválidas com mensagens claras.
- **Escolha:** validar payloads com Zod na camada de API, mantendo o domínio agnóstico ao HTTP.
- **Porquê:** validação declarativa e mensagens de erro consistentes, sem acoplar a regra
  de validação ao framework web; o domínio continua testável isoladamente.

## D4 — Malha 2D limitada (0..N) ✅

- **Contexto:** a cidade é uma malha de coordenadas; pedidos têm posição `(x, y)`.
- **Escolha:** malha com tamanho fixo configurável; coordenadas fora de `0..N` são rejeitadas.
- **Porquê:** mais realista (a cidade tem limites) e gera validação de fronteira testável.
- **Alternativas descartadas:** coordenadas ilimitadas / negativas (menos validação, menos realismo).

## D5 — Rejeitar peso inválido já no cadastro ✅

- **Contexto:** requisito do case — rejeitar pacotes que ultrapassem a capacidade.
- **Escolha:** no cadastro do pedido, recusar peso `<= 0` ou maior que a capacidade do drone.
- **Porquê:** falha cedo, com mensagem clara, evitando pedidos impossíveis na fila de alocação.
- **Alternativas descartadas:** aceitar e só falhar na alocação (feedback mais tardio ao operador).

## D6 — Persistência de pedidos em arquivo JSON ✅

- **Contexto:** os pedidos precisam sobreviver a reinícios para acompanhar entregas.
- **Escolha:** repositório de pedidos persistido em arquivo JSON local.
- **Porquê:** simples, sem dependência de banco, e sobrevive a reinício — suficiente p/ um simulador.
- **Alternativas descartadas:** só memória (perde tudo ao reiniciar); banco de dados (excesso p/ o escopo).

## D7 — Status do pedido separado da máquina de estados do drone ✅

- **Contexto:** o case descreve `Idle → Carregando → Em voo → Entregando → Retornando → Idle`.
- **Escolha:** essa máquina de estados pertence ao **drone**; o **pedido** tem status próprio
  `pendente → alocado → em_voo → entregue`, derivado do estado do drone que o carrega.
- **Porquê:** um pacote nunca fica "Idle" ou "Retornando"; separar os ciclos de vida evita
  modelagem confusa e mantém cada estado com significado.

## D8 — Frota homogênea, fixa via config na inicialização ✅

- **Contexto:** o sistema precisa de drones para alocar as entregas.
- **Escolha:** frota homogênea (mesma capacidade X e alcance Y); quantidade e limites vêm
  do `.env` e a frota é instanciada ao subir o sistema (sem endpoint de cadastro).
- **Porquê:** suficiente para o desafio de minimizar viagens, com menos superfície de API/validação.
- **Alternativas descartadas:** frota heterogênea (mais rica, mais complexa); cadastro via API
  (flexível, porém desnecessário p/ um simulador); drone único (reduz o desafio de distribuir carga).

## D9 — Alocação por heurística greedy, sem melhoria local ✅

- **Contexto:** objetivo central do case — alocar pacotes com o menor nº de viagens.
- **Escolha:** heurística **greedy** — ordenar pedidos por prioridade/peso/distância e encaixar
  cada pacote na viagem enquanto couber (capacidade + alcance), sem passo de melhoria posterior.
- **Nota de nomenclatura:** greedy é um *tipo* de heurística, não uma estratégia à parte.
- **Porquê:** bom custo/benefício — rápida, previsível e fácil de testar, incluindo cargas altas;
  o bin-packing exato é NP-difícil e escala mal com muitos pedidos.
- **Alternativas descartadas:** otimização exata (custosa); greedy + melhoria local (fica como
  evolução possível se sobrar tempo).

## D10 — Distância da viagem: base → entregas → base ✅

- **Contexto:** cada viagem deve caber no alcance Y quadras (por carga).
- **Escolha:** medir o percurso completo da viagem (base → visita aos clientes → volta à base)
  contra o alcance Y.
- **Porquê:** modelo realista de rota fechada; força considerar a ordem das paradas.
- **Alternativas descartadas:** aproximar por 2× o cliente mais distante (impreciso);
  uma entrega por viagem (simples, mas gasta viagens demais).

## D11 — Ordenação da alocação: prioridade > distância > peso ✅

- **Contexto:** o case pede priorizar entregas por prioridade, peso e distância.
- **Escolha:** ordenar os pedidos por prioridade (alta > média > baixa); empate por
  distância (mais perto primeiro); empate remanescente por peso.
- **Porquê:** prioridade é soberana (atende o requisito de negócio); distância antes de peso
  favorece entregas rápidas e reduz o percurso por viagem. Critério determinístico e fácil de explicar.
- **Alternativas descartadas:** prioridade > peso > distância; score ponderado configurável
  (mais flexível, porém menos óbvio de justificar).

## D12 — Roteamento dentro da viagem: vizinho mais próximo ✅

- **Contexto:** definida a composição de uma viagem (D9/D11), falta a ordem de visita aos clientes.
- **Escolha:** heurística do vizinho mais próximo (nearest-neighbor) — partindo da base, ir sempre
  ao cliente não visitado mais próximo e retornar à base ao fim.
- **Porquê:** distância é ortogonal à prioridade — todos os pacotes da viagem serão entregues no
  mesmo voo, então otimizar o trajeto (não a prioridade) é o que importa no roteamento. Barato e simples.
- **Alternativas descartadas:** ordem por prioridade (entrega o "alta" mais cedo, mas alonga o trajeto —
  relevante só se o tempo por entrega pesar, o que fica para o E4); ordem de inserção (não otimiza nada).

## D13 — Simulação orientada a eventos, em tempo simulado ✅

- **Contexto:** o case sugere simulação orientada a eventos com drones mudando de estado;
  precisa gerenciar tempo de voo.
- **Escolha:** simulação event-driven em **tempo simulado** (timestamps/relógio virtual), sem
  `sleep`/threads reais; disparada automaticamente após a alocação (E3).
- **Porquê:** determinística, rápida e fácil de testar — condição essencial para cobertura das
  regras e simulações de carga. Evita a fragilidade de delays reais.
- **Alternativas descartadas:** tempo real com sleep/threads (não determinístico, ruim p/ testes);
  tick manual via endpoint (controlável, mas exige acionar cada passo).

## D14 — Tempo = distância ÷ velocidade + tempos fixos ✅

- **Contexto:** o case pede calcular o tempo total de entrega; o tempo é simulado.
- **Escolha:** tempo de voo = distância ÷ velocidade (config); somados tempos fixos de carregar
  e de entregar por parada. Métricas: por entrega, total (makespan) e média.
- **Porquê:** fórmula simples, determinística e fácil de justificar; separa deslocamento de
  overheads operacionais sem exigir um modelo físico complexo.
- **Alternativas descartadas:** só distância ÷ velocidade (ignora carga/entrega, menos realista).

## D15 — Bateria = alcance (consome por distância, recarrega na base) ✅

- **Contexto:** o case pede simular bateria (por tempo ou distância) e recarga automática na base;
  o alcance Y quadras por carga já limita a viagem (D10).
- **Escolha:** tratar bateria e alcance como o **mesmo recurso** — bateria cheia = Y quadras; consumo
  proporcional à distância; ao voltar à base (Idle), o drone recarrega antes da próxima viagem.
- **Porquê:** evita dois conceitos redundantes para a mesma restrição física; mantém coerência
  direta com a alocação (D10) e simplifica a modelagem.
- **Alternativas descartadas:** bateria como recurso separado que persiste entre viagens (mais rico,
  mais complexo); consumo por tempo (casa menos com o alcance).

## D16 — Distância Manhattan na malha ✅

- **Contexto:** a cidade é uma malha de coordenadas; o case usa a metáfora de "quadras".
- **Escolha:** distância Manhattan `|dx| + |dy|` como métrica única (alcance, roteamento, tempo).
- **Unidade:** **quadra** — uma unidade da malha equivale a uma quadra. Não se usa km em
  nenhum ponto do sistema (config, domínio, API e dashboard falam sempre em quadras).
- **Porquê:** casa com a ideia de deslocamento por quadras em grade e com o feedback "a N quadras";
  uma métrica única mantém coerência entre alocação, rota e tempo.
- **Alternativas descartadas:** euclidiana (mais realista para voo direto, mas destoa da metáfora de quadras).

## D17 — Zonas de exclusão como células bloqueadas; rota desvia (pathfinding) ✅

- **Contexto:** o case pede inserir obstáculos / zonas de exclusão aérea entre pontos.
- **Escolha:** zonas são células bloqueadas da malha (definidas via config); o trajeto as contorna
  via pathfinding na grade (BFS/A* com movimento Manhattan), e a distância do desvio alimenta
  as checagens de alcance/bateria e tempo.
- **Porquê:** modelo mais completo e realista que apenas recusar entregas; aproveita a malha em
  grade e a métrica Manhattan (D16). Custa mais código, mas é um diferencial de peso.
- **Alternativas descartadas:** invalidar entregas dentro/atravessadas por zonas (sem pathfinding,
  bem mais simples, porém menos realista); definição de zonas via API (mais flexível, mais superfície).

## D18 — Dashboard como página web simples ✅

- **Contexto:** o case pede uma visualização simples (dashboard) com métricas e mapa.
- **Escolha:** servir uma página web simples pelo backend, com as métricas e o mapa das entregas.
- **Porquê:** mais visual e demonstrável no case do que só JSON/ASCII; reforça a decisão D1 de
  entregar API REST + dashboard.
- **Alternativas descartadas:** endpoint JSON + mapa ASCII (sem front, mais simples, menos impacto visual).

## D19 — "Drone mais eficiente" = entregas ÷ distância ✅

- **Contexto:** o case pede destacar o drone mais eficiente no relatório.
- **Escolha:** eficiência = entregas concluídas ÷ distância total percorrida pelo drone.
- **Porquê:** premia quem entrega mais gastando menos rota — mede eficiência real, não só volume.
- **Alternativas descartadas:** só total de entregas (ignora o custo de deslocamento).

## D20 — Erros: JSON padronizado + middleware central ✅

- **Contexto:** o case pede mensagens claras para entradas inválidas e boas validações.
- **Escolha:** respostas de erro em JSON padronizado `{ erro: { codigo, mensagem, detalhes? } }`,
  com status HTTP adequado (400/404/422), produzidas por um middleware de erro central no Express.
- **Porquê:** consistência e previsibilidade para o consumidor da API; o middleware central evita
  repetição (DRY) e mantém as rotas como cascas finas (coerente com D3 e a separação domínio/API).
- **Alternativas descartadas:** `{ erro: 'mensagem' }` simples (menos estruturado); tratar erro em
  cada rota (repetitivo).

## D21 — Testes: domínio a fundo, meta ~80% de cobertura ✅

- **Contexto:** o case exige testes unitários das regras principais (entregável obrigatório).
- **Escolha:** focar a cobertura no domínio (distância, alocação, capacidade/alcance, prioridade,
  estados, bateria), com meta de ~80% de cobertura, incluindo casos de borda.
- **Porquê:** concentra o esforço onde está a lógica de negócio e o valor avaliado; a meta dá um
  alvo objetivo sem perseguir 100% (que traria testes de baixo retorno na camada de API/infra).
- **Alternativas descartadas:** testar regras sem meta numérica (menos garantia objetiva).

## D22 — Valores de enum em minúsculo, sem acento, `snake_case` ✅

- **Contexto:** três conjuntos de valores atravessam domínio, API e dashboard: prioridade do
  pedido, status do pedido e estado do drone. O enunciado do case os escreve em prosa
  (`Idle → Carregando → Em voo`, prioridade `média`), o que não serve como valor de código.
- **Escolha:** valores canônicos minúsculos, sem acento e sem espaço:
  - `Prioridade`: `baixa` · `media` · `alta`
  - `StatusPedido`: `pendente` · `alocado` · `em_voo` · `entregue`
  - `EstadoDrone`: `idle` · `carregando` · `em_voo` · `entregando` · `retornando`
- **Porquê:** acento e espaço causam atrito real fora do código — percent-encoding em filtros por
  query string (`?prioridade=m%C3%A9dia`) e valores com espaço em JSON são fonte de bug bobo. Uma
  convenção única para os três enums evita ter que lembrar qual deles é a exceção.
- **Nota:** a prosa da documentação continua escrevendo "média" e "Em voo" naturalmente; a forma
  canônica vale para valores em código, payloads e query strings — sinalizados por `backticks`.
- **Alternativas descartadas:** manter os acentos do enunciado (mais bonito na resposta JSON,
  porém frágil em URL); `camelCase` (destoa de valores de dados, que não são identificadores).

## D23 — Entrada do domínio é não confiável (parse-don't-validate) ✅

- **Contexto:** `criarPedido` valida a prioridade recebida, mas `DadosNovoPedido.prioridade`
  estava tipado como `Prioridade` — o tipo afirmava que o valor já era válido. O TypeScript então
  estreitava o ramo de erro para `never`, tratando como inalcançável um caminho que em runtime é
  alcançável (o dado vem de JSON). O teste da validação só compilava com `@ts-expect-error`.
- **Escolha:** os tipos de entrada do domínio usam primitivos frouxos — `prioridade: string`,
  como `x`, `y` e `pesoKg` já eram `number`. A factory valida e devolve o tipo estreito:
  `Pedido.prioridade` continua sendo `Prioridade`.
- **Porquê:** o tipo passa a dizer a verdade sobre o que a função aceita. Entra frouxo, sai
  tipado — o guard vira significativo e o teste deixa de precisar brigar com o compilador.
  Quando um teste precisa de `@ts-expect-error` para exercitar uma validação, o tipo está mentindo.
- **Origem:** achado pelo ESLint type-aware (`restrict-template-expressions`) na primeira execução
  do lint, não por revisão manual.
- **Alternativas descartadas:** `String(valor)` no template (silencia o sintoma e mantém a
  incoerência); `eslint-disable` na linha (descarta um achado correto no código mais avaliado).

## D24 — Frota derivada da config, com ids determinísticos ✅

- **Contexto:** o Bloco 3 (E2) precisa instanciar a frota no boot e expor seu status via API.
  `criarDrone`/`criarFrota` (Bloco 1) usam `crypto.randomUUID` como gerador padrão de `id`, o
  que produziria ids diferentes a cada reinício do processo. O Bloco 4 vai persistir `droneId`
  dentro de pedidos/viagens gravados em disco — um id que muda a cada boot deixaria essas
  referências órfãs na primeira reinicialização.
- **Escolha:** a frota é sempre **derivada da config** (`.env`) a cada boot, sem persistência
  própria, e usa um gerador de id sequencial e determinístico (`criarGeradorIdSequencial`):
  `drone-1`, `drone-2`, ..., `drone-N`, na mesma ordem a cada subida do processo.
- **Porquê:** ids estáveis entre reinícios sem precisar persistir a frota — persistir criaria
  divergência entre o arquivo salvo e um `.env` alterado pelo operador (o mesmo raciocínio de
  D8). É a opção mais simples que ainda dá ao Bloco 4 uma referência de drone confiável.
- **Alternativas descartadas:** persistir a frota em arquivo JSON (resolveria a estabilidade,
  mas duplica o mecanismo de D6 para um dado que já é 100% derivado da config, e reabre a
  questão de reconciliar arquivo salvo vs. `.env` editado); manter `randomUUID` (mais "correto"
  como identificador único, porém instável entre reinícios — inviabiliza referências
  persistidas de forma simples).
- **Limitação conhecida:** reduzir `DRONE_QUANTIDADE` entre reinícios deixa `droneId`s
  persistidos pelo Bloco 4 apontando para drones que deixaram de existir. Não há dado
  persistido referenciando drone neste bloco; a reconciliação fica para o Bloco 4.
  **Atualização (Bloco 4):** resolvida por D27 — viagem órfã é descartada no boot e seus
  pedidos voltam a `pendente`.

## D25 — Disparo explícito da alocação via `POST /entregas/alocar` ✅

- **Contexto:** o Bloco 4 (E3) precisa de um gatilho para rodar o algoritmo de alocação
  sobre os pedidos `pendente` acumulados.
- **Escolha:** um endpoint de comando dedicado, `POST /entregas/alocar`, separado da leitura
  em `GET /entregas/rota`.
- **Porquê:** separa cadastro de planejamento — padrão comum em sistemas de roteirização
  (comando "solve" explícito). Um `GET` que muda status de pedidos e grava viagens violaria
  a semântica HTTP (idempotência/segurança de `GET`).
- **Alternativas descartadas:** alocação automática a cada `POST /pedidos` (recalcularia a
  cada cadastro, caro e instável em lote); `GET /entregas/rota` disparando a alocação
  implicitamente (efeito colateral escondido atrás de uma leitura).

## D26 — Persistência das viagens em arquivo JSON, mesmo padrão de D6 ✅

- **Contexto:** `pedido.status` já é persistido (D6); a partir do Bloco 4, um pedido pode
  ficar `alocado`, vinculado a uma viagem que só existisse em memória.
- **Escolha:** persistir as viagens em arquivo JSON (`VIAGENS_ARQUIVO`), com o mesmo desenho
  de porta `carregar`/`salvar`, escrita atômica e schema Zod de `persistencia-pedidos.ts`.
- **Porquê:** viagem só em memória deixaria pedidos `alocado` órfãos no arquivo de pedidos
  após um reinício — sem viagem correspondente para explicar o status. Persistir os dois
  lados mantém o estado coerente entre reinícios.
- **Risco assumido:** `POST /entregas/alocar` grava em dois lugares (pedidos e viagens); uma
  falha entre as duas gravações pode deixar o disco inconsistente. Mitigado gravando os
  pedidos **antes** das viagens, de modo que uma falha no meio produza o estado recuperável
  "pedido `alocado` sem viagem" — que a reconciliação do boot (D27) já sabe desfazer.
- **Alternativas descartadas:** viagens só em memória (mais simples, mas perde a alocação a
  cada reinício e deixa pedidos `alocado` inconsistentes); banco de dados (excesso para o escopo).

## D27 — Reconciliação de viagem órfã no boot ✅

- **Contexto:** a frota é derivada da config a cada boot, sem persistência própria (D24);
  reduzir `DRONE_QUANTIDADE` entre reinícios pode deixar uma viagem persistida apontando
  para um `droneId` que deixou de existir — a limitação conhecida registrada em D24.
- **Escolha:** ao criar o repositório de viagens no boot, reconciliar a lista carregada
  contra os `droneId`s da frota atual: viagem órfã é descartada e seus `pedidoIds` voltam a
  `pendente` (`reverterParaPendente`, domínio puro). Um log explícito no boot informa a
  quantidade descartada.
- **Porquê:** encolher a frota é uma operação prevista (D8), não uma corrupção — falhar o
  boot impediria o operador de reduzir `DRONE_QUANTIDADE`. Reverter a `pendente` mantém o
  pedido num estado válido, pronto para ser realocado na próxima chamada de
  `POST /entregas/alocar`.
- **Alternativas descartadas:** falhar o boot com frota reduzida (bloqueia uma operação
  legítima); manter a viagem órfã como está (deixaria `GET /entregas/rota` reportando um
  drone inexistente, e o pedido preso em `alocado` para sempre).

## D28 — Designação de viagem para drone por round-robin ✅

- **Contexto:** o greedy (D9) fecha viagens sem saber qual drone vai executá-las; alguma
  regra precisa distribuir as viagens fechadas entre os drones da frota.
- **Escolha:** round-robin simples — `viagens[i] → drones[i % N]`.
- **Porquê:** o objetivo do E3-1 é minimizar o número de viagens para entregar **tudo**, não
  encaixar tudo numa única rodada por drone; a execução sequencial de viagens por drone
  (quantas cabem "ao mesmo tempo") é problema da simulação (E4), fora do escopo deste bloco.
  Round-robin distribui a carga de forma equilibrada e determinística sem entrar nesse mérito.
- **Alternativas descartadas:** atribuir todas as viagens ao mesmo drone (ignora a frota);
  balancear por carga/distância acumulada por drone (otimização prematura antes de existir
  simulação de execução para avaliar o ganho).

## D29 — Relatório `naoAlocados` + desempate final por maior peso (FFD) ✅

- **Contexto:** nem todo pedido cabe em viagem alguma (destino inalcançável sozinho, ou peso
  acima da capacidade atual se a config mudou após o cadastro); e o empacotamento greedy
  (D9) precisa de um terceiro critério de desempate que D11 não fixa.
- **Escolha:** pedido inviável sai da fila e entra em `naoAlocados` na resposta de
  `POST /entregas/alocar`, com `pedidoId`, `motivo` (`INALCANCAVEL` ou
  `PESO_ACIMA_CAPACIDADE`) e `mensagem`; o desempate remanescente de D11 ordena por maior
  peso primeiro.
- **Porquê:** abortar toda a alocação por causa de um destino ruim travaria a operação —
  alocação parcial é o comportamento correto, e o relatório vira dado do dashboard (E6).
  Maior peso primeiro é a heurística clássica de bin-packing (First-Fit-Decreasing): pacotes
  grandes entram primeiro, deixando menos "buraco" e reduzindo o número de viagens.
- **Alternativas descartadas:** falhar a chamada inteira se houver um pedido inviável (perde
  a alocação parcial); menor peso primeiro no desempate (contraria a heurística FFD, tende a
  gerar mais viagens).

## D30 — Relógio virtual com instante corrente, avançado por comando ✅

- **Contexto:** o Bloco 5 (E4) precisa observar o avanço do tempo simulado sem depender de
  `setTimeout`/relógio real (D13), e a API precisa expor esse avanço de alguma forma.
- **Escolha:** um relógio virtual — um número, `instanteAtual` — mantido pelo serviço de
  simulação e avançado explicitamente por `POST /simulacao/avancar`.
- **Porquê:** é a forma canônica de simulação de eventos discretos (a linha do tempo já existe
  inteira, pré-computada; avançar o relógio só aplica os eventos até o instante pedido) e é o
  que permite `GET /drones` refletir de fato a máquina de estados em qualquer ponto da operação.
- **Alternativas descartadas:** aplicar a linha do tempo inteira de uma vez (perderia o valor
  didático/de acompanhamento do avanço parcial); relógio real com `sleep` (não determinístico,
  viola D13).

## D31 — Linha do tempo não é persistida; é recomputada no boot ✅

- **Contexto:** a simulação (E4) produz uma linha do tempo de eventos a partir das viagens; é
  preciso decidir se esse artefato é salvo em disco como pedidos (D6) e viagens (D26).
- **Escolha:** não persistir a linha do tempo — ela é sempre recomputada a partir das viagens,
  pedidos e frota atuais, tanto no boot quanto após cada `POST /entregas/alocar` (D33).
- **Porquê:** a simulação é pura e determinística (`domain/simulacao.ts`, D13): dado o mesmo
  estado de viagens/pedidos/frota, ela sempre produz a mesma linha do tempo — persisti-la
  criaria um terceiro arquivo a reconciliar contra pedidos e viagens, repetindo o mesmo problema
  que D24 evitou para a frota.
- **Alternativas descartadas:** persistir a linha do tempo em `data/simulacao.json` (mais um
  artefato para manter consistente com o resto do estado, sem ganho real, já que é derivável).

## D32 — Avanço do relógio aplica os eventos, mudando o estado real ✅

- **Contexto:** ao avançar o relógio, é preciso decidir se o efeito é só uma projeção somente
  leitura (mostrar "como estaria" o sistema naquele instante) ou se muda o estado persistido.
- **Escolha:** `POST /simulacao/avancar` aplica de fato os eventos até o instante pedido:
  `pedido.status` e `viagem.status` são atualizados e persistidos (write-through, como já é
  hoje), e o drone é atualizado no repositório de frota.
- **Porquê:** uma projeção somente leitura deixaria `pedido.status` como uma ficção não
  persistida — colidiria com o E1-2 (`GET /pedidos` já reporta `em_voo`/`entregue` hoje, mesmo
  sem a simulação) e com o objetivo de o drone "de fato" mudar de estado (E4-1).
- **Alternativas descartadas:** projeção somente leitura, com um endpoint separado para "aplicar
  de verdade" (duplica a lógica de aplicação e a torna menos óbvia).

## D33 — Alocar com simulação em andamento recomputa a linha do tempo e zera o relógio ✅

- **Contexto:** `POST /entregas/alocar` pode ser chamado de novo enquanto a simulação anterior
  ainda não terminou (ou já terminou); é preciso decidir o que acontece com a linha do tempo e o
  relógio corrente.
- **Escolha:** logo após alocar, o serviço recomputa a linha do tempo a partir das viagens ainda
  **não concluídas** (D35) e zera o instante corrente para 0.
- **Porquê:** coerente com D25 (a alocação já recalcula do zero as viagens `planejada`); zerar o
  relógio mantém o instante inicial independente do histórico acumulado, e recomputar a partir
  das não concluídas evita reexecutar uma viagem que já terminou.
- **Alternativas descartadas:** manter o instante corrente e só anexar as novas viagens à linha
  do tempo existente (mistura relógios de gerações diferentes de alocação, mais difícil de
  raciocinar e de testar).

## D34 — Recarga com duração proporcional à bateria consumida, entrando no makespan ✅

- **Contexto:** o case pede recarga automática ao voltar à base (E4-3); falta decidir se ela é
  instantânea ou consome tempo simulado.
- **Escolha:** a recarga dura `distância consumida na viagem × recargaMinPorQuadra` minutos, e
  esse tempo soma ao relógio do drone antes de ele voltar a `idle` — entra no makespan da
  operação.
- **Porquê:** recarga instantânea não afetaria métrica alguma e esvaziaria o E4-3 como
  diferencial (bateria viraria só um contador decorativo); uma recarga proporcional ao consumo
  é a forma mais simples de dar peso real à bateria no tempo total da operação.
- **Alternativas descartadas:** recarga instantânea (mais simples, mas sem efeito observável);
  recarga de duração fixa, independente do consumo (menos realista — um drone que voou pouco
  recarregaria pelo mesmo tempo que um que voou o alcance inteiro).

## D35 — Ciclo de vida da viagem: `planejada → em_execucao → concluida` ✅

- **Contexto:** dívida do Bloco 4 — viagens acumulam indefinidamente no repositório e nenhuma
  rota as descarta; a simulação (E4) também precisa saber quais viagens já terminaram, para não
  as reexecutar numa nova alocação.
- **Escolha:** a viagem ganha um campo `status` (`planejada → em_execucao → concluida`):
  `decolagem` marca `em_execucao`, `recarga_concluida` marca `concluida`; `DELETE
  /entregas/concluidas` remove do repositório as viagens já `concluida`.
- **Porquê:** sem esse ciclo de vida, a simulação reexecutaria viagens já entregues a cada
  recomputação (tentando despachar/entregar pedidos já `entregue`, lançando
  `ENTREGA_NAO_PERMITIDA`), e o repositório de viagens cresceria sem limite. `data/viagens.json`
  já existente (sem o campo) continua carregando pelo default `'planejada'` no schema.
- **Alternativas descartadas:** apagar a viagem do repositório assim que concluída, automaticamente
  (perde o histórico de operação, útil para métricas e para o dashboard, E6); só dois estados
  (`planejada`/`concluida`, sem `em_execucao`) — perderia a distinção entre "ainda não decolou" e
  "em voo", relevante para `GET /entregas/rota?status=`.

## D36 — Pathfinding: BFS memoizado por origem, não A* por par ✅

- **Contexto:** o Bloco 6 (E5-2) precisa de uma distância que contorne zonas de exclusão,
  consultada repetidas vezes durante a alocação (roteamento nearest-neighbor reroteia a viagem
  inteira a cada inserção, D9) — inclusive no teste de carga de ~500 pedidos.
- **Escolha:** `MapaCidade.distancia(a, b)` roda uma única BFS **a partir de `a`**, cobrindo toda a
  malha alcançável, e memoiza o resultado por origem; chamadas seguintes com a mesma origem são
  O(1). Sem zonas de exclusão, a função nem roda BFS — devolve a fórmula Manhattan direto.
- **Porquê:** o número de origens distintas consultadas é limitado (base + destinos dos pedidos),
  então BFS por origem é O(P × células) no total — nunca por par de pontos, que degradaria a
  alocação de milissegundos para minutos com centenas de pedidos. A* por par seria mais rápido
  numa única consulta, mas não se beneficia de memoização entre chamadas repetidas com a mesma
  origem, que é o padrão real de uso do roteamento.
- **Alternativas descartadas:** A* calculado a cada par consultado (mais "correto" para uma única
  consulta, mas reprocessa o mesmo caminho a cada reroteamento); pré-computar todas as distâncias
  par-a-par no boot (O(células²), inviável para malhas grandes e desnecessário quando a maioria dos
  pares nunca é consultada).

## D37 — Zonas de exclusão como retângulos na config, derivadas e não persistidas ✅

- **Contexto:** o Bloco 6 (E5-2) precisa de uma forma de declarar as zonas de exclusão; o mesmo
  raciocínio de D24 (frota) e D31 (linha do tempo) se aplica a qualquer dado 100% derivável de uma
  fonte de configuração mais simples.
- **Escolha:** `ZONAS_EXCLUSAO` no `.env`, retângulos inclusivos `"x1,y1:x2,y2"` separados por `;`
  (`parsearZonasExclusao`), validados contra a malha no boot (`criarMapaCidade`); não há endpoint de
  API para ler ou editar zonas nem persistência própria — mudar exige reiniciar o servidor, como a
  frota (D8).
- **Porquê:** consistente com o padrão já estabelecido para configuração estrutural do simulador;
  evita reabrir a discussão de reconciliar um arquivo persistido contra uma config editada, que D24
  já descartou para a frota. A exposição de zonas para o dashboard (mapa visual) fica para o E6, que
  já lê `config.zonasExclusao` diretamente — sem precisar de rota própria.
- **Alternativas descartadas:** endpoint de cadastro de zonas via API (mais flexível, mas amplia a
  superfície de validação sem necessidade no escopo do case); persistir zonas em arquivo JSON
  próprio (duplica o mecanismo de D6/D26 para um dado que já é 100% derivado da config).

## D38 — Destino inviável por zona é reportado na alocação, não rejeitado no cadastro ✅

- **Contexto:** zonas de exclusão podem tornar um destino já cadastrado bloqueado ou sem rota até a
  base — mas o pedido pode ter sido cadastrado antes de a zona existir, ou a zona pode mudar entre
  reinícios (D37). É preciso decidir em que camada esse destino inviável é barrado.
- **Escolha:** `POST /pedidos` continua validando só a malha (D4) e a capacidade (D5); a checagem
  contra zonas de exclusão acontece em `separarInviaveis`, na alocação — destino dentro de uma zona
  sai em `naoAlocados` com `DESTINO_BLOQUEADO`, e destino sem caminho até a base com `SEM_ROTA`.
  Nenhum dos dois aborta a rodada (D29).
- **Porquê:** o cadastro de pedido não tem acesso barato ao `MapaCidade` sem acoplar a rota de
  pedidos à composição do mapa, e zonas podem mudar entre o cadastro e a alocação (reinício do
  servidor com `ZONAS_EXCLUSAO` diferente). Mantém a mesma semântica que já existe para
  `INALCANCAVEL`/`PESO_ACIMA_CAPACIDADE`: pedido inviável não é perdido, é reportado.
- **Alternativas descartadas:** validar contra zonas já no `POST /pedidos` (rejeitaria cedo, mas
  duplicaria a checagem de alcance/rota em duas camadas e não cobriria zona alterada após o
  cadastro); silenciar o pedido sem reportar (contraria D29 e o padrão de "falhar visível" do
  domínio).

## D39 — Caminho canônico: backtracking sobre o campo de distâncias, desempate por menor `x`, depois menor `y` ✅

- **Contexto:** o Bloco 6 deixou o caminho percorrido não observável — a `Viagem` guarda paradas e
  distância total, nunca as células do desvio em volta de uma zona (E6-4). Entre vários caminhos de
  mesmo comprimento mínimo, é preciso um critério explícito e determinístico para eleger um só.
- **Escolha:** `MapaCidade.caminho(a, b)` faz backtracking a partir de `b`: a cada passo, entre os
  vizinhos com distância `d − 1` até `a`, escolhe o de menor `x`, depois menor `y` (`compararPorXY`,
  o mesmo comparador de D12), até chegar em `a`; inverte a lista ao final.
- **Porquê:** zero memória extra sobre o campo de distâncias que o BFS já mantém — não precisa
  guardar predecessores durante a busca, só reconsultar o mesmo campo no sentido inverso. Reusa
  literalmente o desempate já canônico do roteamento (D12) em vez de inventar um segundo critério
  de desempate para o mesmo domínio, e o resultado é sempre "o que a regra explícita produz", nunca
  "o que a ordem de inserção na fila do BFS calhou de gerar" — que dependeria da ordem de
  `DELTAS_VIZINHOS` e não seria auto-documentado.
- **Alternativas descartadas:** guardar o predecessor de cada célula durante o próprio BFS (evita o
  backtracking, mas duplica estado por origem memoizada, agravando a dívida já registrada do memo
  sem limite, E8-2); eleger o caminho por ordem de descoberta do BFS (implícito na fila, muda se a
  ordem de `DELTAS_VIZINHOS` mudar — não é uma regra, é um acidente de implementação).

## D40 — Caminho exposto como opt-in em `GET /entregas/rota?caminho=true` ✅

- **Contexto:** o payload de `GET /entregas/rota` já é consumido sem paginação (E8-2 é dívida
  conhecida); adicionar o caminho por padrão multiplicaria o tamanho da resposta para todo
  consumidor por causa de um único caso de uso (o dashboard).
- **Escolha:** o caminho só entra na resposta quando `?caminho=true` é passado explicitamente; o
  apresentador de viagem ganha um segundo parâmetro opcional `{ mapa }` — sem ele, o payload é
  byte a byte o de antes do E6-4.
- **Porquê:** `GET /simulacao/eventos` e `GET /entregas/rota` já são as rotas de maior volume do
  sistema; embutir o caminho por padrão pioraria a rota mais consultada para beneficiar uma tela só.
  Opt-in é a forma mais simples de dar o dado a quem precisa sem penalizar quem não precisa.
- **Alternativas descartadas:** sempre incluir o caminho na resposta (simples, mas infla o payload
  padrão, violando a constraint de compatibilidade do payload de hoje); expor o caminho em uma rota
  própria por viagem (mais RESTful, mas exigiria N requisições do dashboard para desenhar N rotas,
  em vez de uma só chamada com o parâmetro).

## D41 — Página do dashboard como módulo TS que exporta o HTML como template string ✅

- **Contexto:** o dashboard (E6-1/D18) precisa ser servido pelo backend; `npm run build` roda
  `tsc -p tsconfig.build.json` puro e `npm start` roda `dist/index.js` — nenhum dos dois copia
  arquivos estáticos.
- **Escolha:** `src/dashboard/pagina.ts` exporta `paginaDashboard(): string`, com HTML, CSS e JS
  todos inline na mesma template string; a rota `GET /dashboard` só chama `res.type('html').send(...)`.
- **Porquê:** um `public/index.html` exigiria um passo de cópia de asset no build (`cp -r public
  dist/` ou equivalente), um ponto novo de falha no CI e uma dessincronia possível entre o que
  roda em `npm run dev` (serviria direto da fonte) e o que roda em `npm start` (serviria de
  `dist/`, só se o asset tivesse sido copiado). Como módulo TS, o HTML compila junto com o resto do
  código e os dois comandos servem exatamente o mesmo conteúdo — verificado rodando `npm run build
  && npm start` e conferindo a resposta de `/dashboard` a partir de `dist/`.
- **Alternativas descartadas:** `express.static` sobre um `public/` (mais convencional, mas exige
  copiar o diretório para `dist/` no build); renderizar via template engine (Handlebars/EJS) — peso
  desnecessário para uma página única e estática, e mais uma dependência de runtime nova, vedada
  pelo escopo deste bloco.

## D42 — Distância do rastreio é a real do mapa, contornando zonas (atualiza o critério de aceite do E6-2) ✅

- **Contexto:** o critério de aceite original do E6-2 ("a mensagem inclui a distância atual do
  drone ao cliente em quadras") foi escrito **antes** do Bloco 6 introduzir zonas de exclusão
  (D36/D17). Depois do Bloco 6, a distância Manhattan reta deixou de ser a distância real sempre
  que há uma zona entre o drone e o destino.
- **Escolha:** `montarRastreio` consulta `mapa.distancia(drone.posicao, pedido.destino)` — a mesma
  distância que já contorna zonas em toda outra parte do sistema (alcance, bateria, roteamento,
  tempo) — nunca `distanciaManhattan` direto.
- **Porquê:** anunciar "a 2 quadras" para um cliente que na verdade está a 8 quadras de desvio pela
  frente do drone seria uma mensagem enganosa, e o sistema já tem uma única fonte de verdade para
  distância desde D36. Manter dois conceitos de distância (uma "real" para o domínio e uma
  "aproximada" para o cliente) reintroduziria exatamente a inconsistência que D36 eliminou.
  **Este ADR atualiza o critério de aceite do E6-2** em `docs/BACKLOG.md`, escrito antes do Bloco 6:
  a distância citada ao cliente final passa a ser explicitamente a real, contornando zonas.
- **Alternativas descartadas:** manter `distanciaManhattan` no rastreio por ser mais barato
  (O(1) vs. consulta ao mapa) — o custo é irrelevante numa única consulta por requisição de
  rastreio, bem diferente do roteamento que reconsulta a distância O(k²) vezes por inserção.

## D43 — Persistência em lote no avanço do relógio (`emLote`) ✅

- **Contexto:** `POST /simulacao/avancar` (D32) aplica cada evento vencido ao repositório de
  pedidos e ao de viagens; cada transição grava o arquivo inteiro (`persistencia.salvar`) no
  ato — `viagens.json` duas vezes por viagem (`em_execucao`, `concluida`) e `pedidos.json` uma
  vez por decolagem mais uma vez **por pedido entregue**. Com `n` pedidos isso é `O(n)`
  gravações de `O(n)` bytes cada, `O(n²)` de I/O por avanço — registrado no metaspec como dívida.
- **Escolha:** os dois repositórios (`RepositorioPedidos`, `RepositorioViagens`) ganham
  `emLote<T>(fn: () => T): T` — um modo de *unit of work*: dentro de `fn`, cada mutação
  continua alterando a memória imediatamente (write-through de memória, sem mudar), mas a
  gravação em disco é adiada e só acontece **uma vez**, no `finally` do lote mais externo.
  `avancarPara` envolve só o laço de eventos: `pedidos.emLote(() => viagens.emLote(() => {
  ...laço... }))`. O escopo inclui **os dois repositórios**, não só viagens — o volume
  dominante do `O(n²)` está no lado de pedidos (uma gravação por entrega), não no de viagens;
  corrigir só um deles deixaria de pé exatamente o termo que mais cresce com `n`.
- **Porquê:** colapsa as N gravações por arquivo em 1 sem trocar corretude por throughput — um
  evento que lança no meio do laço ainda deixa o progresso parcial em disco (o `finally` grava
  o que já foi mutado até a exceção), preservando a semântica de hoje. Manter o repositório como
  dono da persistência (em vez de o serviço acumular mutações e chamar `substituirTodas` uma
  vez no fim) preserva o desenho atual: o repositório de pedidos não expõe "substituir tudo",
  só transições de domínio (`despachar`, `entregar`) — é isso que impede a regra de status de
  se duplicar fora dele.
- **Alternativas descartadas:** serviço acumula as mutações e grava tudo de uma vez via
  `substituirTodas` (exigiria o repositório de pedidos expor um método de escrita bruta,
  reabrindo a porta para a regra de transição vazar para fora do domínio); debounce/coalescing
  assíncrono das gravações (a persistência é síncrona por decisão, D6/D26 — introduzir
  assincronia só para isto complica o restante do sistema sem necessidade); só corrigir viagens,
  deixando pedidos como está (deixaria de pé o termo dominante do `O(n²)`, ver acima).

## D44 — Viagem de drone inexistente falha alto (`VIAGEM_INCONSISTENTE`) ✅

- **Contexto:** o motor de simulação (`domain/simulacao.ts`) agrupava as viagens por
  `droneId` e, ao não achar o drone correspondente na frota recebida, pulava o grupo em
  silêncio (`continue`) — a viagem simplesmente não gerava eventos, sem sinalizar nada. Isso
  contraria o padrão de "falhar alto" já usado em todo o resto do domínio (ex.:
  `ROTA_IMPOSSIVEL` quando não há caminho entre dois pontos). Depois de D27, a reconciliação
  do boot já descarta viagem órfã de drone inexistente antes de qualquer simulação rodar — se
  o motor ainda assim recebe uma viagem apontando para um drone ausente, é sinal de um bug de
  invariante em algum outro caminho do código, não uma entrada válida a ser tolerada.
- **Escolha:** trocar o `continue` por `throw new ErroDominio('VIAGEM_INCONSISTENTE', ...)`,
  citando a viagem e o drone ausente na mensagem. Novo código no union de
  `CodigoErroDominio` e no `Record` exaustivo de `src/api/erros.ts`, mapeado para **500**
  (erro interno, não entrada do cliente).
- **Porquê:** `DRONE_NAO_ENCONTRADO` (404) já existe e mapeia justamente o caso de cliente
  pedindo um `droneId` que não existe — reusá-lo aqui mentiria sobre a natureza da falha: não é
  um recurso que o chamador pediu errado, é o próprio sistema descobrindo um estado que seus
  invariantes deveriam ter impedido. 500 comunica isso corretamente, no mesmo espírito de
  `EMPACOTAMENTO_INCONSISTENTE` e `ROTA_IMPOSSIVEL`, que já ocupam essa faixa por motivo
  análogo. A reconciliação de D27 continua sendo a primeira linha de defesa — ela roda antes de
  `criarServicoSimulacao` em `src/index.ts` e é o motivo pelo qual este `throw` é
  inalcançável em boot íntegro; o `throw` é a rede de segurança para o caso de essa garantia
  falhar em algum ponto futuro do código.
- **Alternativas descartadas:** reusar `DRONE_NAO_ENCONTRADO` (404) — mentiria sobre a origem
  do erro, fazendo parecer entrada inválida do cliente quando é inconsistência interna;
  manter o `continue` silencioso (é exatamente a dívida que este ADR fecha — esconde um bug em
  vez de sinalizá-lo, indo contra o padrão do resto do domínio).

## D45 — Testar o JS embutido do dashboard executando o script real em jsdom ✅

- **Contexto:** o `<script>` inline de `src/dashboard/pagina.ts` (D41) nunca era executado por
  teste — `pagina.test.ts` só verificava trechos da string do HTML. Isso deixou passar dois
  defeitos de desenho na validação visual de 27/07/2026: a classe `.cliente` estava aplicada à
  posição dos drones (nunca aos destinos dos pedidos) e `carregarTudo()` nunca buscava
  `/pedidos`, então nenhum cliente aparecia no mapa; a "malha" também era só a moldura externa,
  sem grade nem rótulos de eixo. A cobertura de 100% do arquivo mascarava os dois problemas
  porque media a string produzida, nunca o comportamento do script avaliado no navegador.
- **Escolha:** `pagina.test.ts` monta `paginaDashboard()` num `JSDOM` real com
  `runScripts: 'dangerously'`, injeta um `fetch` stub por URL via `beforeParse` antes do parse
  e aguarda o tick que resolve o `Promise.all` de `carregarTudo()`. Os asserts leem o SVG
  resultante (`querySelectorAll`, `getAttribute`) — nunca layout computado, que o jsdom não
  implementa para SVG. `vitest.config.ts` não muda: o `JSDOM` é construído explicitamente por
  teste, em vez de trocar o `environment` global do Vitest para `jsdom`.
- **Porquê:** preserva D41 — nenhum asset novo, nenhum passo de build, o script continua
  inline na mesma template string servida em produção — e testa exatamente essa string, não
  uma cópia extraída para um módulo separado que poderia divergir do que é servido de verdade.
  `runScripts: 'dangerously'` é seguro aqui porque o único HTML montado é o da própria
  `paginaDashboard()` do projeto; o padrão seria perigoso se reaplicado sobre conteúdo de
  terceiros, e o comentário no arquivo de teste deixa isso explícito.
  **Limitação registrada:** a cobertura v8 de `pagina.ts` não sobe com este ADR — ela continua
  medindo a string produzida pela função, nunca o código avaliado dentro do jsdom (motor de
  cobertura e motor de execução do script são processos diferentes). O comportamento do script
  passa a ser testado; a métrica de cobertura do arquivo continua sem enxergar esse trecho. Ler
  o número como "o JS agora está coberto" repetiria o mesmo engano que originou esta correção.
- **Alternativas descartadas:** extrair o `<script>` para um módulo `.ts` separado, importado e
  testado diretamente (perde D41 puro — o build passaria a depender de empacotar/servir dois
  artefatos sincronizados, exatamente o risco que D41 evitou); usar `environment: 'jsdom'` no
  Vitest globalmente (afeta todos os testes do projeto por causa de uma única página, e a
  maioria do domínio é propositalmente Node puro); testar geometria renderizada em pixels ou
  `getBBox` (jsdom não implementa layout de SVG — o teste ficaria frágil ou simplesmente não
  funcionaria, ver Rollback & Risks do plano de correção).
