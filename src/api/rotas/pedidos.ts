import { Router } from 'express';
import { config } from '../../config.js';
import { criarPedido } from '../../domain/pedido.js';
import type { RepositorioPedidos } from '../../repositorio/pedidos.js';
import { schemaFiltrosPedido, schemaNovoPedido } from '../schemas/pedido.js';

/**
 * Cria as rotas de pedido (E1-1/E1-2/E1-3), casca fina sobre o domínio e o
 * repositório recebido por parâmetro (nunca importado de um singleton).
 */
export function criarRotasPedidos(repositorio: RepositorioPedidos): Router {
  const router = Router();

  router.post('/', (req, res, next) => {
    try {
      const dados = schemaNovoPedido.parse(req.body);
      const pedido = criarPedido(dados, {
        limites: { capacidadeKg: config.droneCapacidadeKg, cidadeTamanho: config.cidadeTamanho },
      });
      const pedidoSalvo = repositorio.adicionar(pedido);
      res.status(201).json(pedidoSalvo);
    } catch (erro) {
      next(erro);
    }
  });

  router.get('/', (req, res, next) => {
    try {
      const filtros = schemaFiltrosPedido.parse(req.query);
      res.status(200).json(repositorio.listar(filtros));
    } catch (erro) {
      next(erro);
    }
  });

  router.get('/:id', (req, res, next) => {
    try {
      const pedido = repositorio.buscarPorId(req.params.id);
      res.status(200).json(pedido);
    } catch (erro) {
      next(erro);
    }
  });

  router.post('/:id/cancelar', (req, res, next) => {
    try {
      const pedido = repositorio.cancelar(req.params.id);
      res.status(200).json(pedido);
    } catch (erro) {
      next(erro);
    }
  });

  return router;
}
