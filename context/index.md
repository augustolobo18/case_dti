# Context Index — case_dti (DroneDelivery)

> Artifact map. Updated: 2026-07-24 (v0.3)

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
No artifacts.

### Plans — plans/
No artifacts.

## Critical Files

### Código
| File                | Responsibility                                     |
| ------------------- | -------------------------------------------------- |
| `src/index.ts`      | Entry point; sobe o servidor HTTP                  |
| `src/api/server.ts` | Cria o app Express; rotas REST (hoje só `/health`) |
| `src/config.ts`     | Constantes: capacidade, alcance, base, porta (env) |

### Config
| File                  | Responsibility                                  |
| --------------------- | ----------------------------------------------- |
| `package.json`        | Scripts e dependências                          |
| `tsconfig.json`       | TS base (typecheck, inclui testes)              |
| `tsconfig.build.json` | TS de build (exclui `*.test.ts`)                |
| `vitest.config.ts`    | Config do Vitest e cobertura                    |
| `.env.example`        | Variáveis de ambiente do simulador              |

### Documentação
| File               | Responsibility                                            |
| ------------------ | --------------------------------------------------------- |
| `README.md`        | Descrição do projeto, regras, escopo, execução, API       |
| `CLAUDE.md`        | Guia do Claude Code: comandos e diretrizes de arquitetura |
| `docs/BACKLOG.md`  | Épicos, histórias (critérios de aceite) e roadmap         |
| `docs/DECISIONS.md`| Registro de decisões (ADR) D1–D21 com justificativas      |

## Tests

| Layer  | Directory        | Status  |
| ------ | ---------------- | ------- |
| Config | `src/config.test.ts` | passing |

> Domínio e API ainda sem testes — a adicionar junto com a implementação.
