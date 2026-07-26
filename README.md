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

- [ ] Máquina de estados do drone: `Idle → Carregando → Em voo → Entregando → Retornando → Idle`
- [ ] Simulação de bateria (consumo por distância/tempo) e recarga na base
- [ ] Zonas de exclusão aérea (obstáculos entre pontos)
- [ ] Cálculo de tempo total de entrega
- [ ] Fila de entrega (prioridade + tempo de chegada)
- [ ] Dashboard / relatório: entregas realizadas, tempo médio, drone mais eficiente, mapa
- [ ] Feedback do cliente ("seu pacote está a N quadras")

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

| Método | Rota                | Descrição                                          | Corpo | Resposta                                    |
| ------ | ------------------- | --------------------------------------------------- | ----- | -------------------------------------------- |
| POST   | `/entregas/alocar`  | Aloca os pedidos `pendente` em viagens (greedy)      | —     | `201` com `{ viagens, naoAlocados }`         |
| GET    | `/entregas/rota`    | Lista as viagens já calculadas                       | —     | `200` com array (vazio se nenhuma alocação)  |

`POST /entregas/alocar` ordena os pedidos pendentes por prioridade → distância → peso (D11),
empacota em viagens por heurística greedy respeitando capacidade e alcance (D9), roteia cada
viagem por vizinho mais próximo (D12) e distribui entre os drones da frota em round-robin (D28).
Pedidos alocados passam a `alocado`; pedido inviável (fora do alcance ou peso acima da
capacidade) sai em `naoAlocados`, com `pedidoId`, `motivo` e `mensagem`, e continua `pendente`.
As viagens são persistidas (D26) e sobrevivem a reinício.

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
    "totalParadas": 3,
    "totalPedidos": 1
  }
]
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
