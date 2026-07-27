import { Router } from 'express';
import { config } from '../../config.js';
import { alocarPedidos } from '../../domain/alocacao.js';
import type { MapaCidade } from '../../domain/mapa.js';
import type { RepositorioPedidos } from '../../repositorio/pedidos.js';
import type { RepositorioFrota } from '../../repositorio/frota.js';
import type { RepositorioViagens } from '../../repositorio/viagens.js';
import type { ServicoSimulacao } from '../../servicos/simulacao.js';
import { paraRespostaViagem } from '../apresentadores/viagem.js';
import { schemaFiltrosViagem } from '../schemas/simulacao.js';

/** Dependências das rotas de entrega. */
export type DependenciasEntregas = {
  readonly pedidos: RepositorioPedidos;
  readonly frota: RepositorioFrota;
  readonly viagens: RepositorioViagens;
  readonly simulacao: ServicoSimulacao;
  readonly mapa: MapaCidade;
};

/**
 * Cria as rotas de entrega (E3-1/E3-2/E3-3/E4), casca fina sobre o domínio,
 * os repositórios e o serviço de simulação recebidos por parâmetro.
 */
export function criarRotasEntregas(dependencias: DependenciasEntregas): Router {
  const { pedidos, frota, viagens, simulacao, mapa } = dependencias;
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
        mapa,
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

      // Recomputa a linha do tempo e zera o relógio (D13/D33): a simulação
      // reflete só as viagens ainda não concluídas.
      simulacao.recomputar();

      res.status(201).json({
        viagens: resultado.viagens.map((viagem) => paraRespostaViagem(viagem)),
        naoAlocados: resultado.naoAlocados,
      });
    } catch (erro) {
      next(erro);
    }
  });

  router.get('/rota', (req, res, next) => {
    try {
      const filtros = schemaFiltrosViagem.parse(req.query);
      const todas = viagens.listar();
      const filtradas =
        filtros.status === undefined
          ? todas
          : todas.filter((viagem) => viagem.status === filtros.status);
      // Opt-in por design (D40): o caminho só entra quando pedido
      // explicitamente, para não inflar o payload padrão de todo consumidor.
      const opcoesResposta = filtros.caminho === 'true' ? { mapa } : undefined;
      res.status(200).json(filtradas.map((viagem) => paraRespostaViagem(viagem, opcoesResposta)));
    } catch (erro) {
      next(erro);
    }
  });

  router.delete('/concluidas', (_req, res, next) => {
    try {
      const todas = viagens.listar();
      const restantes = todas.filter((viagem) => viagem.status !== 'concluida');
      const removidas = todas.length - restantes.length;
      viagens.substituirTodas(restantes);
      res.status(200).json({ removidas });
    } catch (erro) {
      next(erro);
    }
  });

  return router;
}
