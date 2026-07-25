# Timeline — case_dti (DroneDelivery)

> Evolutionary history. 4 phases | Jul/2026.

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

## Metrics Snapshot (2026-07-25)

| Métrica            | Valor                          |
| ------------------ | ------------------------------ |
| Linguagem          | TypeScript (ESM)               |
| Runtime            | Node.js 24 LTS (>= 20.12)      |
| Fases              | ~4 (init + setup + planejamento + bloco 1) |
| Backlog            | 8 épicos; 21 decisões (ADR)    |
| Testes             | passing (~4 arquivos); cobertura do domínio > 80% |
| Git                | main publicado; branch feat/bloco-1 |
