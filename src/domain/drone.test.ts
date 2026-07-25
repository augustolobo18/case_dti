import { describe, it, expect } from 'vitest';
import { ErroDominio } from './erros.js';
import { criarDrone, criarFrota, type OpcoesDrone } from './drone.js';

const OPCOES: OpcoesDrone = { base: { x: 0, y: 0 }, capacidadeKg: 10, alcanceQuadras: 40 };

describe('criarDrone', () => {
  it('cria um drone idle, na base, sem carga e com bateria cheia (E2-2)', () => {
    const drone = criarDrone({ ...OPCOES, gerarId: () => 'drone-1' });

    expect(drone.estado).toBe('idle');
    expect(drone.posicao).toEqual(OPCOES.base);
    expect(drone.cargaKg).toBe(0);
    expect(drone.capacidadeKg).toBe(OPCOES.capacidadeKg);
    expect(drone.alcanceQuadras).toBe(OPCOES.alcanceQuadras);
    expect(drone.bateriaQuadras).toBe(OPCOES.alcanceQuadras);
    expect(drone.id).toBe('drone-1');
  });

  it('usa crypto.randomUUID como gerador padrão quando nenhum é injetado', () => {
    const drone = criarDrone(OPCOES);
    expect(typeof drone.id).toBe('string');
    expect(drone.id.length).toBeGreaterThan(0);
  });
});

describe('criarFrota', () => {
  it('cria N drones homogêneos com ids distintos', () => {
    let contador = 0;
    const frota = criarFrota(3, { ...OPCOES, gerarId: () => `drone-${++contador}` });

    expect(frota).toHaveLength(3);

    const ids = frota.map((drone) => drone.id);
    expect(new Set(ids).size).toBe(3);

    for (const drone of frota) {
      expect(drone.capacidadeKg).toBe(OPCOES.capacidadeKg);
      expect(drone.alcanceQuadras).toBe(OPCOES.alcanceQuadras);
      expect(drone.estado).toBe('idle');
    }
  });

  it('rejeita quantidade zero com QUANTIDADE_DRONES_INVALIDA', () => {
    expect.assertions(2);
    try {
      criarFrota(0, OPCOES);
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroDominio);
      expect((erro as ErroDominio).codigo).toBe('QUANTIDADE_DRONES_INVALIDA');
    }
  });

  it('rejeita quantidade negativa com QUANTIDADE_DRONES_INVALIDA', () => {
    expect.assertions(2);
    try {
      criarFrota(-1, OPCOES);
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroDominio);
      expect((erro as ErroDominio).codigo).toBe('QUANTIDADE_DRONES_INVALIDA');
    }
  });

  it('rejeita quantidade fracionária com QUANTIDADE_DRONES_INVALIDA', () => {
    expect.assertions(2);
    try {
      criarFrota(1.5, OPCOES);
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroDominio);
      expect((erro as ErroDominio).codigo).toBe('QUANTIDADE_DRONES_INVALIDA');
    }
  });
});
