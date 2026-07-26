import { Router } from 'express';
import type { RepositorioFrota } from '../../repositorio/frota.js';
import { paraRespostaDrone } from '../apresentadores/drone.js';

/**
 * Cria as rotas de consulta da frota (E2-2), casca fina sobre o repositório
 * recebido por parâmetro. Sem schema Zod: não há corpo nem query a validar.
 */
export function criarRotasDrones(repositorio: RepositorioFrota): Router {
  const router = Router();

  router.get('/', (_req, res, next) => {
    try {
      const drones = repositorio.listar().map(paraRespostaDrone);
      res.status(200).json(drones);
    } catch (erro) {
      next(erro);
    }
  });

  router.get('/:id', (req, res, next) => {
    try {
      const drone = repositorio.buscarPorId(req.params.id);
      res.status(200).json(paraRespostaDrone(drone));
    } catch (erro) {
      next(erro);
    }
  });

  return router;
}
