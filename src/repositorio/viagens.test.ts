import { describe, it, expect } from 'vitest';
import type { Viagem } from '../domain/viagem.js';
import { criarPersistenciaMemoria } from '../infra/persistencia-viagens.js';
import { criarRepositorioViagens } from './viagens.js';

function novaViagem(overrides: Partial<Viagem> = {}): Viagem {
  return {
    id: 'viagem-1',
    droneId: 'drone-1',
    pedidoIds: ['pedido-1'],
    paradas: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 0 },
    ],
    distanciaQuadras: 2,
    cargaKg: 3,
    ...overrides,
  };
}

describe('criarRepositorioViagens', () => {
  it('listar() devolve cópia — mutar o retorno não afeta o repositório', () => {
    const persistencia = criarPersistenciaMemoria([novaViagem()]);
    const repositorio = criarRepositorioViagens({ persistencia, droneIds: ['drone-1'] });

    const lista = repositorio.listar();
    lista.push(novaViagem({ id: 'outra' }));

    expect(repositorio.listar()).toHaveLength(1);
  });

  it('substituirTodas grava via porta (write-through) e substitui o conteúdo anterior', () => {
    const persistencia = criarPersistenciaMemoria([novaViagem()]);
    const repositorio = criarRepositorioViagens({ persistencia, droneIds: ['drone-1'] });

    const novaLista = [novaViagem({ id: 'viagem-2', droneId: 'drone-1' })];
    repositorio.substituirTodas(novaLista);

    expect(repositorio.listar()).toEqual(novaLista);
    expect(persistencia.carregar()).toEqual(novaLista);
  });

  it('reconciliação no boot descarta viagem de drone inexistente, expõe pedidoIdsOrfaos e persiste a lista reconciliada', () => {
    const viagemValida = novaViagem({ id: 'viagem-1', droneId: 'drone-1', pedidoIds: ['p1'] });
    const viagemOrfa = novaViagem({ id: 'viagem-2', droneId: 'drone-9', pedidoIds: ['p2', 'p3'] });
    const persistencia = criarPersistenciaMemoria([viagemValida, viagemOrfa]);

    const repositorio = criarRepositorioViagens({ persistencia, droneIds: ['drone-1'] });

    expect(repositorio.listar()).toEqual([viagemValida]);
    expect(repositorio.pedidoIdsOrfaos()).toEqual(['p2', 'p3']);
    expect(persistencia.carregar()).toEqual([viagemValida]);
  });

  it('frota completa mantém tudo e não grava à toa', () => {
    const viagem = novaViagem();
    const persistencia = criarPersistenciaMemoria([viagem]);
    let chamadasSalvar = 0;
    const persistenciaEspiada = {
      carregar: () => persistencia.carregar(),
      salvar: (viagens: readonly Viagem[]) => {
        chamadasSalvar += 1;
        persistencia.salvar(viagens);
      },
    };

    const repositorio = criarRepositorioViagens({
      persistencia: persistenciaEspiada,
      droneIds: ['drone-1'],
    });

    expect(repositorio.listar()).toEqual([viagem]);
    expect(repositorio.pedidoIdsOrfaos()).toEqual([]);
    expect(chamadasSalvar).toBe(0);
  });
});
