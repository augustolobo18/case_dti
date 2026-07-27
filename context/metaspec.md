# MetaSpec — case_dti (DroneDelivery)

> Context for AI agents. Version: 1.7 | Updated: 2026-07-27

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

Fluxo (E1–E7 implementados):

```
POST /pedidos ──> Zod (forma) ──> Domínio (regra) ──> Repositório ──> JSON
                                                            │
POST /entregas/alocar ─────────────────────────────────────>│
                                       ┌────────────────────┘
                                       v
                              Algoritmo de Alocação
                        (heurística greedy: capacidade + alcance,
                         ordenado por prioridade > distância > peso;
                         distância vem do MapaCidade, contornando zonas)
                                       │
                                       v
                     Viagens ──> JSON ──> Motor de Simulação (puro)
                                       │   viagens -> eventos + métricas
                                       v
                            Serviço de Simulação
                     (relógio virtual; POST /simulacao/avancar
                      aplica os eventos vencidos aos repositórios)
                                       │
                                       v
       GET /drones (idle→carregando→em_voo→entregando→retornando)
       GET /pedidos (pendente→alocado→em_voo→entregue)
       GET /entregas/rota[?caminho=true] · GET /simulacao
       GET /mapa · GET /pedidos/:id/rastreio
                                       │
                                       v
                      GET /dashboard (página HTML inline)
                consome as rotas acima; controles chamam
                POST /entregas/alocar e POST /simulacao/avancar
```

Dependências apontam sempre para dentro: só `src/index.ts` escolhe implementações concretas.

| Layer       | Directory          | Responsibility                                       |
| ----------- | ------------------ | ---------------------------------------------------- |
| Config      | `src/config.ts`    | Constantes: capacidade, alcance, malha, frota, base, porta, arquivo de pedidos (env) |
| Domínio     | `src/domain/`      | `Coordenada` + distância, `Pedido`, `Drone`/frota, `ErroDominio` |
| Mapa        | `src/domain/`      | `MapaCidade`: zonas, distância e caminho por BFS memoizado por origem, puro |
| Rastreio    | `src/domain/`      | Mensagem de status em linguagem amigável a partir de pedido + drone + mapa, pura |
| Alocação    | `src/domain/`      | `Viagem` + roteamento nearest-neighbor; ordenação e empacotamento greedy, puros |
| Simulação   | `src/domain/`      | Máquina de estados do drone e motor que transforma viagens em eventos com timestamps, puros |
| Persistência| `src/infra/`       | Portas `carregar`/`salvar` de pedidos e viagens, implementações de arquivo JSON e de memória, schemas e erro próprios |
| Repositório | `src/repositorio/` | Pedidos e viagens em memória com write-through; frota derivada da config, sem persistência |
| Serviços    | `src/servicos/`    | Orquestra domínio + repositórios sem HTTP; guarda o relógio virtual e aplica os eventos |
| API         | `src/api/`         | Express; rotas, schemas Zod, apresentadores, mapa erro→HTTP e middleware central |
| Entry       | `src/index.ts`     | Compõe persistências → repositórios → serviço → app, reconcilia viagens órfãs e sobe o HTTP |
| Dashboard   | `src/dashboard/`   | Página HTML/CSS/SVG/JS inline, sem asset em disco nem host externo |

## CURRENT STATE (v1.7 — 27/07/2026)

