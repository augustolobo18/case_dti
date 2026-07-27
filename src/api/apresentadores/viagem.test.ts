import { describe, it, expect } from 'vitest';
import { criarMapaCidade, type ZonaExclusao } from '../../domain/mapa.js';
import { criarViagem, type Viagem } from '../../domain/viagem.js';
import { criarPedido, type LimitesPedido, type Pedido } from '../../domain/pedido.js';
import { paraRespostaViagem } from './viagem.js';

const BASE = { x: 0, y: 0 };
const LIMITES: LimitesPedido = { capacidadeKg: 100, cidadeTamanho: 20 };

let contador = 0;
function novoPedido(x: number, y: number): Pedido {
  contador += 1;
  const idFixo = `pedido-${contador}`;
  return criarPedido(
    { x, y, pesoKg: 1, prioridade: 'baixa' },
    { limites: LIMITES, gerarId: () => idFixo },
  );
}

let contadorViagem = 0;
function novaViagem(pedidos: Pedido[], mapa: ReturnType<typeof criarMapaCidade>): Viagem {
  contadorViagem += 1;
  return criarViagem({
    droneId: 'drone-1',
    pedidos,
    base: BASE,
    capacidadeKg: 100,
    alcanceQuadras: 100,
    mapa,
    gerarId: () => `viagem-${contadorViagem}`,
  });
}

describe('paraRespostaViagem — sem opções (payload de hoje)', () => {
  it('não tem a chave "caminho" quando chamado sem opções', () => {
    const mapa = criarMapaCidade({ cidadeTamanho: LIMITES.cidadeTamanho, zonas: [] });
    const pedido = novoPedido(3, 4);
    const viagem = novaViagem([pedido], mapa);

    const resposta = paraRespostaViagem(viagem);

    expect(resposta).not.toHaveProperty('caminho');
    expect(resposta).toEqual({
      id: viagem.id,
      droneId: viagem.droneId,
      pedidoIds: viagem.pedidoIds,
      paradas: viagem.paradas,
      distanciaQuadras: viagem.distanciaQuadras,
      cargaKg: viagem.cargaKg,
      status: viagem.status,
      totalParadas: viagem.paradas.length,
      totalPedidos: viagem.pedidoIds.length,
    });
  });
});

describe('paraRespostaViagem — com { mapa } (E6-4)', () => {
  it('traz uma perna por par consecutivo de paradas, com de/ate/celulas', () => {
    const mapa = criarMapaCidade({ cidadeTamanho: LIMITES.cidadeTamanho, zonas: [] });
    const p1 = novoPedido(3, 0);
    const p2 = novoPedido(6, 0);
    const viagem = novaViagem([p1, p2], mapa);

    const resposta = paraRespostaViagem(viagem, { mapa });

    expect(resposta.caminho).toBeDefined();
    const pernas = resposta.caminho!;
    expect(pernas).toHaveLength(viagem.paradas.length - 1);

    for (let i = 0; i < pernas.length; i += 1) {
      expect(pernas[i]!.de).toEqual(viagem.paradas[i]);
      expect(pernas[i]!.ate).toEqual(viagem.paradas[i + 1]);
      expect(Array.isArray(pernas[i]!.celulas)).toBe(true);
      expect(pernas[i]!.celulas[0]).toEqual(viagem.paradas[i]);
      expect(pernas[i]!.celulas.at(-1)).toEqual(viagem.paradas[i + 1]);
    }

    expect(pernas[0]!.de).toEqual(BASE);
    expect(pernas.at(-1)!.ate).toEqual(BASE);
  });

  it('com zona no meio, a perna contorna e não atravessa célula bloqueada', () => {
    const zonas: ZonaExclusao[] = [{ de: { x: 3, y: 0 }, ate: { x: 3, y: 6 } }];
    const cidadeTamanho = 8;
    const mapa = criarMapaCidade({ cidadeTamanho, zonas });
    const pedido = criarPedido(
      { x: 6, y: 4, pesoKg: 1, prioridade: 'baixa' },
      { limites: { capacidadeKg: 100, cidadeTamanho }, gerarId: () => 'pedido-zona' },
    );
    const viagem = criarViagem({
      droneId: 'drone-1',
      pedidos: [pedido],
      base: { x: 0, y: 4 },
      capacidadeKg: 100,
      alcanceQuadras: 100,
      mapa,
      gerarId: () => 'viagem-zona',
    });

    const resposta = paraRespostaViagem(viagem, { mapa });

    for (const perna of resposta.caminho!) {
      for (const celula of perna.celulas) {
        expect(mapa.bloqueada(celula)).toBe(false);
      }
    }
  });
});
