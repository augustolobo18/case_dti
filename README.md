# 🚁 DroneDelivery — Simulador de Encomendas por Drone

Simulador de um sistema de logística de entregas por drones em áreas urbanas.
O sistema recebe pedidos, aloca pacotes nos drones respeitando regras de
capacidade, alcance e prioridade, e simula os voos até a entrega — buscando
sempre o **menor número de viagens possível**.

> Projeto desenvolvido como desafio técnico de processo seletivo.

---

## 📋 Sobre o projeto

A cidade é modelada como uma **malha de coordenadas 2D**. Drones partem de uma
base (origem), carregam um ou mais pacotes, voam até os clientes, entregam e
retornam. Cada drone tem limites físicos que precisam ser respeitados a cada
viagem.

### Regras básicas

- **Capacidade:** cada drone suporta até `X` kg por carga.
- **Alcance:** cada drone percorre até `Y` quadras por carga (ida + entregas + volta).
- **Pedidos:** cada pedido possui:
  - Localização do cliente `(x, y)`
  - Peso do pacote (kg)
  - Prioridade da entrega: `baixa` | `média` | `alta`

### Objetivo principal

Alocar os pacotes nos drones minimizando o número de viagens, respeitando
capacidade, alcance e priorizando entregas conforme a prioridade.

---

## 🧭 Escopo

### Núcleo (foco inicial)

- [ ] Modelagem de domínio: `Pedido`, `Drone`, `Viagem`, `Coordenada`
- [ ] Recebimento e validação de pedidos
- [ ] Algoritmo de alocação de pacotes por viagem (capacidade + alcance)
- [ ] Otimização por prioridade, peso e distância
- [ ] API REST (`POST /pedidos`, `GET /entregas/rota`, `GET /drones/status`)
- [ ] Testes unitários das regras principais

### Diferenciais (avaliados por feature)

- [x] Máquina de estados do drone: `idle → carregando → em_voo → entregando → retornando → idle`
- [x] Simulação de bateria (consumo por distância) e recarga na base
- [x] Zonas de exclusão aérea (obstáculos entre pontos)
- [x] Cálculo de tempo total de entrega
- [ ] Fila de entrega (prioridade + tempo de chegada)
- [x] Dashboard / relatório: entregas realizadas, tempo médio, drone mais eficiente, mapa
- [x] Feedback do cliente ("seu pacote está a N quadras")

> Os itens são priorizados conforme o tempo disponível; o núcleo é entregue
> primeiro e de forma sólida.

---

## 🛠️ Stack

- **Linguagem:** TypeScript (ESM)
- **Runtime:** Node.js `>= 20.12` (desenvolvido no Node 24 LTS)
- **API:** REST com Express
- **Validação:** Zod (nas bordas da API)
- **Testes:** Vitest (com cobertura v8)
- **Dashboard:** visualização simples (web ou ASCII)

---

## 🚀 Como executar

Pré-requisito: **Node.js >= 20.12**.

```bash
# instalar dependências
npm install

# rodar em desenvolvimento (hot reload)
npm run dev

# rodar os testes
npm test

# cobertura de testes
npm run coverage

# checagem de tipos (sem emitir)
npm run typecheck

# lint (ESLint) e correção automática
npm run lint
npm run lint:fix

# formatação (Prettier) e apenas verificação
npm run format
npm run format:check

# build de produção e execução
npm run build
npm start
```

Variáveis de ambiente (opcionais) em `.env.example` — capacidade/alcance do drone,
porta e coordenada da base. Copie para `.env` para sobrescrever os padrões.

Health-check: `GET http://localhost:3000/health`.

A cada push e pull request, o CI (GitHub Actions) roda `typecheck`, `lint`,
`format:check`, `test` e `build`, nessa ordem.

---

## 📡 API

### Implementados (E1 — Gestão de Pedidos)

