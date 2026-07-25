# 📋 Backlog — DroneDelivery

Backlog do simulador de entregas por drone, organizado em épicos e user stories.
As histórias seguem o formato `Como <persona>, quero <ação>, para <benefício>`,
com critérios de aceite verificáveis.

## Personas

| Persona | Descrição |
| ------- | --------- |
| 🧑‍💼 Operador | Operador de logística: cadastra pedidos, dispara e acompanha as entregas. |
| 📦 Cliente | Dono do pacote: quer saber o status da entrega. |
| ⚙️ Sistema | Regras automáticas (alocação, simulação); usado em histórias técnicas. |

## Épicos

| # | Épico | Sobre |
| -- | ----- | ----- |
| E1 | Gestão de Pedidos | Criar, validar e listar pedidos. |
| E2 | Frota de Drones | Cadastro, capacidade/alcance, status. |
| E3 | Alocação & Otimização | Agrupar pacotes em viagens minimizando o nº de viagens (coração do case). |
| E4 | Simulação & Estados | Máquina de estados do drone, tempo de voo, bateria/recarga. |
| E5 | Restrições Espaciais | Distância e zonas de exclusão aérea (obstáculos). |
| E6 | Relatórios & Dashboard | Métricas, mapa e feedback ao cliente. |
| E7 | API REST & Erros | Endpoints, validações e mensagens de erro claras. |
| E8 | Qualidade | Testes unitários e simulação de carga. |

**Legenda de status:** 🔲 a fazer · 🚧 em progresso · ✅ concluído

## Escopo & Roadmap

Escopo **completo** comprometido no MVP (núcleo + todos os diferenciais). A prioridade
é a **ordem de implementação**, seguindo dependências:

| Ordem | Bloco | Histórias |
| ----- | ----- | --------- |
| 1 | Domínio base | `Coordenada` + distância Manhattan (E5-1), `Pedido`, `Drone` |
| 2 | Pedidos | E1-1, E1-2, E1-3 (+ persistência JSON) |
| 3 | Frota | E2-1, E2-2 |
| 4 | Alocação (núcleo do case) | E3-1, E3-2, E3-3 |
| 5 | Simulação & estados | E4-1, E4-2, E4-3 |
| 6 | Zonas de exclusão | E5-2 (pathfinding) |
| 7 | Dashboard & feedback | E6-1, E6-2 |
| — | Transversais (ao longo de tudo) | E7-1 erros, E7-2 README, E8-1 testes |
| 8 | Fechamento | E8-2 simulação de carga |

---

## E1 — Gestão de Pedidos

### E1-1 — Cadastrar pedido 🔲

> **Como** Operador, **quero** cadastrar um pedido informando localização `(x, y)`,
> peso e prioridade, **para** que ele entre na fila de alocação das entregas.

**Critérios de aceite:**
- Pedido tem: `id` (gerado, único), `x`, `y`, `peso` (kg), `prioridade` (`baixa`|`média`|`alta`).
- Cadastro válido registra o pedido e retorna seu `id`.
- Coordenadas fora da malha `0..N` (tamanho configurável da cidade) são rejeitadas.
- Peso `<= 0` ou maior que a capacidade do drone é rejeitado no cadastro, com mensagem clara.
- Prioridade fora do conjunto permitido é rejeitada.
- Pedidos são persistidos em arquivo JSON (sobrevive a reinício).

**Nota de modelagem:** o pedido tem status próprio `pendente → alocado → em voo → entregue`,
derivado do estado do drone que o carrega. A máquina de estados completa do drone
(`Idle → Carregando → Em voo → Entregando → Retornando → Idle`) pertence ao épico E4.

### E1-2 — Consultar pedidos e sua situação 🔲

> **Como** Operador, **quero** consultar os pedidos cadastrados e sua situação,
> **para** acompanhar o que ainda falta entregar.

