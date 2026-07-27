import type { CodigoErroDominio } from '../domain/erros.js';

/** Envelope padronizado de erro da API (D20). */
export type CorpoErro = {
  readonly erro: {
    readonly codigo: string;
    readonly mensagem: string;
    readonly detalhes?: unknown;
  };
};

/**
 * Mapeia um `CodigoErroDominio` para o status HTTP correspondente (D20):
 * 400 = entrada malformada, 422 = entrada válida mas viola regra de negócio,
 * 404 = recurso inexistente. Qualquer código desconhecido cai em 500.
 */
const MAPA_STATUS_HTTP: Record<CodigoErroDominio, number> = {
  COORDENADA_INVALIDA: 400,
  PRIORIDADE_INVALIDA: 400,
  PESO_INVALIDO: 400,
  QUANTIDADE_DRONES_INVALIDA: 400,
  COORDENADA_FORA_DA_MALHA: 422,
  PESO_ACIMA_CAPACIDADE: 422,
  CANCELAMENTO_NAO_PERMITIDO: 422,
  PEDIDO_NAO_ENCONTRADO: 404,
  DRONE_NAO_ENCONTRADO: 404,
  VIAGEM_ACIMA_CAPACIDADE: 422,
  VIAGEM_ACIMA_ALCANCE: 422,
  VIAGEM_SEM_PEDIDOS: 422,
  FROTA_VAZIA: 422,
  ALOCACAO_NAO_PERMITIDA: 422,
  TRANSICAO_INVALIDA: 422,
  BATERIA_INSUFICIENTE: 422,
  ENTREGA_NAO_PERMITIDA: 422,
  AVANCO_INVALIDO: 422,
  EMPACOTAMENTO_INCONSISTENTE: 500,
  DESTINO_BLOQUEADO: 422,
  SEM_ROTA: 422,
  ROTA_IMPOSSIVEL: 500,
  VIAGEM_INCONSISTENTE: 500,
};

/** Devolve o status HTTP para o código de erro de domínio informado (default 500). */
export function statusHttpDe(codigo: CodigoErroDominio): number {
  return MAPA_STATUS_HTTP[codigo] ?? 500;
}

/** Monta o envelope de erro padronizado `{ erro: { codigo, mensagem, detalhes? } }`. */
export function corpoErro(codigo: string, mensagem: string, detalhes?: unknown): CorpoErro {
  return { erro: { codigo, mensagem, detalhes } };
}
