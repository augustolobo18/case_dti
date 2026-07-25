# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Contexto do projeto

Simulador de entregas por drone (desafio técnico de processo seletivo). A cidade
é uma malha de coordenadas 2D; drones partem de uma base, carregam pacotes,
entregam a clientes e retornam. O objetivo central é **alocar pacotes nas
viagens minimizando o número total de viagens**, respeitando capacidade (kg),
alcance (quadras) e prioridade das entregas.

**Stack:** Node.js `>= 20.12` (dev no Node 24 LTS) + TypeScript (ESM, `NodeNext`).
API REST com **Express 4**, validação com **Zod** nas bordas, testes com
**Vitest 4**. O escopo cresce por feature: primeiro o núcleo (domínio + alocação
+ testes + API), depois diferenciais (bateria, obstáculos, máquina de estados,
fila, tempo de entrega) e o dashboard/relatório.

> ESM `NodeNext`: imports relativos precisam da extensão `.js`
> (ex.: `import { config } from './config.js'`), mesmo apontando para um `.ts`.

## Comandos

```bash
npm install            # instalar dependências
npm run dev            # API em desenvolvimento (tsx watch, hot reload)
npm run build          # compilar (tsconfig.build.json, exclui testes) -> dist/
npm start              # rodar o build compilado
npm test               # rodar todos os testes (vitest run)
npm test -- <padrão>   # rodar um teste específico por nome/arquivo
npm run coverage       # testes com cobertura
npm run typecheck      # checagem de tipos sem emitir (tsc --noEmit)
```

> `build` usa `tsconfig.build.json` (não compila `*.test.ts`); `typecheck` usa o
> `tsconfig.json` raiz (inclui os testes).

## Diretrizes de arquitetura

- **Separe o domínio da infraestrutura.** A lógica de negócio (regras de
  capacidade/alcance, cálculo de distância, algoritmo de alocação, máquina de
  estados) deve ser testável sem HTTP. Os endpoints REST são apenas uma casca
  fina sobre o domínio — a mesma lógica precisa poder ser exercida por testes
  unitários e, potencialmente, por uma CLI.
- **Alocação é o coração do sistema.** O algoritmo que decide quais pacotes vão
  em qual viagem (bin-packing com restrições de peso + alcance, ordenado por
  prioridade/distância) é a parte mais avaliada. Mantenha-o isolado, puro e com
  cobertura de testes forte, incluindo casos de carga (muitos pedidos).
- **Estados do drone como máquina de estados explícita**
  (`Idle → Carregando → Em voo → Entregando → Retornando → Idle`). Ao introduzir
  a simulação, prefira orientação a eventos/timestamps a `sleep` acoplado à
  lógica, para manter tudo determinístico e testável.
- **Validação nas bordas.** Rejeite pedidos inválidos (peso acima da capacidade,
  coordenadas inválidas, prioridade desconhecida) com mensagens claras antes de
  chegarem ao domínio.

## Idioma

Código, README e documentação em **português** (o case e a avaliação são em
pt-BR). Nomes de identificadores podem seguir o domínio em português
(`Pedido`, `Drone`, `Viagem`) — mantenha consistência com o que já existir.
