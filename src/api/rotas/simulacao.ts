import { Router } from 'express';
import { ErroDominio } from '../../domain/erros.js';
import type { ServicoSimulacao } from '../../servicos/simulacao.js';
import { paraRespostaEvento, paraRespostaMetricas } from '../apresentadores/simulacao.js';
import { schemaAvancoSimulacao, schemaFiltrosEventos } from '../schemas/simulacao.js';

/**
 * Cria as rotas de simulação (E4), casca fina sobre o serviço recebido por
 * parâmetro. `POST /avancar` valida a forma do corpo com Zod; a regra do
 * relógio (só avança para frente) é do serviço/domínio (D23).
 */
export function criarRotasSimulacao(simulacao: ServicoSimulacao): Router {
  const router = Router();

  router.get('/', (_req, res, next) => {
    try {
      const linha = simulacao.linhaDoTempo();
      res.status(200).json({
        instanteAtual: simulacao.instanteAtual(),
        metricas: paraRespostaMetricas(linha.metricas),
      });
    } catch (erro) {
      next(erro);
    }
  });

  router.post('/avancar', (req, res, next) => {
    try {
      const dados = schemaAvancoSimulacao.parse(req.body);
      const alvo =
        dados.ateInstante !== undefined
          ? dados.ateInstante
          : simulacao.instanteAtual() + (dados.minutos ?? 0);

      if (dados.ateInstante === undefined && dados.minutos === undefined) {
        // Inalcançável: o schema já garante exatamente um dos dois definido.
        throw new ErroDominio('AVANCO_INVALIDO', 'Informe "ateInstante" ou "minutos".');
      }

      const resultado = simulacao.avancarPara(alvo);
      res.status(200).json({
        instanteAtual: resultado.instanteAtual,
        eventosAplicados: resultado.eventosAplicados.map(paraRespostaEvento),
      });
    } catch (erro) {
      next(erro);
    }
  });

  router.get('/eventos', (req, res, next) => {
    try {
      const filtros = schemaFiltrosEventos.parse(req.query);
      const eventos = simulacao
        .linhaDoTempo()
        .eventos.filter(
          (evento) => filtros.desde === undefined || evento.instanteMin >= filtros.desde,
        )
        .filter((evento) => filtros.ate === undefined || evento.instanteMin <= filtros.ate)
        .map(paraRespostaEvento);
      res.status(200).json(eventos);
    } catch (erro) {
      next(erro);
    }
  });

  return router;
}
