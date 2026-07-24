# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Contexto do projeto

Simulador de entregas por drone (desafio técnico de processo seletivo). A cidade
é uma malha de coordenadas 2D; drones partem de uma base, carregam pacotes,
entregam a clientes e retornam. O objetivo central é **alocar pacotes nas
viagens minimizando o número total de viagens**, respeitando capacidade (kg),
alcance (km) e prioridade das entregas.

**Stack decidida:** Node.js + TypeScript, expondo uma **API REST** e um
**dashboard/relatório** simples. O escopo cresce por feature: primeiro o núcleo
(domínio + alocação + testes + API), depois diferenciais (bateria, obstáculos,
máquina de estados, fila, tempo de entrega).

> Estado atual: **greenfield**. Ainda não há `package.json` nem código. Os
> comandos e a estrutura abaixo são o alvo — confirme o que já existe antes de
> assumir que um script/ferramenta está configurado.

## Comandos (alvo)

```bash
npm install        # instalar dependências
npm run dev        # rodar API em modo desenvolvimento
npm run build      # compilar TypeScript -> dist/
npm start          # rodar build compilado
npm test           # rodar todos os testes
npm test -- <arquivo|padrão>   # rodar um teste específico
```

> Antes de rodar/citar um comando, verifique os scripts reais em `package.json`;
> não invente comandos que não existam.

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