| Método | Rota                    | Descrição                              | Corpo                                          | Resposta                        |
| ------ | ----------------------- | --------------------------------------- | ----------------------------------------------- | -------------------------------- |
| POST   | `/pedidos`              | Cadastra um novo pedido                 | `{ x, y, pesoKg, prioridade }`                  | `201` com o pedido criado         |
| GET    | `/pedidos`              | Lista pedidos, com filtros opcionais    | —                                                | `200` com array (vazio se nenhum) |
| GET    | `/pedidos/:id`          | Busca um pedido por `id`                | —                                                | `200` com o pedido; `404` se ausente |
| POST   | `/pedidos/:id/cancelar` | Cancela um pedido ainda `pendente`      | —                                                | `200` com o pedido `cancelado`    |

`GET /pedidos` aceita `?status=` (`pendente` \| `alocado` \| `em_voo` \| `entregue` \| `cancelado`)
e `?prioridade=` (`baixa` \| `media` \| `alta`), combináveis.

### Implementados (E2 — Frota)

| Método | Rota          | Descrição                        | Corpo | Resposta                             |
| ------ | ------------- | --------------------------------- | ----- | -------------------------------------- |
| GET    | `/drones`     | Lista o status de todos os drones | —     | `200` com array (um item por drone)    |
| GET    | `/drones/:id` | Busca um drone por `id`           | —     | `200` com o drone; `404` se ausente    |

> **Nota:** a rota planejada `GET /drones/status` foi substituída por `GET /drones` +
> `GET /drones/:id` — `status` não é um recurso e colidiria com `:id` no roteamento REST.

A frota é homogênea e fixa via `.env` (D8): não há endpoint de cadastro/edição de drone —
mudar a quantidade exige reiniciar o servidor. Ids são sequenciais e determinísticos
(`drone-1`…`drone-N`), estáveis entre reinícios.

### Implementados (E3 — Alocação & Otimização)

| Método | Rota                     | Descrição                                          | Corpo | Resposta                                    |
| ------ | ------------------------ | --------------------------------------------------- | ----- | -------------------------------------------- |
| POST   | `/entregas/alocar`       | Aloca os pedidos `pendente` em viagens (greedy)      | —     | `201` com `{ viagens, naoAlocados }`         |
| GET    | `/entregas/rota`         | Lista as viagens já calculadas                       | —     | `200` com array (vazio se nenhuma alocação)  |
| GET    | `/entregas/rota?caminho=true` | Idem, com o caminho (células) de cada perna, contornando zonas | — | `200` com array; `caminho` só aparece com o parâmetro (E6-4) |
| DELETE | `/entregas/concluidas`   | Remove as viagens já `concluida`                     | —     | `200` com `{ removidas }`                    |

`POST /entregas/alocar` ordena os pedidos pendentes por prioridade → distância → peso (D11),
empacota em viagens por heurística greedy respeitando capacidade e alcance (D9), roteia cada
viagem por vizinho mais próximo (D12) e distribui entre os drones da frota em round-robin (D28).
Pedidos alocados passam a `alocado`; pedido inviável (fora do alcance ou peso acima da
capacidade) sai em `naoAlocados`, com `pedidoId`, `motivo` e `mensagem`, e continua `pendente`.
As viagens são persistidas (D26) e sobrevivem a reinício. Toda viagem nasce `planejada`
(`status`) e, depois de alocar, a linha do tempo da simulação (E4) é recomputada automaticamente
e o relógio volta a 0 (D13/D33). `GET /entregas/rota` aceita `?status=` (`planejada` \|
`em_execucao` \| `concluida`); `DELETE /entregas/concluidas` limpa as viagens já entregues, para
que uma nova alocação não acumule indefinidamente (fecha a dívida do bloco 4).

### Implementados (E4 — Simulação & Estados)

