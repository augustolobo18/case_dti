# Context Index — case_dti (DroneDelivery)

> Artifact map. Updated: 2026-07-26 (v1.1)

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

| File                                          | Date       | Description                                  | Status |
| --------------------------------------------- | ---------- | -------------------------------------------- | ------ |
| `2026-07-26_Walkthrough_Bloco_5_Simulacao.md` | 2026-07-26 | Épico E4: estados, motor de simulação, tempo, bateria e ADRs D30–D35 | atual |
| `2026-07-26_Walkthrough_Bloco_4_Alocacao.md`  | 2026-07-26 | Épico E3: viagem, greedy, roteamento e ADRs D25–D29 | anterior |
| `2026-07-26_Walkthrough_Bloco_3_Frota.md`     | 2026-07-26 | Épico E2: frota da config, rotas de drone e ADR D24 | anterior |
| `2026-07-25_Walkthrough_Bloco_2_Pedidos.md`   | 2026-07-25 | Épico E1 + erros padronizados: camadas, decisões e dívidas | anterior |

### Plans — plans/

| File                                          | Date       | Description                                  | Status |
| --------------------------------------------- | ---------- | -------------------------------------------- | ------ |
| `2026-07-26_Bloco_5_Simulacao_Estados.md`     | 2026-07-26 | Plano do épico E4 — implementado; mover para `old/` no commit | implementado |

## Critical Files

### Código
| File                | Responsibility                                     |
| ------------------- | -------------------------------------------------- |
| `src/index.ts`      | Entry point; compõe persistência → repositório → app. Único lugar que escolhe implementação concreta |
| `src/config.ts`     | Constantes: capacidade, alcance, malha, frota, base, porta, arquivo de pedidos (env) |

### API
| File                          | Responsibility                                              |
| ----------------------------- | ----------------------------------------------------------- |
| `src/api/server.ts`           | Recebe `Dependencias`; monta rotas, 404 e middleware de erro (nessa ordem) |
| `src/api/rotas/pedidos.ts`    | As 4 rotas de pedido; repassa erros via `next`, sem tratá-los |
| `src/api/rotas/drones.ts`     | As 2 rotas de consulta da frota (E2-2)                       |
| `src/api/rotas/entregas.ts`   | `POST /alocar`, `GET /rota?status=` e `DELETE /concluidas`; grava pedidos antes das viagens (D26) |
| `src/api/rotas/simulacao.ts`  | `GET /`, `POST /avancar` e `GET /eventos` (E4)               |
| `src/api/apresentadores/drone.ts` | `RespostaDrone`: campos do domínio + `bateriaPercentual` derivado |
| `src/api/apresentadores/viagem.ts` | `RespostaViagem`: campos do domínio + totais derivados na borda |
| `src/api/apresentadores/simulacao.ts` | `RespostaEvento` e `RespostaMetricas`                  |
| `src/api/schemas/pedido.ts`   | Zod na borda: valida a forma, não a regra (D3, D23)          |
| `src/api/schemas/simulacao.ts`| Zod do avanço (exatamente um entre `ateInstante` e `minutos`), recorte de eventos e filtro de viagem |
| `src/api/erros.ts`            | Mapa código → HTTP e envelope `{ erro: {...} }` (D20)        |
| `src/api/middleware-erros.ts` | Handler central de erro e 404 de rota inexistente            |

### Persistência
| File                               | Responsibility                                          |
| ---------------------------------- | ------------------------------------------------------- |
| `src/infra/persistencia-pedidos.ts`| Porta `carregar`/`salvar`; impl. de arquivo (atômica, validante) e de memória |
| `src/infra/persistencia-viagens.ts`| Mesma porta para viagens; espelha o desenho da de pedidos (D26) |
| `src/infra/schema-pedido.ts`       | Schema do pedido já persistido; enums vindos do domínio    |
| `src/infra/schema-viagem.ts`       | Schema da viagem já persistida                              |
| `src/infra/erros.ts`               | `ErroPersistencia` — falha de I/O, não de regra de negócio  |
| `src/repositorio/pedidos.ts`       | Lista em memória, grava a cada mutação, filtros e mutação em lote atômica |
| `src/repositorio/viagens.ts`       | Write-through; reconcilia viagens órfãs na criação e expõe `pedidoIdsOrfaos` (D27) |
| `src/repositorio/frota.ts`         | Frota montada da config no boot; consulta e `atualizar`, sem persistência (D24) |

### Domínio
| File                       | Responsibility                                              |
| -------------------------- | ----------------------------------------------------------- |
| `src/domain/erros.ts`      | `ErroDominio` com código tipado; sem referência a HTTP       |
| `src/domain/coordenada.ts` | Malha 2D, validação `0..N` e distância Manhattan             |
| `src/domain/pedido.ts`     | Tipo `Pedido`, prioridades, status e factory validante       |
| `src/domain/drone.ts`      | Tipo `Drone`, frota homogênea, gerador de id sequencial e a tabela de transições (E4-1) |
| `src/domain/viagem.ts`     | Tipo `Viagem`, status (D35), roteamento nearest-neighbor, guarda de invariante e reconciliação |
| `src/domain/alocacao.ts`   | **Núcleo do case**: ordenação (D11) e empacotamento greedy (D9), puros |
| `src/domain/simulacao.ts`  | Motor puro do E4: viagens → eventos com timestamps + métricas (D13, D14) |

### Serviços
| File                      | Responsibility                                               |
| ------------------------- | ------------------------------------------------------------ |
| `src/servicos/simulacao.ts` | Relógio virtual e aplicação dos eventos aos 3 repositórios; sem regra própria (D30–D33) |

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
| Serviços     | `src/servicos/*.test.ts`             | passing |
| API          | `src/api/rotas/*.test.ts` (supertest)| passing |

> Toda implementação segue TDD: o teste falha antes do código que o faz passar.

> Testes usam a persistência em memória — nenhum escreve em disco.

## Infrastructure

| File                        | Description                                              |
| --------------------------- | -------------------------------------------------------- |
| `.github/workflows/ci.yml`  | CI em Node 24: typecheck, lint, format, testes e build    |
| `.env.example`              | Modelo das variáveis de ambiente (copiar para `.env`)     |
