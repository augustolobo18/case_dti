# MetaSpec — case_dti (DroneDelivery)

> Context for AI agents. Version: 1.0 | Updated: 2026-07-26

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

Fluxo alvo (E1 e E2 implementados; alocação e simulação pendentes):

```
POST /pedidos ──> Zod (forma) ──> Domínio (regra) ──> Repositório ──> JSON
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
                      GET /entregas/rota · GET /drones · Dashboard
```

Dependências apontam sempre para dentro: só `src/index.ts` escolhe implementações concretas.

| Layer       | Directory          | Responsibility                                       |
| ----------- | ------------------ | ---------------------------------------------------- |
| Config      | `src/config.ts`    | Constantes: capacidade, alcance, malha, frota, base, porta, arquivo de pedidos (env) |
| Domínio     | `src/domain/`      | `Coordenada` + distância, `Pedido`, `Drone`/frota, `ErroDominio` |
| Alocação    | `src/domain/`      | Algoritmo de alocação de pacotes por viagem (pendente) |
| Persistência| `src/infra/`       | Porta `carregar`/`salvar`, implementações de arquivo JSON e de memória, schema e erro próprios |
| Repositório | `src/repositorio/` | Pedidos em memória com write-through; frota derivada da config, sem persistência |
| API         | `src/api/`         | Express; rotas, schemas Zod, apresentadores, mapa erro→HTTP e middleware central |
| Entry       | `src/index.ts`     | Compõe persistência → repositório → app e sobe o HTTP |
| Dashboard   | `src/dashboard/`   | Relatório/visualização de métricas e mapa (vazio)    |

## CURRENT STATE (v1.0 — 26/07/2026)

- Branch `feat/bloco-3` (blocos 1-2 na `main`, PRs #2 a #5); bloco 3 commitado, PR pendente. Próximo: bloco 4 (alocação, E3).
- Ready:
  - Domínio base: `Coordenada` + distância Manhattan, `Pedido` e `Drone`/frota, com `ErroDominio` tipado.
  - Tipos imutáveis e funções puras; limites entram por parâmetro e `gerarId` é injetável (testes determinísticos).
  - Épico E1 completo: cadastro, consulta com filtros, busca por id e cancelamento de pedidos.
  - Épico E2 completo: frota criada da config no boot e consultável por `GET /drones` e `GET /drones/:id`.
  - Pedidos sobrevivem a reinício — persistência JSON write-through, com escrita atômica.
  - Arquivo de pedidos validado por schema ao carregar; corrompido, o boot falha sem tocar no arquivo.
  - Erros padronizados `{ erro: { codigo, mensagem, detalhes? } }` por middleware central (E7-1).
  - Testes verdes em domínio, persistência, repositórios e endpoints; cobertura total ~98%.
  - Lint type-aware, formatação determinística e CI a cada push/PR — pipeline verde ponta a ponta.
  - Detalhes: `context/walkthroughs/2026-07-26_Walkthrough_Bloco_3_Frota.md`.
- Technical debt (ordem do roadmap — `docs/BACKLOG.md`):
  - Bloco 4: alocação greedy + roteamento nearest-neighbor (E3) — o núcleo avaliado do case.
  - Blocos 5-8: simulação de estados, zonas de exclusão, dashboard e simulação de carga.
  - Status `alocado`, `em_voo` e `entregue` existem no tipo, mas nada os produz até os blocos 4-5.
  - Drone não tem operação de mutação: `estado`, `posicao` e `cargaKg` são fixos até o E3/E4.
  - Reduzir `DRONE_QUANTIDADE` entre reinícios encolhe a frota; a partir do bloco 4, `droneId` persistido pode ficar órfão (D24).
  - `GET /pedidos` e `GET /drones` sem paginação nem filtro — vira ponto de atenção na simulação de carga (E8-2).

## CRITICAL BUSINESS RULES

> Detalhe e justificativa de cada decisão: `docs/DECISIONS.md`. Escopo: `docs/BACKLOG.md`.

- Alocação: heurística greedy; cada viagem respeita capacidade (kg) e alcance (base → entregas → base); minimizar nº de viagens é o objetivo primário.
- Ordenação: prioridade (alta > média > baixa) → distância → peso (determinística).
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
