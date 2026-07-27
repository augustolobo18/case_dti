import type { Viagem } from '../../domain/viagem.js';

/**
 * Payload de resposta de uma viagem (E3-3): os campos do domínio mais
 * `totalParadas` e `totalPedidos`, derivados na borda da API — o domínio não
 * ganha esses campos, mesmo padrão de `bateriaPercentual` em `RespostaDrone`.
 */
export type RespostaViagem = {
  readonly id: string;
  readonly droneId: string;
  readonly pedidoIds: readonly string[];
  readonly paradas: Viagem['paradas'];
  readonly distanciaQuadras: number;
  readonly cargaKg: number;
  readonly status: Viagem['status'];
  readonly totalParadas: number;
  readonly totalPedidos: number;
};

/** Converte uma `Viagem` do domínio na resposta da API, com os campos derivados. */
export function paraRespostaViagem(viagem: Viagem): RespostaViagem {
  return {
    id: viagem.id,
    droneId: viagem.droneId,
    pedidoIds: viagem.pedidoIds,
    paradas: viagem.paradas,
    distanciaQuadras: viagem.distanciaQuadras,
    cargaKg: viagem.cargaKg,
    status: viagem.status,
    totalParadas: viagem.paradas.length,
    totalPedidos: viagem.pedidoIds.length,
  };
}
