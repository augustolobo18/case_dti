# 🧭 Registro de Decisões (ADR)

Log das decisões de projeto e suas justificativas, para consulta e defesa posterior.
Cada decisão registra o **contexto**, a **escolha** e o **porquê** (incluindo alternativas descartadas).

> Formato leve inspirado em ADR (Architecture Decision Records).
> Status: ✅ vigente · 🔄 revisável · ⛔ substituída

---

## D1 — Stack: Node.js + TypeScript, API REST + Dashboard ✅

- **Contexto:** case permite Java, JS/Node, React, Angular ou C#/.NET.
- **Escolha:** Node.js + TypeScript (ESM), expondo API REST + um dashboard/relatório simples.
- **Porquê:** desenvolvimento rápido, tipagem estática para modelar o domínio, ótimo
  ecossistema de testes (Vitest) e facilidade de expor REST com Express. O case sugere
  explicitamente endpoints REST.
- **Alternativas descartadas:** Java/Spring e C#/.NET (mais cerimônia p/ o prazo);
  front puro em React (menos foco na lógica de domínio, que é o mais avaliado).

## D2 — Testes com Vitest; Node >= 20.12 ✅

- **Contexto:** precisamos de testes unitários das regras (obrigatório no case).
- **Escolha:** Vitest 4 (cobertura v8); runtime Node 24 LTS (mínimo 20.12).
- **Porquê:** Vitest é leve, rápido e integra nativamente com TS/ESM. Vitest 4 exige
  Node >= 20.12 (usa `styleText` do `node:util`), então padronizamos o Node 24 LTS.
- **Alternativas descartadas:** Jest (mais configuração para ESM/TS).

## D3 — Validação com Zod nas bordas da API ✅

- **Contexto:** o case pede rejeitar entradas inválidas com mensagens claras.
- **Escolha:** validar payloads com Zod na camada de API, mantendo o domínio agnóstico ao HTTP.
- **Porquê:** validação declarativa e mensagens de erro consistentes, sem acoplar a regra
  de validação ao framework web; o domínio continua testável isoladamente.

## D4 — Malha 2D limitada (0..N) ✅

- **Contexto:** a cidade é uma malha de coordenadas; pedidos têm posição `(x, y)`.
- **Escolha:** malha com tamanho fixo configurável; coordenadas fora de `0..N` são rejeitadas.
- **Porquê:** mais realista (a cidade tem limites) e gera validação de fronteira testável.
- **Alternativas descartadas:** coordenadas ilimitadas / negativas (menos validação, menos realismo).

## D5 — Rejeitar peso inválido já no cadastro ✅

- **Contexto:** requisito do case — rejeitar pacotes que ultrapassem a capacidade.
- **Escolha:** no cadastro do pedido, recusar peso `<= 0` ou maior que a capacidade do drone.
- **Porquê:** falha cedo, com mensagem clara, evitando pedidos impossíveis na fila de alocação.
- **Alternativas descartadas:** aceitar e só falhar na alocação (feedback mais tardio ao operador).

## D6 — Persistência de pedidos em arquivo JSON ✅

- **Contexto:** os pedidos precisam sobreviver a reinícios para acompanhar entregas.
- **Escolha:** repositório de pedidos persistido em arquivo JSON local.
- **Porquê:** simples, sem dependência de banco, e sobrevive a reinício — suficiente p/ um simulador.
- **Alternativas descartadas:** só memória (perde tudo ao reiniciar); banco de dados (excesso p/ o escopo).

## D7 — Status do pedido separado da máquina de estados do drone ✅

- **Contexto:** o case descreve `Idle → Carregando → Em voo → Entregando → Retornando → Idle`.
- **Escolha:** essa máquina de estados pertence ao **drone**; o **pedido** tem status próprio
  `pendente → alocado → em voo → entregue`, derivado do estado do drone que o carrega.
- **Porquê:** um pacote nunca fica "Idle" ou "Retornando"; separar os ciclos de vida evita
  modelagem confusa e mantém cada estado com significado.

## D8 — Frota homogênea, fixa via config na inicialização ✅

- **Contexto:** o sistema precisa de drones para alocar as entregas.
- **Escolha:** frota homogênea (mesma capacidade X e alcance Y); quantidade e limites vêm
  do `.env` e a frota é instanciada ao subir o sistema (sem endpoint de cadastro).
