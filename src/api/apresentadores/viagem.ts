import type { Coordenada } from '../../domain/coordenada.js';
import { ErroDominio } from '../../domain/erros.js';
import type { MapaCidade } from '../../domain/mapa.js';
import type { Viagem } from '../../domain/viagem.js';

/** Uma perna do caminho entre duas paradas consecutivas da viagem (E6-4/D39). */
export type PernaCaminho = {
  readonly de: Coordenada;
  readonly ate: Coordenada;
  readonly celulas: readonly Coordenada[];
};

/** Opções de `paraRespostaViagem`: sem elas, a resposta não ganha `caminho` (D40). */
export type OpcoesRespostaViagem = {
  readonly mapa: MapaCidade;
};

/**
 * Payload de resposta de uma viagem (E3-3): os campos do domínio mais
 * `totalParadas` e `totalPedidos`, derivados na borda da API — o domínio não
 * ganha esses campos, mesmo padrão de `bateriaPercentual` em `RespostaDrone`.
 * `caminho` é opcional (E6-4): só aparece quando `opcoes.mapa` é informado.
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
  readonly caminho?: readonly PernaCaminho[];
};

/**
 * Converte uma `Viagem` do domínio na resposta da API, com os campos
 * derivados. Sem `opcoes`, o payload é idêntico ao de antes do E6-4 — a chave
 * `caminho` nem aparece. Com `{ mapa }`, monta uma perna por par consecutivo
 * de `viagem.paradas`; perna sem rota é estado inalcançável para uma viagem já
 * planejada — deixa `ROTA_IMPOSSIVEL` propagar (500).
 */
export function paraRespostaViagem(viagem: Viagem, opcoes?: OpcoesRespostaViagem): RespostaViagem {
  const base: RespostaViagem = {
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

  if (!opcoes) {
    return base;
  }

  const { mapa } = opcoes;
  const caminho: PernaCaminho[] = [];
  for (let i = 0; i < viagem.paradas.length - 1; i += 1) {
    const de = viagem.paradas[i]!;
    const ate = viagem.paradas[i + 1]!;
    const celulas = mapa.caminho(de, ate);
    if (celulas === null) {
      throw new ErroDominio(
        'ROTA_IMPOSSIVEL',
        `Não há rota entre (${de.x}, ${de.y}) e (${ate.x}, ${ate.y}) para desenhar o caminho — ` +
          'estado inalcançável para uma viagem já planejada.',
      );
    }
    caminho.push({ de, ate, celulas });
  }

  return { ...base, caminho };
}
