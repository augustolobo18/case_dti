import { ErroDominio } from '../domain/erros.js';
import {
  alocarPedido,
  cancelarPedido,
  despacharPedido,
  entregarPedido,
  reverterParaPendente as reverterPedidoParaPendente,
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
  marcarComoAlocados(ids: readonly string[]): Pedido[];
  reverterParaPendente(ids: readonly string[]): Pedido[];
  despachar(ids: readonly string[]): Pedido[];
  entregar(ids: readonly string[]): Pedido[];
  /**
   * Executa `fn` em modo de lote (D43): mutações dentro de `fn` continuam
   * mudando a memória imediatamente, mas a gravação em disco é adiada para o
   * fim de `fn` — uma única chamada a `salvar`, em vez de uma por mutação.
   * Reentrante: só o lote mais externo grava. Se `fn` lançar, a exceção
   * propaga e o progresso mutado até ali ainda é gravado (`finally`).
   */
  emLote<T>(fn: () => T): T;
};

/**
 * Cria o repositório de pedidos sobre uma porta de persistência (D6).
 * Carrega o estado inicial uma única vez e mantém a lista em memória,
 * gravando a cada mutação. Nenhuma regra de negócio é duplicada aqui —
 * o cancelamento delega a `cancelarPedido` do domínio.
 *
 * **Premissa: o processo é dono único do arquivo.** O estado é lido uma
 * única vez no boot; uma edição externa ao arquivo com o servidor de pé é
 * ignorada em memória e sobrescrita na próxima gravação. Decisão consciente:
 * reler a cada operação anularia o design em memória para cobrir um cenário
 * que não existe num simulador de processo único. Deixaria de valer se
 * houvesse mais de uma instância do processo compartilhando o mesmo arquivo.
 */
export function criarRepositorioPedidos(persistencia: PersistenciaPedidos): RepositorioPedidos {
  let pedidos: Pedido[] = persistencia.carregar();
  let adiandoGravacao = false;
  let sujo = false;

  function buscarPorId(id: string): Pedido {
    const pedido = pedidos.find((item) => item.id === id);
    if (!pedido) {
      throw new ErroDominio('PEDIDO_NAO_ENCONTRADO', `Pedido não encontrado: id="${id}".`);
    }
    return pedido;
  }

  /**
   * Ponto único de gravação (D43): fora de `emLote`, grava imediatamente
   * (write-through de sempre); dentro, só marca `sujo` e adia — quem grava é
   * o `emLote` mais externo, no `finally`.
   */
  function persistir(): void {
    if (adiandoGravacao) {
      sujo = true;
      return;
    }
    persistencia.salvar(pedidos);
  }

  function emLote<T>(fn: () => T): T {
    if (adiandoGravacao) {
      // Reentrante: só o lote mais externo grava.
      return fn();
    }
    adiandoGravacao = true;
    try {
      return fn();
    } finally {
      adiandoGravacao = false;
      if (sujo) {
        sujo = false;
        persistencia.salvar(pedidos);
      }
    }
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
      persistir();
      return pedido;
    },

    cancelar(id: string): Pedido {
      const pedido = buscarPorId(id);
      const cancelado = cancelarPedido(pedido);
      pedidos = pedidos.map((item) => (item.id === id ? cancelado : item));
      persistir();
      return cancelado;
    },

    marcarComoAlocados(ids: readonly string[]): Pedido[] {
      return mutarEmLote(ids, alocarPedido);
    },

    reverterParaPendente(ids: readonly string[]): Pedido[] {
      return mutarEmLote(ids, reverterPedidoParaPendente);
    },

    despachar(ids: readonly string[]): Pedido[] {
      return mutarEmLote(ids, despacharPedido);
    },

    entregar(ids: readonly string[]): Pedido[] {
      return mutarEmLote(ids, entregarPedido);
    },

    emLote,
  };

  /**
   * Aplica `transformar` a cada pedido de `ids`, validando todos os ids
   * **antes** de mutar qualquer um (atômico), e grava a persistência uma
   * única vez. Nenhuma regra de negócio é duplicada — a transição em si
   * delega ao domínio (`alocarPedido`/`reverterParaPendente`).
   */
  function mutarEmLote(ids: readonly string[], transformar: (pedido: Pedido) => Pedido): Pedido[] {
    const alvos = ids.map((id) => buscarPorId(id));
    const transformados = alvos.map(transformar);

    const porId = new Map(transformados.map((pedido) => [pedido.id, pedido]));
    pedidos = pedidos.map((item) => porId.get(item.id) ?? item);
    persistir();

    return transformados;
  }
}
