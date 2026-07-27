import { describe, it, expect } from 'vitest';
import { criarMapaCidade } from '../../domain/mapa.js';
import { paraRespostaMapa } from './mapa.js';

describe('paraRespostaMapa', () => {
  it('devolve cidadeTamanho, base e zonas de um mapa sem zonas', () => {
    const mapa = criarMapaCidade({ cidadeTamanho: 10, zonas: [] });
    const base = { x: 0, y: 0 };

    const resposta = paraRespostaMapa(mapa, base);

    expect(resposta).toEqual({ cidadeTamanho: 10, base, zonas: [] });
  });

  it('mapa sem zonas devolve lista vazia, nunca undefined', () => {
    const mapa = criarMapaCidade({ cidadeTamanho: 10, zonas: [] });

    const resposta = paraRespostaMapa(mapa, { x: 0, y: 0 });

    expect(resposta.zonas).toEqual([]);
    expect(resposta.zonas).not.toBeUndefined();
  });

  it('mapa com duas zonas devolve as duas, com de/ate intactos', () => {
    const zonas = [
      { de: { x: 2, y: 2 }, ate: { x: 4, y: 4 } },
      { de: { x: 7, y: 7 }, ate: { x: 8, y: 9 } },
    ];
    const mapa = criarMapaCidade({ cidadeTamanho: 10, zonas });
    const base = { x: 0, y: 0 };

    const resposta = paraRespostaMapa(mapa, base);

    expect(resposta).toEqual({ cidadeTamanho: 10, base, zonas });
  });
});
