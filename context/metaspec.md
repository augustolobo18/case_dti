# MetaSpec — case_dti (DroneDelivery)

> Context for AI agents. Version: 0.3 | Updated: 2026-07-24

## IDENTITY

- Nome: DroneDelivery — simulador de entregas por drone (desafio técnico de processo seletivo).
- Domínio: logística / simulação de roteamento em malha 2D.
- Propósito: alocar pacotes em drones minimizando o número de viagens, respeitando capacidade, alcance e prioridade.
- Público: avaliadores do processo seletivo (DTI); entrega via repo público no GitHub.
- Linguagem: TypeScript (Node.js).

## STACK

```
runtime     Node.js >= 20.12 (dev no Node 24 LTS)
language    TypeScript (ESM, module NodeNext)
api         REST — Express 4
validação   Zod (nas bordas da API)
tests       Vitest 4 (cobertura v8)
dashboard   visualização simples (web ou ASCII)
```

## ARCHITECTURE

Fluxo alvo (parcialmente implementado — hoje só o esqueleto da API):

```
POST /pedidos ──> Validação ──> Fila/Repositório de Pedidos
                                       │
                                       v
                              Algoritmo de Alocação
                        (heurística greedy: capacidade + alcance,
                         ordenado por prioridade > distância > peso)
                                       │
                                       v
                          Viagens ──> Simulação de Drones
                        (Idle→Carregando→Em voo→Entregando
                              →Retornando→Idle)
                                       │
                                       v
                    GET /entregas/rota · GET /drones/status · Dashboard
```

| Layer      | Directory        | Responsibility                                        |
| ---------- | ---------------- | ---------------------------------------------------- |
| Config     | `src/config.ts`  | Constantes: capacidade, alcance, base, porta (env)   |
| Domínio    | `src/domain/`    | Pedido, Drone, Viagem, Coordenada; regras e distância (vazio) |
| Alocação   | `src/domain/`    | Algoritmo de alocação de pacotes por viagem (vazio)  |
| API        | `src/api/`       | Express; endpoints REST (casca fina sobre o domínio) |
| Entry      | `src/index.ts`   | Sobe o servidor HTTP                                 |
| Dashboard  | `src/dashboard/` | Relatório/visualização de métricas e mapa (vazio)    |

## CURRENT STATE (v0.3 — 24/07/2026)

- Branch `feat/inicializacao`. Setup verde; planejamento (backlog + decisões) concluído.
- Ready:
  - Projeto Node + TS (ESM) configurado: build, testes, typecheck e audit passando.
  - API Express de pé com `/health`; `src/config.ts` com capacidade/alcance/base via env.
  - Backlog completo (8 épicos) e 21 decisões (ADR) documentados — ver `docs/`.
- Technical debt (implementação, na ordem do roadmap — `docs/BACKLOG.md`):
  - Domínio ainda não modelado (`Coordenada`+distância, `Pedido`, `Drone`, `Viagem`).
  - Algoritmo de alocação e endpoints do case (`/pedidos`, `/entregas/rota`, `/drones/status`) pendentes.
  - Simulação de estados, bateria, zonas de exclusão, dashboard e testes: pendentes.

## CRITICAL BUSINESS RULES

> Detalhe e justificativa de cada decisão: `docs/DECISIONS.md` (D1–D21). Escopo: `docs/BACKLOG.md`.

- Alocação: heurística greedy; cada viagem respeita capacidade (kg) e alcance (km, base → entregas → base); minimizar nº de viagens é o objetivo primário.
- Ordenação: prioridade (alta > média > baixa) → distância → peso (determinística).
- Distância: métrica Manhattan `|dx| + |dy|` na malha; bateria = alcance (mesmo recurso).
- Status do pedido (`pendente → alocado → em voo → entregue`) é distinto da máquina de estados do drone.
- Validação: rejeitar peso `<= 0` ou acima da capacidade, e coordenadas fora da malha `0..N`, já no cadastro.
