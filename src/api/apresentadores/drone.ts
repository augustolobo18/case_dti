import type { Drone } from '../../domain/drone.js';
import type { Coordenada } from '../../domain/coordenada.js';

/**
 * Payload de resposta de um drone (E2-2): os campos do domínio mais
 * `bateriaPercentual`, derivado na borda da API. O domínio não ganha esse
 * campo — bateria "de verdade" (consumo/recarga) é E4-3.
 */
export type RespostaDrone = {
  readonly id: string;
  readonly estado: Drone['estado'];
  readonly posicao: Coordenada;
  readonly cargaKg: number;
  readonly capacidadeKg: number;
  readonly bateriaQuadras: number;
  readonly alcanceQuadras: number;
  readonly bateriaPercentual: number;
};

/** Converte um `Drone` do domínio na resposta da API, adicionando `bateriaPercentual`. */
export function paraRespostaDrone(drone: Drone): RespostaDrone {
  return {
    id: drone.id,
    estado: drone.estado,
    posicao: drone.posicao,
    cargaKg: drone.cargaKg,
    capacidadeKg: drone.capacidadeKg,
    bateriaQuadras: drone.bateriaQuadras,
    alcanceQuadras: drone.alcanceQuadras,
    bateriaPercentual: Math.round((drone.bateriaQuadras / drone.alcanceQuadras) * 100),
  };
}
