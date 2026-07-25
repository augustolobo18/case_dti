# Context Index — case_dti (DroneDelivery)

> Artifact map. Updated: 2026-07-25 (v0.8)

## Quick Navigation

| Artifact     | Path                       | Description                                   |
| ------------ | -------------------------- | --------------------------------------------- |
| CONTEXT_SPEC | `context/CONTEXT_SPEC.md`  | Especificação canônica dos docs de contexto   |
| MetaSpec     | `context/metaspec.md`      | Identidade, stack, arquitetura, estado atual  |
| Index        | `context/index.md`         | Este mapa de navegação                        |
| Timeline     | `context/timeline.md`      | Histórico evolutivo por fase                  |

## Active Artifacts

### Analyses — context/analysis/
No artifacts.

### Walkthroughs — context/walkthroughs/

| File                                        | Date       | Description                                  | Status |
| ------------------------------------------- | ---------- | -------------------------------------------- | ------ |
| `2026-07-25_Walkthrough_Bloco_2_Pedidos.md` | 2026-07-25 | Épico E1 + erros padronizados: camadas, decisões e dívidas | atual  |

### Plans — plans/
No artifacts.

## Critical Files

### Código
| File                | Responsibility                                     |
| ------------------- | -------------------------------------------------- |
| `src/index.ts`      | Entry point; compõe persistência → repositório → app. Único lugar que escolhe implementação concreta |
| `src/config.ts`     | Constantes: capacidade, alcance, malha, frota, base, porta, arquivo de pedidos (env) |

### API
| File                          | Responsibility                                              |
| ----------------------------- | ----------------------------------------------------------- |
| `src/api/server.ts`           | Monta rotas, 404 e middleware de erro (nessa ordem)          |
| `src/api/rotas/pedidos.ts`    | As 4 rotas de pedido; repassa erros via `next`, sem tratá-los |
| `src/api/schemas/pedido.ts`   | Zod na borda: valida a forma, não a regra (D3, D23)          |
| `src/api/erros.ts`            | Mapa código → HTTP e envelope `{ erro: {...} }` (D20)        |
| `src/api/middleware-erros.ts` | Handler central de erro e 404 de rota inexistente            |

### Persistência
| File                               | Responsibility                                          |
| ---------------------------------- | ------------------------------------------------------- |
| `src/infra/persistencia-pedidos.ts`| Porta `carregar`/`salvar`; impl. de arquivo (atômica, validante) e de memória |
| `src/infra/schema-pedido.ts`       | Schema do pedido já persistido; enums vindos do domínio    |
| `src/infra/erros.ts`               | `ErroPersistencia` — falha de I/O, não de regra de negócio  |
| `src/repositorio/pedidos.ts`       | Lista em memória, grava a cada mutação, filtros de listagem |

### Domínio
| File                       | Responsibility                                              |
| -------------------------- | ----------------------------------------------------------- |
| `src/domain/erros.ts`      | `ErroDominio` com código tipado; sem referência a HTTP       |
| `src/domain/coordenada.ts` | Malha 2D, validação `0..N` e distância Manhattan             |
| `src/domain/pedido.ts`     | Tipo `Pedido`, prioridades, status e factory validante       |
| `src/domain/drone.ts`      | Tipo `Drone`, estados e criação da frota homogênea           |

### Config
| File                  | Responsibility                                  |
| --------------------- | ----------------------------------------------- |
| `package.json`        | Scripts e dependências                          |
| `tsconfig.json`       | TS base (typecheck, inclui testes)              |
| `tsconfig.build.json` | TS de build (exclui `*.test.ts`)                |
| `vitest.config.ts`    | Config do Vitest e cobertura                    |
| `eslint.config.js`    | Flat config; type-aware só em `src/`, prettier por último |
| `.prettierrc.json`    | Estilo: printWidth 100, aspas simples, vírgula final |
| `.prettierignore`     | Exclui `*.md` para preservar tabelas alinhadas à mão |
| `.env.example`        | Variáveis de ambiente do simulador              |

### Documentação
| File               | Responsibility                                            |
| ------------------ | --------------------------------------------------------- |
| `README.md`        | Descrição do projeto, regras, escopo, execução, API       |
| `CLAUDE.md`        | Guia do Claude Code: comandos e diretrizes de arquitetura |
| `docs/BACKLOG.md`  | Épicos, histórias (critérios de aceite) e roadmap         |
| `docs/DECISIONS.md`| Registro de decisões (ADR) com contexto e justificativa   |

## Tests

| Layer        | Directory                            | Status  |
| ------------ | ------------------------------------ | ------- |
| Config       | `src/config.test.ts`                 | passing |
| Domínio      | `src/domain/*.test.ts`               | passing |
| Persistência | `src/infra/*.test.ts`                | passing |
| Repositório  | `src/repositorio/*.test.ts`          | passing |
| API          | `src/api/rotas/*.test.ts` (supertest)| passing |

> Testes usam a persistência em memória — nenhum escreve em disco.

## Infrastructure

| File                        | Description                                              |
| --------------------------- | -------------------------------------------------------- |
| `.github/workflows/ci.yml`  | CI em Node 24: typecheck, lint, format, testes e build    |
| `.env.example`              | Modelo das variáveis de ambiente (copiar para `.env`)     |
