import express, { type Express } from 'express';

/**
 * Cria e configura a aplicação Express.
 * Mantida como casca fina sobre o domínio: rotas apenas traduzem HTTP <-> domínio.
 */
export function criarApp(): Express {
  const app = express();

  app.use(express.json());

  // Health-check — verifica se o serviço está de pé.
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', servico: 'drone-delivery' });
  });

  // TODO: POST /pedidos, GET /entregas/rota, GET /drones/status

  return app;
}