| Método | Rota                 | Descrição                                                  | Corpo                                    | Resposta                              |
| ------ | -------------------- | ------------------------------------------------------------ | ----------------------------------------- | ---------------------------------------- |
| GET    | `/simulacao`          | Instante corrente e métricas agregadas da simulação           | —                                          | `200` com `{ instanteAtual, metricas }`  |
| POST   | `/simulacao/avancar`  | Avança o relógio da simulação, aplicando os eventos até lá     | `{ ateInstante }` ou `{ minutos }`         | `200` com `{ instanteAtual, eventosAplicados }` |
| GET    | `/simulacao/eventos`  | Lista os eventos da linha do tempo, com recorte opcional       | —                                          | `200` com array (aceita `?desde=` e `?ate=`) |

O drone segue a máquina de estados `idle → carregando → em_voo → entregando → retornando → idle`
(E4-1); qualquer transição fora dessa tabela é um bug de domínio (`TRANSICAO_INVALIDA`). A
simulação é orientada a eventos, em **tempo simulado** (D13): a cada `POST /entregas/alocar`, a
linha do tempo inteira é recalculada de uma vez, de forma pura e determinística, e fica pronta
para ser avançada por comando explícito — nada acontece sozinho com o tempo real.

Cada evento tem um `instanteMin` (minutos desde o início da operação daquele drone) e carrega o
estado do drone naquele momento: `carga_iniciada` → `decolagem` → `chegada_parada` (por parada) →
`entrega_concluida` (por pedido) → `retorno_base` → `recarga_concluida`. O tempo de cada perna é
`distância ÷ velocidade` (D14); carregamento e entrega somam tempos fixos configuráveis; drones
diferentes voam em paralelo (cada um com seu próprio relógio começando em 0), e o mesmo drone
executa suas viagens em série.

A bateria é o mesmo recurso que o alcance (D15): decresce proporcionalmente à distância
percorrida e é restaurada na recarga, ao voltar à base — a recarga dura `distância consumida ×
recargaMinPorQuadra` minutos e entra no makespan da operação (D34).

`POST /simulacao/avancar` aplica, em ordem, todo evento com `instanteMin` até o alvo informado:
pedidos passam a `em_voo` na decolagem e a `entregue` na entrega; a viagem passa a `em_execucao`
na decolagem e a `concluida` na recarga; o drone (posição, carga, bateria, estado) é atualizado a
cada evento. O relógio só avança para frente — pedir um instante menor que o corrente é
`AVANCO_INVALIDO` (422); avançar duas vezes para o mesmo instante não reaplica eventos já
processados.

### Implementados (E5 — Restrições Espaciais)

A distância entre dois pontos da malha usa a métrica Manhattan `|dx| + |dy|` (E5-1/D16) — a
mesma que alimenta alcance, roteamento e tempo desde o Bloco 1. Nenhuma parte do sistema fala em
km: a unidade é sempre a **quadra**.

Zonas de exclusão aérea (E5-2/D17) são células bloqueadas da malha, declaradas via `ZONAS_EXCLUSAO`
no `.env` — retângulos inclusivos `"x1,y1:x2,y2"` separados por `;` (espaços tolerados; ver
`.env.example`). O trajeto contorna as zonas por pathfinding em grade (BFS memoizado por origem,
D36); a distância que desvia é a mesma usada nas checagens de alcance/bateria (D10/D15) e no
cálculo de tempo (D14). Não há endpoint de API para ler ou editar zonas nesta fase — mudar exige
reiniciar o servidor, como a frota (D8); zonas são derivadas da config, nunca persistidas (D37).

Destino dentro de uma zona ou sem caminho até a base entra em `naoAlocados` — `DESTINO_BLOQUEADO`
ou `SEM_ROTA`, respectivamente — sem abortar a rodada (D29/D38), com o mesmo formato de
`INALCANCAVEL`/`PESO_ACIMA_CAPACIDADE`. Sem `ZONAS_EXCLUSAO` configurada, o comportamento é
idêntico ao de antes do Bloco 6 — a distância volta a ser exatamente Manhattan.

