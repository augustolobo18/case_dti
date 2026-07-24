# MetaSpec — case_dti (DroneDelivery)

> Context for AI agents. Version: 0.1 | Updated: 2026-07-24

## IDENTITY

- Nome: DroneDelivery — simulador de entregas por drone (desafio técnico de processo seletivo).
- Domínio: logística / simulação de roteamento em malha 2D.
- Propósito: alocar pacotes em drones minimizando o número de viagens, respeitando capacidade, alcance e prioridade.
- Público: avaliadores do processo seletivo (DTI); entrega via repo público no GitHub.
- Linguagem: TypeScript (Node.js).

## STACK

```
runtime     Node.js (a definir versão via .node-version)
language    TypeScript
api         REST — Express/Fastify (a definir)
tests       a definir (Vitest recomendado)
dashboard   visualização simples (web ou ASCII)
```

## ARCHITECTURE

Fluxo alvo (ainda não implementado):

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

| Layer      | Directory (alvo) | Responsibility                                        |
| ---------- | ---------------- | ---------------------------------------------------- |
| Domínio    | `src/domain/`    | Pedido, Drone, Viagem, Coordenada; regras e distância |
| Alocação   | `src/domain/`    | Algoritmo de alocação de pacotes por viagem          |
| API        | `src/api/`       | Endpoints REST (casca fina sobre o domínio)          |
| Dashboard  | `src/dashboard/` | Relatório/visualização de métricas e mapa            |

## CURRENT STATE (v0.1 — 24/07/2026)

- Sem branch git ainda (repositório não inicializado). Estado: greenfield.
- Ready: README (descrição do projeto) e CLAUDE.md (guia de arquitetura) criados.
- Technical debt:
  - Inicializar git e projeto Node/TS (package.json, tsconfig) — ainda não feito.
  - Escolher e configurar framework de testes e framework REST.
  - Definir constantes de capacidade (X kg) e alcance (Y km) do drone.

## CRITICAL BUSINESS RULES

- Alocação: cada viagem respeita capacidade máxima (kg) e alcance máximo (km = ida + entregas + volta); minimizar número de viagens é o objetivo primário.
- Prioridade: entregas ordenadas por prioridade (alta > média > baixa), com peso e distância como critérios de otimização.
- Validação: rejeitar pacote cujo peso excede a capacidade do drone e entradas inválidas (coordenadas/prioridade).
