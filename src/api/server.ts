import express, { type Express } from 'express';
import { rotaNaoEncontrada, tratarErros } from './middleware-erros.js';
import { criarRotasPedidos } from './rotas/pedidos.js';
import { criarRotasDrones } from './rotas/drones.js';
import type { RepositorioPedidos } from '../repositorio/pedidos.js';
import type { RepositorioFrota } from '../repositorio/frota.js';

/**
 * Repositórios injetados na aplicação. Um objeto — em vez de parâmetros
 * posicionais — para que blocos futuros (ex.: viagens no Bloco 4) acrescentem
 * dependências sem virar mais um parâmetro solto.
 */
export type Dependencias = {
  readonly pedidos: RepositorioPedidos;
  readonly frota: RepositorioFrota;
};

/**
 * Cria e configura a aplicação Express.
 * Mantida como casca fina sobre o domínio: rotas apenas traduzem HTTP <-> domínio.
 */
export function criarApp(dependencias: Dependencias): Express {
  const app = express();

  app.use(express.json());

  // Health-check — verifica se o serviço está de pé.
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', servico: 'drone-delivery' });
  });

  app.use('/pedidos', criarRotasPedidos(dependencias.pedidos));
  app.use('/drones', criarRotasDrones(dependencias.frota));

  // TODO: GET /entregas/rota

  // 404 de rota inexistente e middleware de erro sempre por último (a ordem importa no Express).
  app.use(rotaNaoEncontrada);
  app.use(tratarErros);

  return app;
}