**Exemplo: alocar com uma zona configurada, gerando desvio e um destino bloqueado**

```bash
# .env: ZONAS_EXCLUSAO=3,0:3,6
curl -X POST http://localhost:3000/pedidos \
  -H "Content-Type: application/json" \
  -d '{"x": 6, "y": 4, "pesoKg": 2, "prioridade": "alta"}'

curl -X POST http://localhost:3000/pedidos \
  -H "Content-Type: application/json" \
  -d '{"x": 3, "y": 3, "pesoKg": 1, "prioridade": "baixa"}'

curl -X POST http://localhost:3000/entregas/alocar
```

```json
{
  "viagens": [
    {
      "id": "b1e3c2b0-2e1a-4b1a-8b8a-8f8e8e8e8e8e",
      "droneId": "drone-1",
      "pedidoIds": ["5d3e2b1a-..."],
      "paradas": [
        { "x": 0, "y": 0 },
        { "x": 6, "y": 4 },
        { "x": 0, "y": 0 }
      ],
      "distanciaQuadras": 32,
      "cargaKg": 2,
      "status": "planejada",
      "totalParadas": 3,
      "totalPedidos": 1
    }
  ],
  "naoAlocados": [
    {
      "pedidoId": "1a2b3c4d-...",
      "motivo": "DESTINO_BLOQUEADO",
      "mensagem": "Pedido 1a2b3c4d-...: destino (3, 3) está dentro de uma zona de exclusão aérea."
    }
  ]
}
```

Sem a zona, a distância da viagem seria `2 × 10 = 20` quadras (Manhattan direto); com a parede em
`x=3, y=0..6` (numa malha `0..10`), o desvio pela borda livre (`y=7` a `y=10`) eleva o total para
`32` quadras.

### Implementados (E6 — Relatórios & Dashboard)

| Método | Rota                          | Descrição                                                    | Corpo | Resposta                                       |
| ------ | ----------------------------- | ------------------------------------------------------------- | ----- | ------------------------------------------------ |
| GET    | `/mapa`                       | Tamanho da malha, base e zonas de exclusão configuradas       | —     | `200` com `{ cidadeTamanho, base, zonas }` (E6-3) |
| GET    | `/pedidos/:id/rastreio`       | Status do pedido em linguagem amigável, com distância real    | —     | `200` com `{ pedidoId, status, mensagem, distanciaQuadras?, droneId? }` (E6-2) |
| GET    | `/dashboard`                  | Página web com métricas e mapa da operação                    | —     | `200` com `text/html` (E6-1)                     |

`GET /mapa` é somente leitura — zonas continuam vindo do `.env` e não são editáveis por API (D8/D37).

`GET /pedidos/:id/rastreio` monta a mensagem a partir de `montarRastreio` (domínio puro): pedido
`pendente`/`alocado`/`entregue`/`cancelado` tem mensagem própria, sem distância; pedido `em_voo`
inclui a distância **real** do drone ao destino, em quadras, contornando zonas de exclusão — não a
Manhattan reta (D42) — e entra na faixa "chegando" a partir de 1 quadra. Sem drone localizável ou
sem rota calculável entre o drone e o destino, a mensagem degrada sem `distanciaQuadras` em vez de
falhar: é leitura para o cliente final, não invariante de domínio.

`GET /entregas/rota?caminho=true` (E6-4) traz, por viagem, uma perna por par consecutivo de
`paradas`, cada uma com `de`, `ate` e `celulas` — a sequência de coordenadas que o drone realmente
percorre entre as duas paradas, contornando zonas de exclusão. É opt-in (D40): sem o parâmetro, a
resposta é idêntica à de antes do E6-4. O caminho é derivado do `MapaCidade` a cada chamada, nunca
persistido (D31/D37), e é determinístico — o backtracking desempata por menor `x`, depois menor `y`
(D39, o mesmo critério do roteamento nearest-neighbor, D12).

