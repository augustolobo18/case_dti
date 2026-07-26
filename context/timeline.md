# Timeline — case_dti (DroneDelivery)

> Evolutionary history. 7 phases | Jul/2026.

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

## Metrics Snapshot (2026-07-26)

| Métrica            | Valor                          |
| ------------------ | ------------------------------ |
| Linguagem          | TypeScript (ESM)               |
| Runtime            | Node.js 24 LTS (>= 20.12)      |
| Fases              | ~7 (init + setup + planejamento + bloco 1 + ferramental + blocos 2-3) |
| Backlog            | 8 épicos; E1, E2 e E7 concluídos; ADRs em docs/DECISIONS.md |
| API                | 4 rotas de pedido + 2 de drone + `/health` |
| Testes             | passing (~9 arquivos); cobertura total ~98% |
| Verificação        | typecheck, lint, format, testes e build verdes no CI |
| Git                | main com 5 PRs mergeados; `feat/bloco-3` aberta, PR pendente |
