import { describe, it, expect } from 'vitest';
import { ErroDominio } from './erros.js';
import { criarCoordenada, dentroDaMalha, distanciaManhattan, saoIguais } from './coordenada.js';

const CIDADE_TAMANHO = 10;

describe('distanciaManhattan', () => {
  it('é zero para pontos iguais', () => {
    const a = criarCoordenada(3, 3, CIDADE_TAMANHO);
    expect(distanciaManhattan(a, a)).toBe(0);
  });

  it('é simétrica: d(a,b) === d(b,a)', () => {
    const a = criarCoordenada(1, 2, CIDADE_TAMANHO);
    const b = criarCoordenada(5, 7, CIDADE_TAMANHO);
    expect(distanciaManhattan(a, b)).toBe(distanciaManhattan(b, a));
  });

  it('calcula corretamente em um único eixo', () => {
    const a = criarCoordenada(0, 0, CIDADE_TAMANHO);
    const b = criarCoordenada(0, 5, CIDADE_TAMANHO);
    expect(distanciaManhattan(a, b)).toBe(5);
  });

  it('calcula corretamente na diagonal', () => {
    const a = criarCoordenada(2, 2, CIDADE_TAMANHO);
    const b = criarCoordenada(5, 6, CIDADE_TAMANHO);
    expect(distanciaManhattan(a, b)).toBe(7);
  });

  it('usa Manhattan e não euclidiana: (0,0) -> (3,4) é 7, não 5', () => {
    const a = criarCoordenada(0, 0, CIDADE_TAMANHO);
    const b = criarCoordenada(3, 4, CIDADE_TAMANHO);
    expect(distanciaManhattan(a, b)).toBe(7);
  });
});

describe('criarCoordenada', () => {
  it('aceita os limites da malha: 0 e N', () => {
    expect(criarCoordenada(0, 0, CIDADE_TAMANHO)).toEqual({ x: 0, y: 0 });
    expect(criarCoordenada(CIDADE_TAMANHO, CIDADE_TAMANHO, CIDADE_TAMANHO)).toEqual({
      x: CIDADE_TAMANHO,
      y: CIDADE_TAMANHO,
    });
  });

  it('rejeita coordenada abaixo de zero com COORDENADA_FORA_DA_MALHA', () => {
    expect.assertions(2);
    try {
      criarCoordenada(-1, 0, CIDADE_TAMANHO);
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroDominio);
      expect((erro as ErroDominio).codigo).toBe('COORDENADA_FORA_DA_MALHA');
    }
  });

  it('rejeita coordenada acima de N com COORDENADA_FORA_DA_MALHA', () => {
    expect.assertions(2);
    try {
      criarCoordenada(CIDADE_TAMANHO + 1, 0, CIDADE_TAMANHO);
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroDominio);
      expect((erro as ErroDominio).codigo).toBe('COORDENADA_FORA_DA_MALHA');
    }
  });

  it('rejeita valor fracionário com COORDENADA_INVALIDA', () => {
    expect.assertions(2);
    try {
      criarCoordenada(1.5, 0, CIDADE_TAMANHO);
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroDominio);
      expect((erro as ErroDominio).codigo).toBe('COORDENADA_INVALIDA');
    }
  });

  it('rejeita NaN com COORDENADA_INVALIDA', () => {
    expect.assertions(2);
    try {
      criarCoordenada(NaN, 0, CIDADE_TAMANHO);
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroDominio);
      expect((erro as ErroDominio).codigo).toBe('COORDENADA_INVALIDA');
    }
  });

  it('rejeita Infinity com COORDENADA_INVALIDA', () => {
    expect.assertions(2);
    try {
      criarCoordenada(Infinity, 0, CIDADE_TAMANHO);
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroDominio);
      expect((erro as ErroDominio).codigo).toBe('COORDENADA_INVALIDA');
    }
  });
});

describe('dentroDaMalha', () => {
  it('retorna true para pontos dentro da malha e false para fora', () => {
    expect(dentroDaMalha({ x: 5, y: 5 }, CIDADE_TAMANHO)).toBe(true);
    expect(dentroDaMalha({ x: -1, y: 5 }, CIDADE_TAMANHO)).toBe(false);
    expect(dentroDaMalha({ x: 5, y: CIDADE_TAMANHO + 1 }, CIDADE_TAMANHO)).toBe(false);
  });
});

describe('saoIguais', () => {
  it('retorna true para coordenadas com mesmos valores', () => {
    expect(saoIguais({ x: 1, y: 2 }, { x: 1, y: 2 })).toBe(true);
  });

  it('retorna false para coordenadas diferentes', () => {
    expect(saoIguais({ x: 1, y: 2 }, { x: 1, y: 3 })).toBe(false);
  });
});
