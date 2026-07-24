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

**Prioridade:** desenvolvimento em ordem de valor/dependência (E1 → E2 → E3 → …).

**Legenda de status:** 🔲 a fazer · 🚧 em progresso · ✅ concluído

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