`GET /dashboard` serve uma página HTML/CSS/JS autossuficiente (sem dependência de CDN ou host
externo, D41): exibe o painel de métricas (entregas realizadas, tempo médio por entrega, makespan e
drone mais eficiente, D19) e desenha o mapa em SVG a partir de `/mapa`, `/simulacao`, `/drones`,
`/entregas/rota?caminho=true` e `/pedidos` — grade da malha com rótulos de eixo `0..N`, base, zonas
de exclusão, rotas contornando-as, os destinos dos pedidos ainda não entregues (`pendente`,
`alocado`, `em_voo`) como marcador de cliente e a posição de cada drone como marcador próprio,
visualmente distinto do cliente. Uma legenda fixa abaixo do mapa nomeia os quatro marcadores (base,
zona de exclusão, cliente, drone). Os botões "Alocar pedidos" e "Avançar relógio" chamam
`POST /entregas/alocar` e `POST /simulacao/avancar` e recarregam os dados. Abra
`http://localhost:3000/dashboard` no navegador com o servidor de pé.

**Consultar o mapa (zonas e tamanho da malha):**

```bash
curl http://localhost:3000/mapa
```

```json
{
  "cidadeTamanho": 10,
  "base": { "x": 0, "y": 0 },
  "zonas": [{ "de": { "x": 3, "y": 3 }, "ate": { "x": 5, "y": 5 } }]
}
```

**Rastrear um pedido em voo:**

```bash
curl http://localhost:3000/pedidos/cac58500-93f0-4213-ba12-d768ec785e5c/rastreio
```

```json
{
  "pedidoId": "cac58500-93f0-4213-ba12-d768ec785e5c",
  "status": "em_voo",
  "droneId": "drone-1",
  "distanciaQuadras": 4,
  "mensagem": "Seu pacote está a 4 quadras de você."
}
```

### Exemplos

**Cadastrar um pedido:**

```bash
curl -X POST http://localhost:3000/pedidos \
  -H "Content-Type: application/json" \
  -d '{"x": 3, "y": 4, "pesoKg": 5, "prioridade": "alta"}'
```

```json
{
  "id": "3c174a9f-390c-4326-8e2b-ec6237baaba8",
  "destino": { "x": 3, "y": 4 },
  "pesoKg": 5,
  "prioridade": "alta",
  "status": "pendente"
}
```

**Listar pedidos pendentes de prioridade alta:**

```bash
curl "http://localhost:3000/pedidos?status=pendente&prioridade=alta"
```

**Cancelar um pedido:**

```bash
curl -X POST http://localhost:3000/pedidos/3c174a9f-390c-4326-8e2b-ec6237baaba8/cancelar
```

**Resposta de erro padronizada (E7-1):** todo erro segue o mesmo envelope, com o
status HTTP adequado (`400` entrada malformada, `404` recurso inexistente, `422`
regra de negócio violada):

```bash
curl -X POST http://localhost:3000/pedidos \
  -H "Content-Type: application/json" \
  -d '{"x": 3, "y": 4, "pesoKg": 999, "prioridade": "alta"}'
```

```json
{
  "erro": {
    "codigo": "PESO_ACIMA_CAPACIDADE",
    "mensagem": "Peso de 999kg acima da capacidade do drone (10kg)."
  }
}
```

**Listar a frota:**

```bash
curl http://localhost:3000/drones
```

```json
[
  {
    "id": "drone-1",
    "estado": "idle",
    "posicao": { "x": 0, "y": 0 },
    "cargaKg": 0,
    "capacidadeKg": 10,
    "bateriaQuadras": 40,
    "alcanceQuadras": 40,
    "bateriaPercentual": 100
  }
]
```

**Buscar um drone inexistente (404 padronizado, E7-2):**

```bash
curl http://localhost:3000/drones/inexistente
```

```json
{
  "erro": {
    "codigo": "DRONE_NAO_ENCONTRADO",
    "mensagem": "Drone não encontrado: id=\"inexistente\"."
  }
}
```

