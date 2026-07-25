import express, { type Express } from 'express';
import { rotaNaoEncontrada, tratarErros } from './middleware-erros.js';
import { criarRotasPedidos } from './rotas/pedidos.js';
import type { RepositorioPedidos } from '../repositorio/pedidos.js';

/**
 * Cria e configura a aplicação Express.
 * Mantida como casca fina sobre o domínio: rotas apenas traduzem HTTP <-> domínio.
 */
export function criarApp(repositorio: RepositorioPedidos): Express {
  const app = express();

  app.use(express.json());

  // Health-check — verifica se o serviço está de pé.
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', servico: 'drone-delivery' });
  });

  app.use('/pedidos', criarRotasPedidos(repositorio));

  // TODO: GET /entregas/rota, GET /drones/status

  // 404 de rota inexistente e middleware de erro sempre por último (a ordem importa no Express).
  app.use(rotaNaoEncontrada);
  app.use(tratarErros);

  return app;
}
