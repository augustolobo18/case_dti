# Timeline — case_dti (DroneDelivery)

> Evolutionary history. 12 phases | Jul/2026.

## Phase 0: Inicialização (Jul/2026)

- Commit: c645a2e.
- Definição do projeto: simulador de entregas por drone para desafio técnico (DTI).
- Decisões travadas: stack Node.js + TypeScript; interface API REST + dashboard; escopo por feature (núcleo primeiro).
- Criados README.md (descrição do projeto) e CLAUDE.md (diretrizes de arquitetura).
- Inicializada a estrutura de documentação de contexto (CONTEXT_SPEC, metaspec, index, timeline).

## Phase 1: Setup do projeto (Jul/2026)

- Commit: 2a25daf.
- Projeto Node + TS (ESM, NodeNext) configurado: scripts de dev/build/test/typecheck.
- Escolhas de stack: Express 4 + Zod (validação) + Vitest 4 (cobertura v8).
- Node atualizado para 24 LTS (Vitest 4 exige >= 20.12); esqueleto da API com `/health`.
- Validado ponta a ponta: testes, typecheck, build e audit (0 vulnerabilidades) verdes.

## Phase 2: Planejamento & publicação (Jul/2026)

- Commits: 2ceace6, c4615a6.
- Backlog completo em `docs/BACKLOG.md`: personas, 8 épicos, histórias com critérios de aceite e roadmap.
- Escopo definido como completo (núcleo + todos os diferenciais), priorizado por ordem de implementação.
- Registro de decisões `docs/DECISIONS.md`: 21 ADRs (D1–D21) com contexto, escolha e justificativa.
- Fundação publicada no GitHub (repo público) e mergeada no `main` via PR #1.
- Nenhum código de domínio ainda; implementação inicia pelo bloco 1 do roadmap (domínio base).

## Phase 3: Bloco 1 — domínio base (Jul/2026)

- Commits: 857e6e9, 2a2b2bc.
- Unidade de distância unificada em **quadra** (antes km), removendo a inconsistência com a malha; D16 passa a fixá-la.
- Domínio base implementado: `Coordenada` + Manhattan, `Pedido`, `Drone`/frota e `ErroDominio` tipado.
- Modelagem escolhida: tipos imutáveis + funções puras, com limites por parâmetro — o domínio não conhece config nem HTTP.
- Defaults de config corrigidos: alcance 20 → 40 quadras, pois `4 × cidadeTamanho` tornava a malha inalcançável.
- Detalhes: `plans/old/2026-07-25_Bloco_1_Dominio_Base.md`.

## Phase 4: Ferramental de qualidade (Jul/2026)

