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
- **Alcance:** cada drone percorre até `Y` km por carga (ida + entregas + volta).
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

# build de produção e execução
npm run build
npm start
```

Variáveis de ambiente (opcionais) em `.env.example` — capacidade/alcance do drone,
porta e coordenada da base. Copie para `.env` para sobrescrever os padrões.

Health-check: `GET http://localhost:3000/health`.

---

## 📡 API (planejada)

| Método | Rota              | Descrição                                  |
| ------ | ----------------- | ------------------------------------------ |
| POST   | `/pedidos`        | Cadastra um novo pedido                    |
| GET    | `/entregas/rota`  | Retorna as rotas/viagens calculadas        |
| GET    | `/drones/status`  | Estado atual de cada drone                 |

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
