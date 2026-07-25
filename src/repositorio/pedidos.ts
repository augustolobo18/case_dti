import { ErroDominio } from '../domain/erros.js';
import {
  cancelarPedido,
  type Pedido,
  type Prioridade,
  type StatusPedido,
} from '../domain/pedido.js';
import type { PersistenciaPedidos } from '../infra/persistencia-pedidos.js';

/** Filtros combináveis de listagem de pedidos (E1-2). */
export type FiltrosPedido = {
  readonly status?: StatusPedido;
  readonly prioridade?: Prioridade;
};

/** Repositório de pedidos: mantém a lista em memória e persiste a cada mutação (write-through). */
export type RepositorioPedidos = {
  listar(filtros?: FiltrosPedido): Pedido[];
  buscarPorId(id: string): Pedido;
  adicionar(pedido: Pedido): Pedido;
  cancelar(id: string): Pedido;
};

/**
 * Cria o repositório de pedidos sobre uma porta de persistência (D6).
 * Carrega o estado inicial uma única vez e mantém a lista em memória,
 * gravando a cada mutação. Nenhuma regra de negócio é duplicada aqui —
 * o cancelamento delega a `cancelarPedido` do domínio.
 */
export function criarRepositorioPedidos(persistencia: PersistenciaPedidos): RepositorioPedidos {
  let pedidos: Pedido[] = persistencia.carregar();

  function buscarPorId(id: string): Pedido {
    const pedido = pedidos.find((item) => item.id === id);
    if (!pedido) {
      throw new ErroDominio('PEDIDO_NAO_ENCONTRADO', `Pedido não encontrado: id="${id}".`);
    }
    return pedido;
  }

  return {
    listar(filtros?: FiltrosPedido): Pedido[] {
      return pedidos.filter((pedido) => {
        if (filtros?.status !== undefined && pedido.status !== filtros.status) {
          return false;
        }
        if (filtros?.prioridade !== undefined && pedido.prioridade !== filtros.prioridade) {
          return false;
        }
        return true;
      });
    },

    buscarPorId,

    adicionar(pedido: Pedido): Pedido {
      pedidos = [...pedidos, pedido];
      persistencia.salvar(pedidos);
      return pedido;
    },

    cancelar(id: string): Pedido {
      const pedido = buscarPorId(id);
      const cancelado = cancelarPedido(pedido);
      pedidos = pedidos.map((item) => (item.id === id ? cancelado : item));
      persistencia.salvar(pedidos);
      return cancelado;
    },
  };
}
