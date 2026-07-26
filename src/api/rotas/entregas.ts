import { Router } from 'express';
import { config } from '../../config.js';
import { alocarPedidos } from '../../domain/alocacao.js';
import type { RepositorioPedidos } from '../../repositorio/pedidos.js';
import type { RepositorioFrota } from '../../repositorio/frota.js';
import type { RepositorioViagens } from '../../repositorio/viagens.js';
import { paraRespostaViagem } from '../apresentadores/viagem.js';

/** Dependências das rotas de entrega. */
export type DependenciasEntregas = {
  readonly pedidos: RepositorioPedidos;
  readonly frota: RepositorioFrota;
  readonly viagens: RepositorioViagens;
};

/**
 * Cria as rotas de entrega (E3-1/E3-2/E3-3), casca fina sobre o domínio e os
 * repositórios recebidos por parâmetro. Sem schema Zod: nenhuma das duas
 * rotas recebe corpo ou query.
 */
export function criarRotasEntregas(dependencias: DependenciasEntregas): Router {
  const { pedidos, frota, viagens } = dependencias;
  const router = Router();

  router.post('/alocar', (_req, res, next) => {
    try {
      const pendentes = pedidos.listar({ status: 'pendente' });
      const droneIds = frota.listar().map((drone) => drone.id);

      const resultado = alocarPedidos({
        pedidos: pendentes,
        droneIds,
        base: config.base,
        capacidadeKg: config.droneCapacidadeKg,
        alcanceQuadras: config.droneAlcanceQuadras,
      });

      // Grava os pedidos antes das viagens (ver risco em DECISIONS/D26): uma
      // falha entre as duas gravações deixa o estado recuperável (pedido
      // "alocado" sem viagem), que a reconciliação do boot já sabe desfazer.
      const idsAlocados = resultado.viagens.flatMap((viagem) => viagem.pedidoIds);
      if (idsAlocados.length > 0) {
        pedidos.marcarComoAlocados(idsAlocados);
      }

      if (resultado.viagens.length > 0) {
        viagens.substituirTodas([...viagens.listar(), ...resultado.viagens]);
      }

      res.status(201).json({
        viagens: resultado.viagens.map(paraRespostaViagem),
        naoAlocados: resultado.naoAlocados,
      });
    } catch (erro) {
      next(erro);
    }
  });

  router.get('/rota', (_req, res, next) => {
    try {
      res.status(200).json(viagens.listar().map(paraRespostaViagem));
    } catch (erro) {
      next(erro);
    }
  });

  return router;
}
