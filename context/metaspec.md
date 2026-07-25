# MetaSpec — case_dti (DroneDelivery)

> Context for AI agents. Version: 0.5 | Updated: 2026-07-25

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
| Config     | `src/config.ts`  | Constantes: capacidade, alcance, malha, frota, base, porta (env) |
| Domínio    | `src/domain/`    | `Coordenada` + distância, `Pedido`, `Drone`/frota, `ErroDominio` |
| Alocação   | `src/domain/`    | Algoritmo de alocação de pacotes por viagem (pendente) |
| API        | `src/api/`       | Express; endpoints REST (casca fina sobre o domínio) |
| Entry      | `src/index.ts`   | Sobe o servidor HTTP                                 |
| Dashboard  | `src/dashboard/` | Relatório/visualização de métricas e mapa (vazio)    |

## CURRENT STATE (v0.5 — 25/07/2026)

- Branch `feat/bloco-1`; bloco 1 do roadmap concluído. Fundação mergeada no `main` via PR #1.
- Ready:
  - Domínio base: `Coordenada` + distância Manhattan, `Pedido` e `Drone`/frota, com `ErroDominio` tipado.
  - Tipos imutáveis e funções puras; limites entram por parâmetro e `gerarId` é injetável (testes determinísticos).
  - Testes verdes (config + domínio); cobertura do domínio acima da meta de ~80% (D21).
  - API Express de pé com `/health`; backlog (8 épicos) e 21 ADRs em `docs/`.
- Technical debt (ordem do roadmap — `docs/BACKLOG.md`):
  - Bloco 2: persistência JSON de pedidos e endpoints de cadastro/consulta/cancelamento (E1).
  - Blocos 3-4: frota exposta via API e alocação greedy + roteamento nearest-neighbor (E2, E3).
  - Blocos 5-8: simulação de estados, zonas de exclusão, dashboard e simulação de carga.
  - Status `cancelado` do pedido ainda não modelado — entra com a regra de cancelamento (E1-3).

## CRITICAL BUSINESS RULES

> Detalhe e justificativa de cada decisão: `docs/DECISIONS.md` (D1–D21). Escopo: `docs/BACKLOG.md`.

- Alocação: heurística greedy; cada viagem respeita capacidade (kg) e alcance (base → entregas → base); minimizar nº de viagens é o objetivo primário.
- Ordenação: prioridade (alta > média > baixa) → distância → peso (determinística).
- Distância: métrica Manhattan `|dx| + |dy|`. A unidade é a **quadra** — nunca km, em nenhum ponto do sistema.
- Bateria e alcance são o mesmo recurso: bateria cheia equivale ao alcance total.
- Status do pedido (`pendente → alocado → em_voo → entregue`) é distinto da máquina de estados do drone.
- Valores de enum (prioridade, status, estado) são minúsculos, sem acento e em `snake_case` — seguros em JSON e query string.
- Config coerente exige `4 × cidadeTamanho <= droneAlcanceQuadras` (base na origem); abaixo disso parte da malha nasce inalcançável.
- Validação: rejeitar peso `<= 0` ou acima da capacidade, e coordenadas fora da malha `0..N`, já no cadastro.
