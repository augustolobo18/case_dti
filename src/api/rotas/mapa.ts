import { Router } from 'express';
import { config } from '../../config.js';
import type { MapaCidade } from '../../domain/mapa.js';
import { paraRespostaMapa } from '../apresentadores/mapa.js';

/**
 * Cria a rota de consulta do mapa (E6-3), casca fina sobre o `MapaCidade`
 * recebido por parâmetro. Sem schema Zod: não há corpo nem query a validar.
 * Somente leitura — a base vem de `config.base`, como já fazem
 * `rotas/pedidos.ts` e `rotas/entregas.ts`.
 */
export function criarRotasMapa(mapa: MapaCidade): Router {
  const router = Router();

  router.get('/', (_req, res, next) => {
    try {
      res.status(200).json(paraRespostaMapa(mapa, config.base));
    } catch (erro) {
      next(erro);
    }
  });

  return router;
}
