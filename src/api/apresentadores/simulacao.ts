import type { EventoSimulacao, MetricasSimulacao } from '../../domain/simulacao.js';

/** Payload de resposta de um evento da simulação (E4-1/E4-2): espelha o domínio, sem campos derivados. */
export type RespostaEvento = EventoSimulacao;

/** Payload de resposta das métricas da simulação (E4-2): espelha o domínio, sem campos derivados. */
export type RespostaMetricas = MetricasSimulacao;

/** Converte um `EventoSimulacao` do domínio na resposta da API. */
export function paraRespostaEvento(evento: EventoSimulacao): RespostaEvento {
  return evento;
}

/** Converte as `MetricasSimulacao` do domínio na resposta da API. */
export function paraRespostaMetricas(metricas: MetricasSimulacao): RespostaMetricas {
  return metricas;
}