**Critérios de aceite:**
- Todo pedido tem status `pendente` → `alocado` → `em voo` → `entregue`.
- Listar todos os pedidos cadastrados.
- Filtrar a listagem por status.
- Filtrar a listagem por prioridade.
- Buscar um pedido específico por `id`; id inexistente retorna erro claro.

### E1-3 — Cancelar pedido 🔲

> **Como** Operador, **quero** cancelar um pedido que ainda não saiu para entrega,
> **para** corrigir enganos ou desistências antes da alocação.

**Critérios de aceite:**
- Cancelar é permitido apenas enquanto o pedido está `pendente`.
- Cancelar pedido já `alocado`, `em voo` ou `entregue` é bloqueado, com mensagem clara.
- Cancelar `id` inexistente retorna erro claro.
- Pedido cancelado deixa de aparecer nas listagens de pendentes e não é alocado.

---

## E2 — Frota de Drones

### E2-1 — Frota configurável na inicialização 🔲

> **Como** Operador, **quero** ter uma frota de drones com capacidade e alcance
> definidos, **para** que o sistema tenha veículos disponíveis para as entregas.

**Critérios de aceite:**
- A frota é homogênea: todos os drones compartilham a mesma capacidade (X kg) e alcance (Y km).
- Capacidade, alcance e quantidade de drones vêm da config (`.env`), com valores padrão.
- A frota é criada ao iniciar o sistema; cada drone recebe um `id` único e começa `Idle`.
- Não há endpoint de cadastro de drone nesta fase (frota fixa; muda-se via `.env` + reinício).

### E2-2 — Consultar status da frota 🔲

> **Como** Operador, **quero** consultar o status de cada drone da frota, **para**
> saber quais estão disponíveis e o que cada um está fazendo.

**Critérios de aceite:**
- Listar todos os drones com: `id`, `estado`, `posição (x, y)`, `carga atual`/`capacidade`, `bateria`.
- Drone `Idle` aparece na base, sem carga, bateria cheia.
- Também é possível consultar um drone específico por `id`.

**Nota:** `posição` e `carga` passam a variar com a alocação/simulação (E3/E4);
`bateria` só é consumida de fato no E4 — até lá permanece em 100% (placeholder).

---

## E3 — Alocação & Otimização

### E3-1 — Alocar pedidos em viagens (greedy) 🔲

> **Como** Sistema, **quero** agrupar os pedidos pendentes em viagens de drone
> respeitando capacidade e alcance, **para** entregar tudo com o menor número de
> viagens possível.

**Critérios de aceite:**
- Aloca apenas pedidos `pendente`; cada viagem respeita a capacidade (X kg) do drone.
- A distância da viagem (base → entregas → base) não pode exceder o alcance (Y km).
- Heurística greedy: ordena os pedidos e encaixa cada um na viagem enquanto couber (ver D9).
- Objetivo: minimizar o número de viagens geradas.
- Pedidos alocados passam a `alocado` e ficam vinculados a uma viagem/drone.
- Pedido que não cabe em nenhuma viagem viável é reportado claramente (não some silenciosamente).

### E3-2 — Priorizar pedidos na alocação 🔲

> **Como** Sistema, **quero** priorizar quais pedidos entram primeiro nas viagens,
> com base em prioridade, peso e distância, **para** que as entregas mais importantes
> saiam antes e o uso do drone seja maximizado.

**Critérios de aceite:**
- Ordena os pedidos por: prioridade (alta > média > baixa) → distância (mais perto primeiro) → peso (ver D11).
- Pedidos de prioridade `alta` nunca ficam atrás de `média`/`baixa` que caibam na mesma viagem.
- O critério de desempate é determinístico (mesma entrada → mesma ordem).

### E3-3 — Consultar viagens/rotas calculadas 🔲

> **Como** Operador, **quero** consultar as viagens/rotas calculadas, **para** ver
> como os pacotes foram distribuídos entre os drones e o trajeto de cada viagem.

