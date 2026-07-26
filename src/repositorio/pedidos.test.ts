import { describe, it, expect } from 'vitest';
import { ErroDominio } from '../domain/erros.js';
import { criarPedido, type LimitesPedido } from '../domain/pedido.js';
import { criarPersistenciaMemoria } from '../infra/persistencia-pedidos.js';
import { criarRepositorioPedidos } from './pedidos.js';

const LIMITES: LimitesPedido = { capacidadeKg: 10, cidadeTamanho: 10 };
let contador = 0;
const gerarId = () => `id-${(contador += 1)}`;

function novoPedido(
  dados: Partial<{ x: number; y: number; pesoKg: number; prioridade: string }> = {},
) {
  return criarPedido(
    {
      x: dados.x ?? 0,
      y: dados.y ?? 0,
      pesoKg: dados.pesoKg ?? 1,
      prioridade: dados.prioridade ?? 'baixa',
    },
    { limites: LIMITES, gerarId },
  );
}

describe('criarRepositorioPedidos', () => {
  it('cadastra e lista os pedidos', () => {
    const repositorio = criarRepositorioPedidos(criarPersistenciaMemoria());
    const pedido = novoPedido();

    repositorio.adicionar(pedido);

    expect(repositorio.listar()).toEqual([pedido]);
  });

  it('devolve lista vazia quando não há pedidos', () => {
    const repositorio = criarRepositorioPedidos(criarPersistenciaMemoria());
    expect(repositorio.listar()).toEqual([]);
  });

  it('filtra por status', () => {
    const repositorio = criarRepositorioPedidos(criarPersistenciaMemoria());
    const pendente = novoPedido();
    const cancelado = novoPedido();
    repositorio.adicionar(pendente);
    repositorio.adicionar(cancelado);
    repositorio.cancelar(cancelado.id);

    expect(repositorio.listar({ status: 'pendente' })).toEqual([pendente]);
    expect(repositorio.listar({ status: 'cancelado' }).map((p) => p.id)).toEqual([cancelado.id]);
  });

  it('filtra por prioridade', () => {
    const repositorio = criarRepositorioPedidos(criarPersistenciaMemoria());
    const alta = novoPedido({ prioridade: 'alta' });
    const baixa = novoPedido({ prioridade: 'baixa' });
    repositorio.adicionar(alta);
    repositorio.adicionar(baixa);

    expect(repositorio.listar({ prioridade: 'alta' })).toEqual([alta]);
  });

  it('combina filtros de status e prioridade', () => {
    const repositorio = criarRepositorioPedidos(criarPersistenciaMemoria());
    const altaPendente = novoPedido({ prioridade: 'alta' });
    const altaCancelada = novoPedido({ prioridade: 'alta' });
    const baixaPendente = novoPedido({ prioridade: 'baixa' });
    repositorio.adicionar(altaPendente);
    repositorio.adicionar(altaCancelada);
    repositorio.adicionar(baixaPendente);
    repositorio.cancelar(altaCancelada.id);

    expect(repositorio.listar({ status: 'pendente', prioridade: 'alta' })).toEqual([altaPendente]);
  });

  it('lança PEDIDO_NAO_ENCONTRADO ao buscar id inexistente', () => {
    expect.assertions(2);
    const repositorio = criarRepositorioPedidos(criarPersistenciaMemoria());

    try {
      repositorio.buscarPorId('id-inexistente');
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroDominio);
      expect((erro as ErroDominio).codigo).toBe('PEDIDO_NAO_ENCONTRADO');
    }
  });

  it('cancela um pedido pendente', () => {
    const repositorio = criarRepositorioPedidos(criarPersistenciaMemoria());
    const pedido = novoPedido();
    repositorio.adicionar(pedido);

    const cancelado = repositorio.cancelar(pedido.id);

    expect(cancelado.status).toBe('cancelado');
    expect(repositorio.buscarPorId(pedido.id).status).toBe('cancelado');
  });

  it('lança PEDIDO_NAO_ENCONTRADO ao cancelar id inexistente', () => {
    expect.assertions(2);
    const repositorio = criarRepositorioPedidos(criarPersistenciaMemoria());

    try {
      repositorio.cancelar('id-inexistente');
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroDominio);
      expect((erro as ErroDominio).codigo).toBe('PEDIDO_NAO_ENCONTRADO');
    }
  });

  it('persiste o cancelamento: novo repositório sobre a mesma persistência enxerga o estado', () => {
    const persistencia = criarPersistenciaMemoria();
    const repositorio1 = criarRepositorioPedidos(persistencia);
    const pedido = novoPedido();
    repositorio1.adicionar(pedido);
    repositorio1.cancelar(pedido.id);

    const repositorio2 = criarRepositorioPedidos(persistencia);

    expect(repositorio2.buscarPorId(pedido.id).status).toBe('cancelado');
  });

  it('pedido cancelado não aparece em listar({ status: "pendente" })', () => {
    const repositorio = criarRepositorioPedidos(criarPersistenciaMemoria());
    const pedido = novoPedido();
    repositorio.adicionar(pedido);
    repositorio.cancelar(pedido.id);

    expect(repositorio.listar({ status: 'pendente' })).toEqual([]);
  });

  it('marcarComoAlocados muda os status e grava uma vez só', () => {
    const persistencia = criarPersistenciaMemoria();
    let chamadasSalvar = 0;
    const persistenciaEspiada = {
      carregar: () => persistencia.carregar(),
      salvar: (pedidosParaSalvar: readonly ReturnType<typeof novoPedido>[]) => {
        chamadasSalvar += 1;
        persistencia.salvar([...pedidosParaSalvar]);
      },
    };
    const repositorio = criarRepositorioPedidos(persistenciaEspiada);
    const a = novoPedido();
    const b = novoPedido();
    repositorio.adicionar(a);
    repositorio.adicionar(b);
    chamadasSalvar = 0;

    const resultado = repositorio.marcarComoAlocados([a.id, b.id]);

    expect(resultado.every((p) => p.status === 'alocado')).toBe(true);
    expect(repositorio.buscarPorId(a.id).status).toBe('alocado');
    expect(repositorio.buscarPorId(b.id).status).toBe('alocado');
    expect(chamadasSalvar).toBe(1);
  });

  it('marcarComoAlocados com id inexistente lança PEDIDO_NAO_ENCONTRADO sem gravar nada', () => {
    expect.assertions(3);
    const repositorio = criarRepositorioPedidos(criarPersistenciaMemoria());
    const a = novoPedido();
    repositorio.adicionar(a);

    try {
      repositorio.marcarComoAlocados([a.id, 'id-inexistente']);
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroDominio);
      expect((erro as ErroDominio).codigo).toBe('PEDIDO_NAO_ENCONTRADO');
      expect(repositorio.buscarPorId(a.id).status).toBe('pendente');
    }
  });

  it('reverterParaPendente desfaz a alocação em lote', () => {
    const repositorio = criarRepositorioPedidos(criarPersistenciaMemoria());
    const a = novoPedido();
    const b = novoPedido();
    repositorio.adicionar(a);
    repositorio.adicionar(b);
    repositorio.marcarComoAlocados([a.id, b.id]);

    const resultado = repositorio.reverterParaPendente([a.id, b.id]);

    expect(resultado.every((p) => p.status === 'pendente')).toBe(true);
    expect(repositorio.buscarPorId(a.id).status).toBe('pendente');
  });
});
