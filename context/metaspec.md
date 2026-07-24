# MetaSpec — case_dti (DroneDelivery)

> Context for AI agents. Version: 0.2 | Updated: 2026-07-24

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
                        (bin-packing: peso + alcance,
                         ordenado por prioridade/distância)
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

## CURRENT STATE (v0.2 — 24/07/2026)

- Branch `main`; repositório inicializado. Setup do projeto concluído e verde.
- Ready:
  - Projeto Node + TS (ESM) configurado: build, testes, typecheck e audit passando.
  - API Express de pé com `/health`; `src/config.ts` com capacidade/alcance/base via env.
- Technical debt:
  - Domínio ainda não modelado (`Pedido`, `Drone`, `Viagem`, `Coordenada`, distância).
  - Algoritmo de alocação e endpoints do case (`/pedidos`, `/entregas/rota`, `/drones/status`) pendentes.
  - Dashboard/relatório não iniciado.

## CRITICAL BUSINESS RULES

- Alocação: cada viagem respeita capacidade máxima (kg) e alcance máximo (km = ida + entregas + volta); minimizar número de viagens é o objetivo primário.
- Prioridade: entregas ordenadas por prioridade (alta > média > baixa), com peso e distância como critérios de otimização.
- Validação: rejeitar pacote cujo peso excede a capacidade do drone e entradas inválidas (coordenadas/prioridade).
