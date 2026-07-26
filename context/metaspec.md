# MetaSpec — case_dti (DroneDelivery)

> Context for AI agents. Version: 1.1 | Updated: 2026-07-26

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
tests       Vitest 4 (cobertura v8) + supertest (endpoints, sem porta real)
persistência arquivo JSON local via porta injetável (sem banco)
lint        ESLint 9 flat config + typescript-eslint (recommendedTypeChecked)
format      Prettier 3 (printWidth 100; ignora *.md)
ci          GitHub Actions em Node 24: typecheck > lint > format > test > build
dashboard   visualização simples (web ou ASCII)
```

## ARCHITECTURE

Fluxo alvo (E1, E2 e E3 implementados; simulação e dashboard pendentes):

```
POST /pedidos ──> Zod (forma) ──> Domínio (regra) ──> Repositório ──> JSON
                                                            │
POST /entregas/alocar ─────────────────────────────────────>│
                                       ┌────────────────────┘
                                       v
                              Algoritmo de Alocação
                        (heurística greedy: capacidade + alcance,
                         ordenado por prioridade > distância > peso)
                                       │
                                       v
                     Viagens ──> JSON ──> Simulação de Drones (pendente)
                        (Idle→Carregando→Em voo→Entregando
                              →Retornando→Idle)
                                       │
                                       v
                      GET /entregas/rota · GET /drones · Dashboard
