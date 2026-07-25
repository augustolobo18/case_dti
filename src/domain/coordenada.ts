import { ErroDominio } from './erros.js';

/**
 * Ponto na malha 2D da cidade. A malha vai de `0` a `N` (inclusive) em cada
 * eixo, onde `N` é o `cidadeTamanho` configurado.
 */
export type Coordenada = {
  readonly x: number;
  readonly y: number;
};

/** Verifica se um número é um inteiro finito (rejeita fracionário, NaN e Infinity). */
function ehInteiroFinito(valor: number): boolean {
  return Number.isFinite(valor) && Number.isInteger(valor);
}

/**
 * Cria uma `Coordenada` validando que `x` e `y` são inteiros finitos e que
 * estão dentro da malha `0..cidadeTamanho` (D4).
 */
export function criarCoordenada(x: number, y: number, cidadeTamanho: number): Coordenada {
  if (!ehInteiroFinito(x) || !ehInteiroFinito(y)) {
    throw new ErroDominio(
      'COORDENADA_INVALIDA',
      `Coordenada inválida: x=${x}, y=${y}. Os valores devem ser inteiros finitos.`,
    );
  }

  const coordenada: Coordenada = { x, y };

  if (!dentroDaMalha(coordenada, cidadeTamanho)) {
    throw new ErroDominio(
      'COORDENADA_FORA_DA_MALHA',
      `Coordenada (${x}, ${y}) fora da malha: os valores devem estar entre 0 e ${cidadeTamanho}.`,
    );
  }

  return coordenada;
}

/** Verifica se a coordenada está dentro da malha `0..cidadeTamanho` (inclusive). */
export function dentroDaMalha(coordenada: Coordenada, cidadeTamanho: number): boolean {
  return (
    coordenada.x >= 0 &&
    coordenada.x <= cidadeTamanho &&
    coordenada.y >= 0 &&
    coordenada.y <= cidadeTamanho
  );
}

/**
 * Distância Manhattan entre duas coordenadas: `|dx| + |dy|` (D16).
 * A unidade é a quadra; não depende do tamanho da malha.
 */
export function distanciaManhattan(a: Coordenada, b: Coordenada): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** Verifica se duas coordenadas representam o mesmo ponto. */
export function saoIguais(a: Coordenada, b: Coordenada): boolean {
  return a.x === b.x && a.y === b.y;
}