- **Porquê:** suficiente para o desafio de minimizar viagens, com menos superfície de API/validação.
- **Alternativas descartadas:** frota heterogênea (mais rica, mais complexa); cadastro via API
  (flexível, porém desnecessário p/ um simulador); drone único (reduz o desafio de distribuir carga).

## D9 — Alocação por heurística greedy, sem melhoria local ✅

- **Contexto:** objetivo central do case — alocar pacotes com o menor nº de viagens.
- **Escolha:** heurística **greedy** — ordenar pedidos por prioridade/peso/distância e encaixar
  cada pacote na viagem enquanto couber (capacidade + alcance), sem passo de melhoria posterior.
- **Nota de nomenclatura:** greedy é um *tipo* de heurística, não uma estratégia à parte.
- **Porquê:** bom custo/benefício — rápida, previsível e fácil de testar, incluindo cargas altas;
  o bin-packing exato é NP-difícil e escala mal com muitos pedidos.
- **Alternativas descartadas:** otimização exata (custosa); greedy + melhoria local (fica como
  evolução possível se sobrar tempo).

## D10 — Distância da viagem: base → entregas → base ✅

- **Contexto:** cada viagem deve caber no alcance Y km (por carga).
- **Escolha:** medir o percurso completo da viagem (base → visita aos clientes → volta à base)
  contra o alcance Y.
- **Porquê:** modelo realista de rota fechada; força considerar a ordem das paradas.
- **Alternativas descartadas:** aproximar por 2× o cliente mais distante (impreciso);
  uma entrega por viagem (simples, mas gasta viagens demais).

## D11 — Ordenação da alocação: prioridade > distância > peso ✅

- **Contexto:** o case pede priorizar entregas por prioridade, peso e distância.
- **Escolha:** ordenar os pedidos por prioridade (alta > média > baixa); empate por
  distância (mais perto primeiro); empate remanescente por peso.
- **Porquê:** prioridade é soberana (atende o requisito de negócio); distância antes de peso
  favorece entregas rápidas e reduz o percurso por viagem. Critério determinístico e fácil de explicar.
- **Alternativas descartadas:** prioridade > peso > distância; score ponderado configurável
  (mais flexível, porém menos óbvio de justificar).

## D12 — Roteamento dentro da viagem: vizinho mais próximo ✅

- **Contexto:** definida a composição de uma viagem (D9/D11), falta a ordem de visita aos clientes.
- **Escolha:** heurística do vizinho mais próximo (nearest-neighbor) — partindo da base, ir sempre
  ao cliente não visitado mais próximo e retornar à base ao fim.
- **Porquê:** distância é ortogonal à prioridade — todos os pacotes da viagem serão entregues no
  mesmo voo, então otimizar o trajeto (não a prioridade) é o que importa no roteamento. Barato e simples.
- **Alternativas descartadas:** ordem por prioridade (entrega o "alta" mais cedo, mas alonga o trajeto —
  relevante só se o tempo por entrega pesar, o que fica para o E4); ordem de inserção (não otimiza nada).

## D13 — Simulação orientada a eventos, em tempo simulado ✅

- **Contexto:** o case sugere simulação orientada a eventos com drones mudando de estado;
  precisa gerenciar tempo de voo.
- **Escolha:** simulação event-driven em **tempo simulado** (timestamps/relógio virtual), sem
  `sleep`/threads reais; disparada automaticamente após a alocação (E3).
- **Porquê:** determinística, rápida e fácil de testar — condição essencial para cobertura das
  regras e simulações de carga. Evita a fragilidade de delays reais.
- **Alternativas descartadas:** tempo real com sleep/threads (não determinístico, ruim p/ testes);
  tick manual via endpoint (controlável, mas exige acionar cada passo).

## D14 — Tempo = distância ÷ velocidade + tempos fixos ✅

- **Contexto:** o case pede calcular o tempo total de entrega; o tempo é simulado.
- **Escolha:** tempo de voo = distância ÷ velocidade (config); somados tempos fixos de carregar
  e de entregar por parada. Métricas: por entrega, total (makespan) e média.
- **Porquê:** fórmula simples, determinística e fácil de justificar; separa deslocamento de
  overheads operacionais sem exigir um modelo físico complexo.
- **Alternativas descartadas:** só distância ÷ velocidade (ignora carga/entrega, menos realista).

## D15 — Bateria = alcance (consome por distância, recarrega na base) ✅