```

Dependências apontam sempre para dentro: só `src/index.ts` escolhe implementações concretas.

| Layer       | Directory          | Responsibility                                       |
| ----------- | ------------------ | ---------------------------------------------------- |
| Config      | `src/config.ts`    | Constantes: capacidade, alcance, malha, frota, base, porta, arquivo de pedidos (env) |
| Domínio     | `src/domain/`      | `Coordenada` + distância, `Pedido`, `Drone`/frota, `ErroDominio` |
| Alocação    | `src/domain/`      | `Viagem` + roteamento nearest-neighbor; ordenação e empacotamento greedy, puros |
| Persistência| `src/infra/`       | Portas `carregar`/`salvar` de pedidos e viagens, implementações de arquivo JSON e de memória, schemas e erro próprios |
| Repositório | `src/repositorio/` | Pedidos e viagens em memória com write-through; frota derivada da config, sem persistência |
| API         | `src/api/`         | Express; rotas, schemas Zod, apresentadores, mapa erro→HTTP e middleware central |
| Entry       | `src/index.ts`     | Compõe persistências → repositórios → app, reconcilia viagens órfãs e sobe o HTTP |
| Dashboard   | `src/dashboard/`   | Relatório/visualização de métricas e mapa (vazio)    |

## CURRENT STATE (v1.1 — 26/07/2026)

- Branch `feat/bloco-4` (blocos 1-3 na `main`, PRs #2 a #6); implementação sem commit. Próximo: bloco 5 (simulação e estados, E4).
- Ready:
  - Domínio base: `Coordenada` + distância Manhattan, `Pedido` e `Drone`/frota, com `ErroDominio` tipado.
  - Tipos imutáveis e funções puras; limites entram por parâmetro e `gerarId` é injetável (testes determinísticos).
  - Épico E1 completo: cadastro, consulta com filtros, busca por id e cancelamento de pedidos.
  - Épico E2 completo: frota criada da config no boot e consultável por `GET /drones` e `GET /drones/:id`.
  - Épico E3 completo: alocação greedy e roteamento nearest-neighbor em `POST /entregas/alocar` e `GET /entregas/rota`.
  - `alocarPedidos` é pura e determinística — sem I/O, relógio ou aleatoriedade; validada com ~500 pedidos por semente fixa.
  - Pedidos e viagens sobrevivem a reinício — persistência JSON write-through, com escrita atômica.
  - Viagem cujo drone sumiu da frota é descartada no boot e seus pedidos voltam a `pendente` (D27).
  - Arquivos de pedidos e viagens validados por schema ao carregar; corrompidos, o boot falha sem tocá-los.
  - Erros padronizados `{ erro: { codigo, mensagem, detalhes? } }` por middleware central (E7-1).
  - Testes verdes em domínio, persistência, repositórios e endpoints; cobertura total ~98%, domínio ~99%.
  - Lint type-aware, formatação determinística e CI a cada push/PR — pipeline verde ponta a ponta.
  - Detalhes: `context/walkthroughs/2026-07-26_Walkthrough_Bloco_4_Alocacao.md`.
- Technical debt (ordem do roadmap — `docs/BACKLOG.md`):
  - Bloco 5: máquina de estados, tempo de entrega e bateria (E4) — hoje nada executa as viagens geradas.
  - Blocos 6-8: zonas de exclusão, dashboard e simulação de carga.
  - Drone segue `idle`, na base, sem carga e com bateria cheia mesmo com viagem atribuída — contradiz `GET /entregas/rota`.
  - Pedido para em `alocado`: `em_voo` e `entregue` existem no tipo, mas nada os produz até o bloco 5.
  - Viagens acumulam entre alocações e nenhuma rota as descarta — só apagando `data/viagens.json`.
  - `empacotar` só termina porque `separarInviaveis` garante que todo pedido restante cabe sozinho; o invariante não tem asserção.
  - Falha entre gravar pedidos e gravar viagens deixa pedido `alocado` sem viagem; a reconciliação do boot não cobre esse caso (D26).
  - `GET /pedidos`, `GET /drones` e `GET /entregas/rota` sem paginação nem filtro — ponto de atenção na simulação de carga (E8-2).

## CRITICAL BUSINESS RULES

> Detalhe e justificativa de cada decisão: `docs/DECISIONS.md`. Escopo: `docs/BACKLOG.md`.

- Alocação: heurística greedy; cada viagem respeita capacidade (kg) e alcance (base → entregas → base); minimizar nº de viagens é o objetivo primário.
- Ordenação: prioridade (alta > média > baixa) → distância → maior peso → `id`; o comparador nunca devolve 0 (D29).
- Alocação é disparada por comando explícito `POST /entregas/alocar` e só considera pedidos `pendente` — logo é idempotente (D25).
- Empacotamento é first-fit: pedido que não cabe é pulado e reavaliado na viagem seguinte, nunca trava a fila.
- Alocação parcial: pedido inviável entra em `naoAlocados` com motivo; não aborta a rodada nem some (D29).
- Cada tentativa de inserção reroteia a viagem inteira — a distância depende do conjunto, não do último inserido.
- Roteamento desempata por menor `x`, depois menor `y` — nunca pela ordem de cadastro (D12).
- Viagens são distribuídas entre os drones em round-robin, sem olhar carga nem posição (D28).
- Viagens são persistidas como os pedidos; gravar pedidos antes das viagens deixa a falha intermediária recuperável (D26).
- Viagem cujo `droneId` sumiu da frota é descartada no boot e seus pedidos voltam a `pendente` — encolher a frota é operação prevista, não corrupção (D27).
- Distância: métrica Manhattan `|dx| + |dy|`. A unidade é a **quadra** — nunca km, em nenhum ponto do sistema.
- Bateria e alcance são o mesmo recurso: bateria cheia equivale ao alcance total.
- Status do pedido (`pendente → alocado → em_voo → entregue`, mais `cancelado`) é distinto da máquina de estados do drone.
- Cancelamento só é permitido a partir de `pendente`; cancelar em qualquer outro status — inclusive já `cancelado` — é erro, não no-op.
- Erro → HTTP: 400 é entrada malformada, 422 é entrada válida que viola regra de negócio, 404 é inexistente. O mapa é único, em `src/api/erros.ts` — rota nenhuma escolhe status.
- Valores de enum (prioridade, status, estado) são minúsculos, sem acento e em `snake_case` — seguros em JSON e query string.
- Config coerente exige `4 × cidadeTamanho <= droneAlcanceQuadras` (base na origem); abaixo disso parte da malha nasce inalcançável.
- Frota é derivada da config a cada boot, nunca persistida; ids são sequenciais (`drone-1`…`drone-N`) para permanecerem estáveis entre reinícios (D24).
- Não existe cadastro de drone por API: a frota muda por `.env` + reinício (D8).
- Validação: rejeitar peso `<= 0` ou acima da capacidade, e coordenadas fora da malha `0..N`, já no cadastro.
- Entrada do domínio é não confiável: `DadosNovoPedido` usa primitivos frouxos (`prioridade: string`) e a factory devolve o tipo estreito — parse-don't-validate.
- O arquivo de pedidos também é entrada não confiável: é validado por schema ao carregar e nunca é apagado, renomeado ou regravado quando inválido.
- O processo é dono único do arquivo: o estado é lido uma vez no boot; edição externa com o servidor de pé é ignorada e sobrescrita.