**Critérios de aceite:**
- Endpoint `GET /entregas/rota` lista as viagens geradas.
- Dentro de cada viagem, a ordem das entregas usa vizinho mais próximo (nearest-neighbor, ver D12).
- Por viagem retorna: drone responsável e pedidos (ids); sequência de paradas (base → pontos → base); distância total e carga total.
- Sem viagens calculadas, retorna lista vazia (não erro).

---

## E4 — Simulação & Estados

> Épico de diferencial — detalhamento mais leve; pontos imaturos marcados como "a refinar".

### E4-1 — Máquina de estados do drone 🔲

> **Como** Sistema, **quero** simular a execução de uma viagem fazendo o drone percorrer
> os estados `Idle → Carregando → Em voo → Entregando → Retornando → Idle`, **para**
> refletir de forma realista o ciclo de uma entrega.

**Critérios de aceite:**
- O drone transita pelos estados na ordem definida; transições inválidas são impedidas.
- A simulação é orientada a eventos, em tempo simulado (sem sleep real, ver D13).
- Ao alocar as viagens (E3), a simulação dispara automaticamente para os drones envolvidos.
- Ao concluir a viagem, o drone volta a `Idle` e os pedidos da viagem passam a `entregue`.
- _A refinar na implementação:_ durações de cada estado e granularidade dos eventos.

### E4-2 — Tempo de entrega 🔲

> **Como** Operador, **quero** saber o tempo de cada entrega e o tempo total da operação,
> **para** avaliar a eficiência do sistema.

**Critérios de aceite:**
- Tempo de voo = distância ÷ velocidade (config), somado a tempos fixos de carregar e entregar (ver D14).
- Calcula o tempo por entrega (por pedido), o tempo total da operação (makespan) e o tempo médio por entrega.
- As métricas ficam disponíveis para o dashboard/relatório (E6).
- _A refinar na implementação:_ velocidade e tempos fixos padrão; tratamento de viagens paralelas entre drones.

### E4-3 — Bateria e recarga automática 🔲

> **Como** Sistema, **quero** simular a bateria do drone, consumindo-a ao operar e
> recarregando na base, **para** que os drones voltem a carregar quando a bateria fica baixa.

**Critérios de aceite:**
- Bateria e alcance são o mesmo recurso: bateria cheia equivale a Y km (ver D15).
- A bateria é consumida proporcionalmente à distância percorrida na viagem.
- Ao retornar à base (`Idle`), o drone recarrega antes de assumir a próxima viagem.
- O status do drone (E2-2) reflete o nível de bateria corrente.
- _A refinar na implementação:_ recarga instantânea vs. por tempo; nível considerado "baixo".

---

## E5 — Restrições Espaciais

> Épico de diferencial — detalhamento mais leve; pontos imaturos marcados como "a refinar".

### E5-1 — Métrica de distância na malha 🔲

> **Como** Sistema, **quero** medir a distância entre dois pontos da malha de forma consistente,
> **para** que alcance, roteamento e tempo usem a mesma métrica.

**Critérios de aceite:**
- Distância entre dois pontos usa a métrica Manhattan `|dx| + |dy|` (ver D16).
- A mesma métrica alimenta a checagem de alcance (D10), o roteamento (D12) e o tempo (D14).
- Base como referência para "N quadras de distância" (feedback ao cliente, E6).

### E5-2 — Zonas de exclusão aérea 🔲

> **Como** Operador, **quero** definir zonas de exclusão aérea na malha, **para** que os
> drones não atravessem áreas proibidas ao entregar.

**Critérios de aceite:**
- Zonas de exclusão são definidas via config e representam células bloqueadas da malha.
- O trajeto contorna as zonas via pathfinding na grade (BFS/A* Manhattan), aumentando a distância (ver D17).
- A distância que desvia é a usada nas checagens de alcance/bateria e tempo.
- Cliente inalcançável (totalmente cercado por zonas) é reportado claramente, sem quebrar a alocação.
- _A refinar na implementação:_ algoritmo exato (BFS vs A*), formato de declaração das zonas na config.

---

## E6 — Relatórios & Dashboard

