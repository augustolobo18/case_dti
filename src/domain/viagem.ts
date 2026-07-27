import { randomUUID } from 'node:crypto';
import { distanciaManhattan, type Coordenada } from './coordenada.js';
import { ErroDominio } from './erros.js';
import type { Pedido } from './pedido.js';

/** Status do ciclo de vida da viagem (D35/E4-1). */
export const STATUS_VIAGEM = ['planejada', 'em_execucao', 'concluida'] as const;
export type StatusViagem = (typeof STATUS_VIAGEM)[number];

/** Viagem de um drone: rota fechada base → entregas → base, imutável. */
export type Viagem = {
  readonly id: string;
  readonly droneId: string;
  readonly pedidoIds: readonly string[];
  readonly paradas: readonly Coordenada[];
  readonly distanciaQuadras: number;
  readonly cargaKg: number;
  readonly status: StatusViagem;
};

/** Resultado do roteamento: a ordem das paradas e a distância total do percurso. */
export type ResultadoRoteamento = {
  readonly paradas: readonly Coordenada[];
  readonly distanciaQuadras: number;
};

/** Opções de criação de uma viagem. */
export type OpcoesViagem = {
  readonly droneId: string;
  readonly pedidos: readonly Pedido[];
  readonly base: Coordenada;
  readonly capacidadeKg: number;
  readonly alcanceQuadras: number;
  readonly gerarId?: () => string;
};

/** Resultado da reconciliação de viagens contra a frota atual. */
export type ResultadoReconciliacao = {
  readonly viagens: readonly Viagem[];
  readonly pedidoIdsOrfaos: readonly string[];
};

/**
 * Compara duas coordenadas para desempate determinístico: menor `x` primeiro,
 * depois menor `y` (D12) — nunca a ordem de chegada no array.
 */
function compararPorXY(a: Coordenada, b: Coordenada): number {
  if (a.x !== b.x) {
    return a.x - b.x;
  }
  return a.y - b.y;
}

/**
 * Roteia os destinos por vizinho mais próximo (nearest-neighbor, D12), partindo
 * e retornando à `base`. Puro: não muta a entrada. Empate de distância resolve
 * por menor `x`, depois menor `y`, para manter o resultado determinístico.
 */
export function rotearNearestNeighbor(
  base: Coordenada,
  destinos: readonly Coordenada[],
): ResultadoRoteamento {
  const pendentes = [...destinos];
  const paradas: Coordenada[] = [base];
  let atual: Coordenada = base;
  let distanciaQuadras = 0;

  if (pendentes.length === 0) {
    return { paradas, distanciaQuadras };
  }

  while (pendentes.length > 0) {
    let indiceMaisProximo = 0;
    let menorDistancia = distanciaManhattan(atual, pendentes[0]!);

    for (let indice = 1; indice < pendentes.length; indice += 1) {
      const candidato = pendentes[indice]!;
      const distancia = distanciaManhattan(atual, candidato);
      const maisProximoAtual = pendentes[indiceMaisProximo]!;

      if (
        distancia < menorDistancia ||
        (distancia === menorDistancia && compararPorXY(candidato, maisProximoAtual) < 0)
      ) {
        menorDistancia = distancia;
        indiceMaisProximo = indice;
      }
    }

    const [proximo] = pendentes.splice(indiceMaisProximo, 1);
    distanciaQuadras += menorDistancia;
    paradas.push(proximo!);
    atual = proximo!;
  }

  distanciaQuadras += distanciaManhattan(atual, base);
  paradas.push(base);

  return { paradas, distanciaQuadras };
}

/**
 * Cria uma `Viagem`, guarda de invariante do domínio: capacidade e alcance são
 * verificados **na construção**, com bordas inclusivas (`<=`). O algoritmo de
 * alocação (Fase 2) nunca deve chegar a violar essas checagens — elas existem
 * para que um bug no greedy falhe alto em vez de gravar uma viagem inválida.
 */
export function criarViagem(opcoes: OpcoesViagem): Viagem {
  const { droneId, pedidos, base, capacidadeKg, alcanceQuadras, gerarId = randomUUID } = opcoes;

  if (pedidos.length === 0) {
    throw new ErroDominio('VIAGEM_SEM_PEDIDOS', 'Viagem não pode ser criada sem nenhum pedido.');
  }

  const cargaKg = pedidos.reduce((total, pedido) => total + pedido.pesoKg, 0);
  if (cargaKg > capacidadeKg) {
    throw new ErroDominio(
      'VIAGEM_ACIMA_CAPACIDADE',
      `Carga da viagem (${cargaKg}kg) acima da capacidade do drone (${capacidadeKg}kg).`,
    );
  }

  const { paradas, distanciaQuadras } = rotearNearestNeighbor(
    base,
    pedidos.map((pedido) => pedido.destino),
  );

  if (distanciaQuadras > alcanceQuadras) {
    throw new ErroDominio(
      'VIAGEM_ACIMA_ALCANCE',
      `Distância da viagem (${distanciaQuadras} quadras) acima do alcance do drone ` +
        `(${alcanceQuadras} quadras).`,
    );
  }

  return {
    id: gerarId(),
    droneId,
    pedidoIds: pedidos.map((pedido) => pedido.id),
    paradas,
    distanciaQuadras,
    cargaKg,
    status: 'planejada',
  };
}

/** Devolve uma nova cópia da viagem com o status alterado, sem mutar o original (D35). */
export function comStatusViagem(viagem: Viagem, status: StatusViagem): Viagem {
  return { ...viagem, status };
}

/**
 * Reconcilia viagens persistidas contra a frota atual (D27): viagens cujo
 * `droneId` não existe mais são descartadas e seus `pedidoIds` viram órfãos —
 * o boot os devolve a `pendente`. Função pura, sem I/O, não muta a entrada.
 */
export function reconciliarViagens(
  viagens: readonly Viagem[],
  droneIdsValidos: readonly string[],
): ResultadoReconciliacao {
  const validos = new Set(droneIdsValidos);
  const mantidas: Viagem[] = [];
  const pedidoIdsOrfaos: string[] = [];

  for (const viagem of viagens) {
    if (validos.has(viagem.droneId)) {
      mantidas.push(viagem);
    } else {
      pedidoIdsOrfaos.push(...viagem.pedidoIds);
    }
  }

  return { viagens: mantidas, pedidoIdsOrfaos };
}
