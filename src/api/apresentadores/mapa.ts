import type { Coordenada } from '../../domain/coordenada.js';
import type { MapaCidade, ZonaExclusao } from '../../domain/mapa.js';

/**
 * Payload de resposta do mapa da cidade (E6-3): tamanho da malha, a base e as
 * zonas de exclusão configuradas. Somente leitura — derivado da config, sem
 * repositório no caminho (D37).
 */
export type RespostaMapa = {
  readonly cidadeTamanho: number;
  readonly base: Coordenada;
  readonly zonas: readonly ZonaExclusao[];
};

/** Converte um `MapaCidade` e a `base` configurada na resposta da API. */
export function paraRespostaMapa(mapa: MapaCidade, base: Coordenada): RespostaMapa {
  return {
    cidadeTamanho: mapa.cidadeTamanho,
    base,
    zonas: mapa.zonas,
  };
}
