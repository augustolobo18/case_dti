import { Router } from 'express';
import { config } from '../../config.js';
import { criarPedido } from '../../domain/pedido.js';
import type { MapaCidade } from '../../domain/mapa.js';
import { montarRastreio } from '../../domain/rastreio.js';
import type { RepositorioPedidos } from '../../repositorio/pedidos.js';
import type { RepositorioFrota } from '../../repositorio/frota.js';
import type { RepositorioViagens } from '../../repositorio/viagens.js';
import { schemaFiltrosPedido, schemaNovoPedido } from '../schemas/pedido.js';

/** Dependências das rotas de pedido (E1-1/E1-2/E1-3/E6-2). */
export type DependenciasPedidos = {
  readonly pedidos: RepositorioPedidos;
  readonly viagens: RepositorioViagens;
  readonly frota: RepositorioFrota;
  readonly mapa: MapaCidade;
};

/**
 * Cria as rotas de pedido (E1-1/E1-2/E1-3/E6-2), casca fina sobre o domínio e
 * os repositórios recebidos por parâmetro (nunca importados de um singleton).
 */
export function criarRotasPedidos(dependencias: DependenciasPedidos): Router {
  const { pedidos, viagens, frota, mapa } = dependencias;
  const router = Router();

  router.post('/', (req, res, next) => {
    try {
      const dados = schemaNovoPedido.parse(req.body);
      const pedido = criarPedido(dados, {
        limites: { capacidadeKg: config.droneCapacidadeKg, cidadeTamanho: config.cidadeTamanho },
      });
      const pedidoSalvo = pedidos.adicionar(pedido);
      res.status(201).json(pedidoSalvo);
    } catch (erro) {
      next(erro);
    }
  });

  router.get('/', (req, res, next) => {
    try {
      const filtros = schemaFiltrosPedido.parse(req.query);
      res.status(200).json(pedidos.listar(filtros));
    } catch (erro) {
      next(erro);
    }
  });

  router.get('/:id', (req, res, next) => {
    try {
      const pedido = pedidos.buscarPorId(req.params.id);
      res.status(200).json(pedido);
    } catch (erro) {
      next(erro);
    }
  });

  router.post('/:id/cancelar', (req, res, next) => {
    try {
      const pedido = pedidos.cancelar(req.params.id);
      res.status(200).json(pedido);
    } catch (erro) {
      next(erro);
    }
  });

  router.get('/:id/rastreio', (req, res, next) => {
    try {
      const pedido = pedidos.buscarPorId(req.params.id);

      const viagem = viagens.listar().find((item) => item.pedidoIds.includes(pedido.id));
      const drone = viagem ? buscarDroneOuIndefinido(frota, viagem.droneId) : undefined;

      const rastreio = montarRastreio({ pedido, drone, mapa });
      res.status(200).json(rastreio);
    } catch (erro) {
      next(erro);
    }
  });

  return router;
}

/**
 * Busca o drone da viagem sem falhar a rota — a rota de rastreio é leitura
 * para o cliente final; um drone que sumiu da frota entre o boot e a
 * consulta degrada para "sem drone", nunca em erro (mesmo espírito de
 * `montarRastreio`).
 */
function buscarDroneOuIndefinido(
  frota: RepositorioFrota,
  droneId: string,
): ReturnType<RepositorioFrota['buscarPorId']> | undefined {
  try {
    return frota.buscarPorId(droneId);
  } catch {
    return undefined;
  }
}
