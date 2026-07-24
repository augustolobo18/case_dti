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