- `main` limpa e em dia: blocos 1-7 e o saneamento de dívidas mergeados (PRs #2 a #12), sem branch de trabalho aberta.
- Próximo: bloco 8 (E8-2 — simulação de carga), único item restante do backlog.
- Ready:
  - Domínio base: `Coordenada` + distância Manhattan, `Pedido` e `Drone`/frota, com `ErroDominio` tipado.
  - Tipos imutáveis e funções puras; limites entram por parâmetro e `gerarId` é injetável (testes determinísticos).
  - Épico E1 completo: cadastro, consulta com filtros, busca por id e cancelamento de pedidos.
  - Épico E2 completo: frota criada da config no boot e consultável por `GET /drones` e `GET /drones/:id`.
  - Épico E3 completo: alocação greedy e roteamento nearest-neighbor em `POST /entregas/alocar` e `GET /entregas/rota`.
  - Épico E4 completo: máquina de estados, linha do tempo de eventos, métricas de tempo e bateria consumível.
  - Épico E5 completo: zonas de exclusão da config e distância que as contorna alimentando alcance, bateria, roteamento e tempo.
  - Sem zonas configuradas, a distância volta a ser exatamente Manhattan por atalho no código — não só por teste de regressão.
  - Épico E6 completo: mapa legível, caminho observável, dashboard web e rastreio ao cliente.
  - `GET /mapa` devolve malha, base e zonas; somente leitura, derivada da config.
  - `mapa.caminho` devolve as células percorridas; `GET /entregas/rota?caminho=true` as expõe por perna, sob demanda.
  - `GET /pedidos/:id/rastreio` responde em linguagem amigável; `em_voo` cita a distância real ao cliente.
  - `GET /dashboard` serve página autossuficiente com métricas, mapa SVG das rotas e controles de simulação.
  - Métricas da simulação incluem entregas por drone e `droneMaisEficiente` (entregas ÷ distância).
  - Avanço do relógio grava cada arquivo uma vez, não uma vez por evento aplicado (D43).
  - `alocarPedidos` e `simular` são puras e determinísticas — sem I/O, relógio ou aleatoriedade.
  - Relógio virtual: `POST /simulacao/avancar` aplica os eventos vencidos; `GET /drones` e `GET /pedidos` refletem o estado.
  - Ciclo de vida da viagem (`planejada → em_execucao → concluida`) com filtro e `DELETE /entregas/concluidas`.
  - Pedidos e viagens sobrevivem a reinício — persistência JSON write-through, com escrita atômica.
  - Viagem cujo drone sumiu da frota é descartada no boot e seus pedidos voltam a `pendente` (D27).
  - Arquivos de pedidos e viagens validados por schema ao carregar; corrompidos, o boot falha sem tocá-los.
  - Erros padronizados `{ erro: { codigo, mensagem, detalhes? } }` por middleware central (E7-1).
  - Testes verdes em domínio, serviços, persistência, repositórios e endpoints; cobertura total ~98%, domínio ~98,5%.
  - Lint type-aware, formatação determinística e CI a cada push/PR — pipeline verde ponta a ponta.
  - Detalhes: `context/walkthroughs/2026-07-27_Walkthrough_Bloco_7_Dashboard_Feedback.md`.
- Technical debt (ordem do roadmap — `docs/BACKLOG.md`):
  - Bloco 8: simulação de carga (E8-2).
  - Zona nova não invalida viagem já planejada; a simulação recomputa as pernas e pode falhar com `BATERIA_INSUFICIENTE`.
  - `caminho` reflete as zonas atuais e `viagem.distanciaQuadras` as do planejamento — no mesmo payload podem discordar.
  - O JS embutido em `dashboard/pagina.ts` nunca é executado por teste: a cobertura de 100% mede só a string produzida.
  - Memo do `MapaCidade` cresce sem limite: uma entrada por origem consultada, cada uma de até `(cidadeTamanho+1)²` células (E8-2).
  - Evento `carga_iniciada` carrega o instante em que o carregamento **termina** — nome e timestamp discordam.
  - Drone é atualizado pelo snapshot do evento, não recalculado — quebra se algo além da linha do tempo mexer nele.
  - Guarda de `empacotar` sem teste, por decisão: fica descoberta de propósito — não reexportar a função.
  - Não há como reiniciar o relógio sem realocar; alocar no meio de uma rodada zera o instante corrente (D33).
  - Falha entre gravar pedidos e gravar viagens deixa pedido `alocado` sem viagem; a reconciliação do boot não cobre esse caso (D26).
  - Nenhuma rota de listagem tem paginação; `GET /simulacao/eventos` é a de maior volume (E8-2).

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
- Distância é consulta ao `MapaCidade`, não fórmula: contorna as zonas por BFS memoizado por origem, custo O(origens × células) e nunca por par (D36).
- Zonas são retângulos inclusivos vindos da config (`ZONAS_EXCLUSAO`), derivadas e nunca persistidas — mesma lógica da frota (D37).
- Sem zonas, `distancia` devolve Manhattan por atalho explícito: o caminho de código sem obstáculo é o do bloco 5.
- `distancia` devolve `null` para "sem caminho", e o `null` tem dois destinos: em `separarInviaveis` vira `naoAlocados`; depois dela é `ROTA_IMPOSSIVEL` e falha alto.
- A assimetria acima vale porque dois pontos alcançáveis da base estão na mesma componente conexa — logo alcançáveis entre si.
- Destino em zona (`DESTINO_BLOQUEADO`) ou cercado (`SEM_ROTA`) é reportado na alocação, nunca rejeitado no cadastro (D38).
- Base dentro de zona é config incoerente: o boot falha, como no invariante de alcançabilidade.
- `distancia` e `caminho` passam pelo mesmo `campoDistanciasDe(origem)` — é o que impede os dois divergirem quanto ao desvio.
- Caminho canônico entre dois pontos: backtracking sobre esse campo, desempatando por menor `x` e depois menor `y` — o mesmo critério de D12 (D39).
- Caminho é derivado do mapa e nunca persistido; só entra na resposta quando pedido por `?caminho=true` (D40).
- Zonas são expostas por `GET /mapa` somente para leitura: continuam vindo do `.env` e não são editáveis por API.
- Rastreio ao cliente usa a distância real do mapa, não Manhattan reta — é a única métrica do sistema depois de D36 (D42).
- Rastreio degrada em vez de falhar: sem drone localizável ou sem rota, responde 200 com mensagem sem distância.
- Drone mais eficiente = entregas concluídas ÷ distância percorrida; empate por menor `droneId`; sem viagens, `null` (D19).
- A distância total da simulação é acumulada das pernas percorridas, não lida de `viagem.distanciaQuadras` — imuniza contra arquivo gravado antes das zonas.
- Bateria e alcance são o mesmo recurso: bateria cheia equivale ao alcance total.
- Status do pedido (`pendente → alocado → em_voo → entregue`, mais `cancelado`) é distinto da máquina de estados do drone.
- Transições do drone vêm de uma tabela única em `drone.ts`; par fora dela — inclusive o mesmo estado — é erro, não no-op.
- Transição e efeito físico são separados: `transitar` só muda estado, `moverPara` só muda posição e bateria.
- A simulação é event-driven em tempo simulado: proibido `sleep`, `Date.now`, `Math.random` (D13).
- Tempo = `distância ÷ velocidade` mais tempos fixos de carregar e de entregar por pedido (D14).
- Recarga tem duração proporcional à bateria consumida e entra no makespan (D34).
- Drones diferentes voam em paralelo; o mesmo drone executa suas viagens em série. Makespan = maior instante final.
- Vários pedidos no mesmo destino são uma parada física com várias entregas, nunca várias chegadas.
- A linha do tempo nunca é persistida: é recomputada das viagens a cada boot e a cada alocação (D31).
- O relógio só avança para frente; instante retroativo é `AVANCO_INVALIDO`, não no-op (D32).
- Avançar aplica o estado de verdade — pedidos e viagens são persistidos; não é projeção de leitura (D32).
- Avançar grava em lote: `emLote` adia só a escrita, nunca a mutação em memória, e faz o flush no `finally` (D43).
- Viagem apontando para drone ausente da frota é `VIAGEM_INCONSISTENTE` (500): depois de D27 é bug, não entrada válida (D44).
- Alocar recomputa a linha do tempo das viagens não concluídas e zera o relógio (D33).
- Viagem `concluida` é ignorada pelo motor — é o que impede reexecutar entrega já feita (D35).
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
