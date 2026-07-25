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
});
