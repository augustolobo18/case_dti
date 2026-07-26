import { describe, it, expect } from 'vitest';
import { ErroDominio } from '../domain/erros.js';
import { criarRepositorioFrota, type OpcoesFrota } from './frota.js';

const OPCOES: OpcoesFrota = {
  base: { x: 0, y: 0 },
  capacidadeKg: 10,
  alcanceQuadras: 40,
  quantidade: 3,
};

describe('criarRepositorioFrota', () => {
  it('cria a frota homogênea a partir das opções (D8)', () => {
    const repositorio = criarRepositorioFrota(OPCOES);
    const drones = repositorio.listar();

    expect(drones).toHaveLength(OPCOES.quantidade);
    for (const drone of drones) {
      expect(drone.estado).toBe('idle');
      expect(drone.posicao).toEqual(OPCOES.base);
      expect(drone.cargaKg).toBe(0);
      expect(drone.bateriaQuadras).toBe(OPCOES.alcanceQuadras);
      expect(drone.capacidadeKg).toBe(OPCOES.capacidadeKg);
      expect(drone.alcanceQuadras).toBe(OPCOES.alcanceQuadras);
    }
  });

  it('gera ids "drone-1"..."drone-N" na ordem', () => {
    const repositorio = criarRepositorioFrota(OPCOES);
    const ids = repositorio.listar().map((drone) => drone.id);

    expect(ids).toEqual(['drone-1', 'drone-2', 'drone-3']);
  });

  it('listar() devolve uma cópia — mutar o array retornado não afeta a chamada seguinte', () => {
    const repositorio = criarRepositorioFrota(OPCOES);
    const primeira = repositorio.listar();
    primeira.pop();

    expect(repositorio.listar()).toHaveLength(OPCOES.quantidade);
  });

  it('buscarPorId devolve o drone correspondente', () => {
    const repositorio = criarRepositorioFrota(OPCOES);

    expect(repositorio.buscarPorId('drone-2').id).toBe('drone-2');
  });

  it('lança DRONE_NAO_ENCONTRADO ao buscar id inexistente', () => {
    expect.assertions(2);
    const repositorio = criarRepositorioFrota(OPCOES);

    try {
      repositorio.buscarPorId('inexistente');
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroDominio);
      expect((erro as ErroDominio).codigo).toBe('DRONE_NAO_ENCONTRADO');
    }
  });

  it('propaga QUANTIDADE_DRONES_INVALIDA quando quantidade é 0', () => {
    expect.assertions(2);
    try {
      criarRepositorioFrota({ ...OPCOES, quantidade: 0 });
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroDominio);
      expect((erro as ErroDominio).codigo).toBe('QUANTIDADE_DRONES_INVALIDA');
    }
  });
});
