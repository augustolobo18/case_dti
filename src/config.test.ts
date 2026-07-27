import { describe, it, expect } from 'vitest';
import { config } from './config.js';
import { criarMapaCidade } from './domain/mapa.js';

describe('config', () => {
  it('define capacidade e alcance padrão do drone', () => {
    expect(config.droneCapacidadeKg).toBeGreaterThan(0);
    expect(config.droneAlcanceQuadras).toBeGreaterThan(0);
  });

  it('define a base na origem por padrão', () => {
    expect(config.base).toEqual({ x: 0, y: 0 });
  });

  it('define um tamanho de cidade e uma quantidade de drones válidos', () => {
    expect(config.cidadeTamanho).toBeGreaterThan(0);
    expect(config.droneQuantidade).toBeGreaterThanOrEqual(1);
  });

  it('garante que o canto mais distante da malha cabe no alcance padrão (viagem fechada)', () => {
    // Com a base em (0,0), o canto oposto da malha fica a `2 * cidadeTamanho` quadras;
    // a viagem fechada (ida + volta) custa `4 * cidadeTamanho` e precisa caber no alcance.
    expect(4 * config.cidadeTamanho).toBeLessThanOrEqual(config.droneAlcanceQuadras);
  });

  it('define zonasExclusao vazia por padrão (E5-2)', () => {
    expect(config.zonasExclusao).toEqual([]);
  });

  it('a base não fica em célula bloqueada com a configuração padrão', () => {
    const mapa = criarMapaCidade({
      cidadeTamanho: config.cidadeTamanho,
      zonas: config.zonasExclusao,
    });

    expect(mapa.bloqueada(config.base)).toBe(false);
  });

  it('zona fora da malha 0..cidadeTamanho é rejeitada por criarMapaCidade', () => {
    expect(() =>
      criarMapaCidade({
        cidadeTamanho: config.cidadeTamanho,
        zonas: [{ de: { x: 0, y: 0 }, ate: { x: config.cidadeTamanho + 5, y: 0 } }],
      }),
    ).toThrow();
  });
});