- Commits: e991dc1, 8d148e0, 83d97e3 (PR #3).
- ESLint 9 flat config type-aware + Prettier + CI no GitHub Actions, rodando a cada push e PR.
- Flat config segmentada: type-aware só em `src/`, pois os configs da raiz ficam fora do `include` do tsconfig.
- O lint achou modelagem incorreta no dia 1: `DadosNovoPedido.prioridade` era `Prioridade`, tipando entrada não confiável.
- Corrigido para `string` (parse-don't-validate), o que dispensou o `@ts-expect-error` que o teste precisava.
- Detalhes: `plans/old/2026-07-25_Ferramental_Qualidade.md`.

## Phase 5: Bloco 2 — gestão de pedidos (Jul/2026)

- Commit: 9a279b8 (PR #5).
- Épico E1 completo: cadastro, consulta com filtros, busca por id e cancelamento, expostos em 4 rotas REST.
- Cancelamento virou sub-recurso de ação (`POST /pedidos/:id/cancelar`), não `DELETE`: o pedido permanece no sistema com status `cancelado`.
- Persistência por porta injetável — arquivo JSON no servidor, memória nos testes; nenhum teste toca o disco.
- Erros padronizados por middleware central, com o mapa código → HTTP num `Record` exaustivo: código novo sem status quebra o typecheck.
- Duas dívidas do próprio bloco fechadas em seguida (87226b8): schema valida o arquivo ao carregar, e o I/O real ganhou teste em diretório temporário.
- Terceira dívida rebaixada a limitação documentada — reler o arquivo por operação anularia o design em memória sem cobrir cenário real.
- Detalhes: `context/walkthroughs/2026-07-25_Walkthrough_Bloco_2_Pedidos.md`.

## Phase 6: Bloco 3 — frota de drones (Jul/2026)

- Commit: b686cf4 (branch `feat/bloco-3`).
- Épico E2 completo: frota criada da config no boot e exposta em `GET /drones` e `GET /drones/:id`.
- Primeira implementação inteiramente em TDD — teste vermelho pelo motivo certo antes de cada tarefa de produção.
- Ids de drone passaram a ser sequenciais (`drone-1`…`drone-N`): `randomUUID` mudava a cada boot e deixaria órfão o `droneId` que o bloco 4 vai persistir (D24).
- Frota não é persistida — é derivada da config, evitando reconciliar arquivo salvo com `.env` alterado.
- `criarApp` passou a receber um objeto de dependências, para o bloco 4 somar `viagens` sem novo parâmetro posicional.
- Detalhes: `context/walkthroughs/2026-07-26_Walkthrough_Bloco_3_Frota.md`.

## Phase 7: Bloco 4 — alocação & otimização (Jul/2026)

- Commits: 8aeebcc, 40805d5 (PR #7).
- Épico E3 completo: alocação greedy, roteamento nearest-neighbor e as rotas `POST /entregas/alocar` e `GET /entregas/rota`.
- Alocação virou comando explícito, não efeito colateral do cadastro: separa planejamento de cadastro e mantém o `GET` sem efeito (D25).
- `alocarPedidos` ficou pura — sem I/O, relógio ou aleatoriedade — o que permitiu testá-la com ~500 pedidos por semente fixa já neste bloco.
- Viagens persistidas em JSON porque `pedido.status` já era persistido: mantê-las em memória deixaria pedidos `alocado` órfãos no arquivo (D26).
- Reconciliação no boot fechou a limitação conhecida de D24 — viagem de drone removido é descartada e seus pedidos voltam a `pendente` (D27).
- Empacotamento é first-fit, não next-fit: pedido que não cabe é pulado, o que faz um pacote leve ocupar espaço onde um pesado não coube.
- Detalhes: `context/walkthroughs/2026-07-26_Walkthrough_Bloco_4_Alocacao.md`.

## Phase 8: Bloco 5 — simulação & estados (Jul/2026)

- Commits: 0979a73, e2f5d48 (PR #8).
- Épico E4 completo: máquina de estados do drone, motor de simulação em tempo simulado, métricas de tempo e bateria consumível.
- Máquina de estados virou tabela (`Record<EstadoDrone, EstadoDrone[]>`), não cadeia de `if`: estado novo sem transição declarada quebra o typecheck.
- Transição e efeito físico ficaram em funções separadas — o motor compõe as duas na ordem certa sem que nenhuma conheça o roteiro da viagem.
- Escolhido relógio virtual avançável em vez de simulação instantânea: é o que faz `GET /drones` exibir de fato os estados (D30).
- Linha do tempo não é persistida — recomputada das viagens a cada boot, mesma lógica de D24 para a frota (D31).
- Camada `src/servicos/` criada: aplicar eventos toca três repositórios, não cabia nem na rota nem num repositório.
- Ciclo de vida da viagem (D35) virou requisito, não opção: sem ele a segunda alocação reexecutaria entregas já feitas.
- Exportação de `empacotar` feita para testar a guarda do invariante e revertida em seguida — o teste exercitava estado inalcançável ao custo da API pública do módulo.
- Detalhes: `context/walkthroughs/2026-07-26_Walkthrough_Bloco_5_Simulacao.md`.

## Phase 9: Bloco 6 — zonas de exclusão (Jul/2026)

- Commits: 12d01b9, c28006f, c089be3 (PR #9).
- Épico E5 completo: zonas de exclusão como células bloqueadas e distância que as contorna alimentando alcance, bateria, roteamento e tempo.
- A distância deixou de ser fórmula O(1) e virou consulta ao `MapaCidade` — mudança conceitual, não de superfície.
- BFS memoizado por origem escolhido sobre A* por par: os mesmos pares se repetem dentro do empacotamento, então cache vence heurística (D36).
- Compatibilidade virou código, não só teste: sem zonas, `distancia` devolve Manhattan por atalho explícito.
- `null` do mapa ganhou dois destinos: `naoAlocados` antes da filtragem, `ROTA_IMPOSSIVEL` depois dela — a assimetria vem do argumento de conectividade.
- Distância total da simulação passou a ser acumulada das pernas percorridas, eliminando divergência com `viagens.json` gravado antes das zonas.
- Primeiro bloco executado por subagente a partir do plano aprovado; o plano absorveu as decisões e a execução não precisou de nenhuma.
- Duas limitações viraram histórias formais: E6-3 (expor zonas) e E6-4 (caminho observável) são pré-requisitos do dashboard, não dívida solta.
- Detalhes: `context/walkthroughs/2026-07-27_Walkthrough_Bloco_6_Zonas_Exclusao.md`.

## Phase 10: Bloco 7 — dashboard & feedback (Jul/2026)

- Branch `feat/bloco-7`, sem commit até aqui.
- Épico E6 completo: mapa legível pela API, caminho observável, dashboard web e rastreio ao cliente.
- O caminho virou contrato público sem virar dado persistido — derivado do mesmo campo de distâncias do Bloco 6.
- `campoDistanciasDe` extraído para que `distancia` e `caminho` não possam divergir quanto ao desvio; foi a peça que o plano não previu.
- Caminho canônico eleito por regra explícita, reusando o desempate D12 do roteamento em vez de depender da ordem da fila do BFS (D39).
- Caminho exposto como opt-in (D40): a listagem de viagens segue sem paginação, e o payload padrão não mudou.
- Dashboard entregue como módulo TS com HTML embutido (D41) porque `tsc` não copia `.html` — evitou script de cópia e um ponto novo de falha no CI.
- Rastreio adotou a distância real do mapa e degrada em vez de falhar, atualizando um critério de aceite escrito antes de D36 (D42).
- Segundo bloco executado por subagente a partir do plano aprovado; os dois desvios foram mecânicos, sem decisão de projeto.
- Detalhes: `context/walkthroughs/2026-07-27_Walkthrough_Bloco_7_Dashboard_Feedback.md`.

## Phase 11: Saneamento de dívidas (Jul/2026)

- Commit: bfe951b, branch `chore/saneamento-dividas` sobre `feat/bloco-7`.
- Três dívidas do metaspec fechadas sem mudar contrato de rota nem formato de arquivo em disco.
- Ramo morto do plural em `rastreio.ts` removido; os 100% de branches são a prova de que era inalcançável.
- Repositórios ganharam `emLote`: o avanço do relógio grava cada arquivo uma vez, não uma por evento (D43).
- Escopo do lote incluiu pedidos, não só viagens: era ali o termo dominante do O(n²), 1 gravação por entrega.
- Adia-se só a escrita, nunca a mutação em memória — é dela que o early-return de `atualizarStatusViagem` depende.
- Viagem de drone ausente da frota passou a falhar alto com `VIAGEM_INCONSISTENTE`, em vez de ser pulada (D44).
- Primeira leva de trabalho nascida de investigação de dívida, não do backlog.

## Metrics Snapshot (2026-07-27)

| Métrica            | Valor                          |
| ------------------ | ------------------------------ |
| Linguagem          | TypeScript (ESM)               |
| Runtime            | Node.js 24 LTS (>= 20.12)      |
| Fases              | ~12 (init + setup + planejamento + bloco 1 + ferramental + blocos 2-7 + saneamento) |
| Backlog            | 8 épicos; E1-E7 concluídos; resta E8-2 (carga); ADRs em docs/DECISIONS.md |
| API                | 5 rotas de pedido + 2 de drone + 3 de entrega + 3 de simulação + `/mapa` + `/dashboard` + `/health` |
| Testes             | passing (~25 arquivos); cobertura total ~97%, domínio ~98% |
| Verificação        | typecheck, lint, format, testes e build verdes no CI |
| Git                | main com 9 PRs mergeados; `feat/bloco-7` e `chore/saneamento-dividas` commitadas, ainda não publicadas |
