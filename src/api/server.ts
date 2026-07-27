import express, { type Express } from 'express';
import { rotaNaoEncontrada, tratarErros } from './middleware-erros.js';
import { criarRotasPedidos } from './rotas/pedidos.js';
import { criarRotasDrones } from './rotas/drones.js';
import { criarRotasEntregas } from './rotas/entregas.js';
import { criarRotasSimulacao } from './rotas/simulacao.js';
import type { RepositorioPedidos } from '../repositorio/pedidos.js';
import type { RepositorioFrota } from '../repositorio/frota.js';
import type { RepositorioViagens } from '../repositorio/viagens.js';
import type { ServicoSimulacao } from '../servicos/simulacao.js';
import type { MapaCidade } from '../domain/mapa.js';

/**
 * Repositórios e serviços injetados na aplicação. Um objeto — em vez de
 * parâmetros posicionais — para que blocos futuros acrescentem dependências
 * sem virar mais um parâmetro solto.
 */
export type Dependencias = {
  readonly pedidos: RepositorioPedidos;
  readonly frota: RepositorioFrota;
  readonly viagens: RepositorioViagens;
  readonly simulacao: ServicoSimulacao;
  readonly mapa: MapaCidade;
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
  app.use(
    '/entregas',
    criarRotasEntregas({
      pedidos: dependencias.pedidos,
      frota: dependencias.frota,
      viagens: dependencias.viagens,
      simulacao: dependencias.simulacao,
      mapa: dependencias.mapa,
    }),
  );
  app.use('/simulacao', criarRotasSimulacao(dependencias.simulacao));

  // 404 de rota inexistente e middleware de erro sempre por último (a ordem importa no Express).
  app.use(rotaNaoEncontrada);
  app.use(tratarErros);

  return app;
}