> Épico de diferencial — detalhamento mais leve; pontos imaturos marcados como "a refinar".

### E6-1 — Dashboard de métricas 🔲

> **Como** Operador, **quero** um dashboard/relatório com as métricas da operação, **para**
> avaliar os resultados das entregas de forma visual.

**Critérios de aceite:**
- Dashboard entregue como página web simples servida pelo backend (ver D18).
- Exibe: quantidade de entregas realizadas, tempo médio por entrega, drone mais eficiente e um mapa das entregas.
- "Drone mais eficiente" = entregas concluídas ÷ distância total percorrida (ver D19).
- O mapa mostra base, clientes, zonas de exclusão (E5) e, idealmente, as rotas.
- _A refinar na implementação:_ visual do mapa (grade HTML/SVG vs ASCII embutido), atualização estática vs. viva.

### E6-2 — Feedback ao cliente 🔲

> **Como** Cliente, **quero** consultar o status do meu pacote em linguagem amigável, **para**
> saber quando ele está chegando (ex.: "seu pacote está a 2 quadras").

**Critérios de aceite:**
- Consulta por `id` do pedido retorna uma mensagem amigável conforme o status.
- Quando `em voo`, a mensagem inclui a distância atual do drone ao cliente em quadras (métrica Manhattan, D16).
- Status `entregue` e `pendente`/`alocado` têm mensagens próprias e claras.
- `id` inexistente retorna erro claro.
- _A refinar na implementação:_ texto exato das mensagens; faixas (ex.: "chegando" quando ≤ 1 quadra).

---

## E7 — API REST & Erros

### E7-1 — Tratamento de erros consistente 🔲

> **Como** Operador/Cliente, **quero** receber respostas de erro claras e consistentes, **para**
> entender o que deu errado e como corrigir.

**Critérios de aceite:**
- Erros retornam JSON padronizado `{ erro: { codigo, mensagem, detalhes? } }` (ver D20).
- Status HTTP adequado: 400 (validação de entrada), 404 (não encontrado), 422 (regra de negócio).
- Um middleware central de erro converte exceções de domínio/validação em respostas padronizadas.
- Erros de validação (Zod, D3) reportam o campo e o motivo de forma clara.
- Rotas inexistentes retornam 404 padronizado.

### E7-2 — Documentar endpoints no README 🔲

> **Como** Avaliador/Operador, **quero** uma referência clara dos endpoints, **para**
> entender e testar a API rapidamente.

**Critérios de aceite:**
- README traz uma tabela de endpoints: método, rota, descrição, corpo esperado e resposta.
- Inclui exemplos de requisição/resposta para os principais fluxos (cadastrar pedido, ver rota, status).
- Mantida em dia conforme os endpoints evoluem.

---

## E8 — Qualidade

### E8-1 — Testes unitários das regras 🔲

> **Como** Sistema, **quero** cobertura de testes unitários das regras principais, **para**
> garantir que a lógica de negócio funciona e não regride.

**Critérios de aceite:**
- Cobrem a fundo o domínio: distância (Manhattan), alocação greedy, capacidade/alcance, prioridade, estados do drone, bateria.
- Incluem casos de borda: peso no limite, viagem no limite do alcance, empates de prioridade, cliente inalcançável.
- Meta de cobertura ~80% no domínio (ver D21); rodável via `npm run coverage`.
- Testes determinísticos (tempo simulado, D13), sem dependência de relógio real.

### E8-2 — Simulação de carga 🔲

> **Como** Sistema, **quero** validar o comportamento com muitos pedidos de uma vez, **para**
> garantir que a alocação e a simulação se mantêm corretas e performáticas sob carga.

**Critérios de aceite:**
- **Correção sob volume:** com centenas/milhares de pedidos (gerados com seed controlável), nenhuma viagem excede capacidade/alcance e todo pedido viável é alocado.
- **Desempenho:** mede o tempo da alocação para volumes crescentes e verifica que fica dentro de um limite razoável.
- Resultados reprodutíveis (mesma seed → mesmo cenário).
