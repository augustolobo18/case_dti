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
    status: 'planejada',
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

  describe('emLote — modo de lote (D43)', () => {
    function repositorioEspiado(inicial: Viagem[] = [novaViagem()]) {
      const persistencia = criarPersistenciaMemoria(inicial);
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
      return { repositorio, contador: () => chamadasSalvar };
    }

    it('duas chamadas de substituirTodas dentro de emLote geram 1 salvar; fora dele, 2', () => {
      const { repositorio, contador } = repositorioEspiado();

      repositorio.emLote(() => {
        repositorio.substituirTodas([novaViagem({ id: 'v1' })]);
        repositorio.substituirTodas([novaViagem({ id: 'v2' })]);
      });
      expect(contador()).toBe(1);

      repositorio.substituirTodas([novaViagem({ id: 'v3' })]);
      repositorio.substituirTodas([novaViagem({ id: 'v4' })]);
      expect(contador()).toBe(3);
    });

    it('leitura dentro do lote enxerga a mutação anterior (memória imediata)', () => {
      const { repositorio } = repositorioEspiado();

      repositorio.emLote(() => {
        repositorio.substituirTodas([novaViagem({ id: 'v1' })]);
        expect(repositorio.listar()).toEqual([novaViagem({ id: 'v1' })]);
      });
    });

    it('emLote que lança propaga a exceção e ainda assim grava uma vez (finally)', () => {
      const { repositorio, contador } = repositorioEspiado();

      expect.assertions(2);
      try {
        repositorio.emLote(() => {
          repositorio.substituirTodas([novaViagem({ id: 'v1' })]);
          throw new Error('falha proposital dentro do lote');
        });
      } catch (erro) {
        expect((erro as Error).message).toBe('falha proposital dentro do lote');
      }
      expect(contador()).toBe(1);
    });

    it('emLote aninhado só grava no lote mais externo', () => {
      const { repositorio, contador } = repositorioEspiado();

      repositorio.emLote(() => {
        repositorio.substituirTodas([novaViagem({ id: 'v1' })]);
        repositorio.emLote(() => {
          repositorio.substituirTodas([novaViagem({ id: 'v2' })]);
        });
      });

      expect(contador()).toBe(1);
    });

    it('emLote sem nenhuma mutação não grava nada', () => {
      const { repositorio, contador } = repositorioEspiado();

      repositorio.emLote(() => {
        repositorio.listar();
      });

      expect(contador()).toBe(0);
    });
  });
});
