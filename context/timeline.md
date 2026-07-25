# Timeline — case_dti (DroneDelivery)

> Evolutionary history. 3 phases | Jul/2026.

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

## Phase 2: Planejamento (Jul/2026)

- Commits: 2ceace6, c4615a6.
- Backlog completo em `docs/BACKLOG.md`: personas, 8 épicos, histórias com critérios de aceite e roadmap.
- Escopo definido como completo (núcleo + todos os diferenciais), priorizado por ordem de implementação.
- Registro de decisões `docs/DECISIONS.md`: 21 ADRs (D1–D21) com contexto, escolha e justificativa.
- Nenhum código de domínio ainda; próxima fase inicia pelo bloco 1 do roadmap (domínio base).

## Metrics Snapshot (2026-07-24)

| Métrica            | Valor                          |
| ------------------ | ------------------------------ |
| Linguagem          | TypeScript (ESM)               |
| Runtime            | Node.js 24 LTS (>= 20.12)      |
| Fases              | ~3 (init + setup + planejamento) |
| Backlog            | 8 épicos; 21 decisões (ADR)    |
| Testes             | passing (~1 arquivo)           |
| Git                | feat/inicializacao, ~5 commits |