- **Contexto:** o case pede simular bateria (por tempo ou distância) e recarga automática na base;
  o alcance Y km por carga já limita a viagem (D10).
- **Escolha:** tratar bateria e alcance como o **mesmo recurso** — bateria cheia = Y km; consumo
  proporcional à distância; ao voltar à base (Idle), o drone recarrega antes da próxima viagem.
- **Porquê:** evita dois conceitos redundantes para a mesma restrição física; mantém coerência
  direta com a alocação (D10) e simplifica a modelagem.
- **Alternativas descartadas:** bateria como recurso separado que persiste entre viagens (mais rico,
  mais complexo); consumo por tempo (casa menos com o alcance).

## D16 — Distância Manhattan na malha ✅

- **Contexto:** a cidade é uma malha de coordenadas; o case usa a metáfora de "quadras".
- **Escolha:** distância Manhattan `|dx| + |dy|` como métrica única (alcance, roteamento, tempo).
- **Porquê:** casa com a ideia de deslocamento por quadras em grade e com o feedback "a N quadras";
  uma métrica única mantém coerência entre alocação, rota e tempo.
- **Alternativas descartadas:** euclidiana (mais realista para voo direto, mas destoa da metáfora de quadras).

## D17 — Zonas de exclusão como células bloqueadas; rota desvia (pathfinding) ✅

- **Contexto:** o case pede inserir obstáculos / zonas de exclusão aérea entre pontos.
- **Escolha:** zonas são células bloqueadas da malha (definidas via config); o trajeto as contorna
  via pathfinding na grade (BFS/A* com movimento Manhattan), e a distância do desvio alimenta
  as checagens de alcance/bateria e tempo.
- **Porquê:** modelo mais completo e realista que apenas recusar entregas; aproveita a malha em
  grade e a métrica Manhattan (D16). Custa mais código, mas é um diferencial de peso.
- **Alternativas descartadas:** invalidar entregas dentro/atravessadas por zonas (sem pathfinding,
  bem mais simples, porém menos realista); definição de zonas via API (mais flexível, mais superfície).

## D18 — Dashboard como página web simples ✅

- **Contexto:** o case pede uma visualização simples (dashboard) com métricas e mapa.
- **Escolha:** servir uma página web simples pelo backend, com as métricas e o mapa das entregas.
- **Porquê:** mais visual e demonstrável no case do que só JSON/ASCII; reforça a decisão D1 de
  entregar API REST + dashboard.
- **Alternativas descartadas:** endpoint JSON + mapa ASCII (sem front, mais simples, menos impacto visual).

## D19 — "Drone mais eficiente" = entregas ÷ distância ✅

- **Contexto:** o case pede destacar o drone mais eficiente no relatório.
- **Escolha:** eficiência = entregas concluídas ÷ distância total percorrida pelo drone.
- **Porquê:** premia quem entrega mais gastando menos rota — mede eficiência real, não só volume.
- **Alternativas descartadas:** só total de entregas (ignora o custo de deslocamento).

## D20 — Erros: JSON padronizado + middleware central ✅

- **Contexto:** o case pede mensagens claras para entradas inválidas e boas validações.
- **Escolha:** respostas de erro em JSON padronizado `{ erro: { codigo, mensagem, detalhes? } }`,
  com status HTTP adequado (400/404/422), produzidas por um middleware de erro central no Express.
- **Porquê:** consistência e previsibilidade para o consumidor da API; o middleware central evita
  repetição (DRY) e mantém as rotas como cascas finas (coerente com D3 e a separação domínio/API).
- **Alternativas descartadas:** `{ erro: 'mensagem' }` simples (menos estruturado); tratar erro em
  cada rota (repetitivo).

## D21 — Testes: domínio a fundo, meta ~80% de cobertura ✅

- **Contexto:** o case exige testes unitários das regras principais (entregável obrigatório).
- **Escolha:** focar a cobertura no domínio (distância, alocação, capacidade/alcance, prioridade,
  estados, bateria), com meta de ~80% de cobertura, incluindo casos de borda.
- **Porquê:** concentra o esforço onde está a lógica de negócio e o valor avaliado; a meta dá um
  alvo objetivo sem perseguir 100% (que traria testes de baixo retorno na camada de API/infra).
- **Alternativas descartadas:** testar regras sem meta numérica (menos garantia objetiva).