**Alocar os pedidos pendentes em viagens:**

```bash
curl -X POST http://localhost:3000/entregas/alocar
```

```json
{
  "viagens": [
    {
      "id": "6333e33e-b8df-4ac5-a867-851eb13b8455",
      "droneId": "drone-1",
      "pedidoIds": ["cac58500-93f0-4213-ba12-d768ec785e5c"],
      "paradas": [
        { "x": 0, "y": 0 },
        { "x": 3, "y": 4 },
        { "x": 0, "y": 0 }
      ],
      "distanciaQuadras": 14,
      "cargaKg": 5,
      "status": "planejada",
      "totalParadas": 3,
      "totalPedidos": 1
    }
  ],
  "naoAlocados": []
}
```

**Consultar as viagens calculadas:**

```bash
curl http://localhost:3000/entregas/rota
```

```json
[
  {
    "id": "6333e33e-b8df-4ac5-a867-851eb13b8455",
    "droneId": "drone-1",
    "pedidoIds": ["cac58500-93f0-4213-ba12-d768ec785e5c"],
    "paradas": [
      { "x": 0, "y": 0 },
      { "x": 3, "y": 4 },
      { "x": 0, "y": 0 }
    ],
    "distanciaQuadras": 14,
    "cargaKg": 5,
    "status": "planejada",
    "totalParadas": 3,
    "totalPedidos": 1
  }
]
```

**Fluxo ponta a ponta da simulação (E4): cadastrar → alocar → avançar → consultar**

```bash
# 1. cadastrar um pedido
curl -X POST http://localhost:3000/pedidos \
  -H "Content-Type: application/json" \
  -d '{"x": 3, "y": 4, "pesoKg": 5, "prioridade": "alta"}'

# 2. alocar — gera a viagem "planejada" e já recomputa a linha do tempo (relógio em 0)
curl -X POST http://localhost:3000/entregas/alocar

# 3. consultar a simulação antes de avançar (métricas já calculadas, nada aplicado ainda)
curl http://localhost:3000/simulacao
```

```json
{
  "instanteAtual": 0,
  "metricas": {
    "totalEntregas": 1,
    "makespanMin": 28,
    "tempoMedioEntregaMin": 14,
    "tempoPorPedido": [{ "pedidoId": "cac58500-93f0-4213-ba12-d768ec785e5c", "instanteEntregaMin": 14 }],
    "porDrone": [
      {
        "droneId": "drone-1",
        "viagens": 1,
        "distanciaQuadras": 14,
        "tempoOcupadoMin": 28,
        "entregas": 1,
        "eficiencia": 0.0714
      }
    ],
    "droneMaisEficiente": "drone-1"
  }
}
```

```bash
# 4. avançar o relógio até o fim da operação (makespanMin + folga)
curl -X POST http://localhost:3000/simulacao/avancar \
  -H "Content-Type: application/json" \
  -d '{"ateInstante": 100}'

# 5. conferir o efeito: pedido entregue, viagem concluída, drone de volta idle na base
curl http://localhost:3000/pedidos
curl http://localhost:3000/entregas/rota
curl http://localhost:3000/drones
```

**Avanço com instante retroativo (422 padronizado):**

```bash
curl -X POST http://localhost:3000/simulacao/avancar \
  -H "Content-Type: application/json" \
  -d '{"ateInstante": 0}'
```

```json
{
  "erro": {
    "codigo": "AVANCO_INVALIDO",
    "mensagem": "Não é possível avançar para 0min: o relógio já está em 100min e só avança para frente."
  }
}
```

---

## 📦 Entregáveis

**Obrigatórios**

- README de execução
- Testes unitários
- Repositório público no GitHub

**Opcionais**

- Markdown de regras, memórias e prompts de IA utilizados
- Deploy / link do projeto funcionando

---

## 📄 Licença

Projeto de uso educacional / avaliação técnica.
