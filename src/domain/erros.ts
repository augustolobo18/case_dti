/**
 * Erros tipados do domínio.
 * Não faz nenhuma referência a HTTP ou status code — o mapeamento para
 * respostas HTTP é responsabilidade do middleware de erro da API (D20).
 */

/** Códigos possíveis de erro de domínio, um por invariante violada. */
export type CodigoErroDominio =
  | 'COORDENADA_INVALIDA'
  | 'COORDENADA_FORA_DA_MALHA'
  | 'PESO_INVALIDO'
  | 'PESO_ACIMA_CAPACIDADE'
  | 'PRIORIDADE_INVALIDA'
  | 'QUANTIDADE_DRONES_INVALIDA'
  | 'PEDIDO_NAO_ENCONTRADO'
  | 'CANCELAMENTO_NAO_PERMITIDO'
  | 'DRONE_NAO_ENCONTRADO';

/** Erro lançado quando uma regra do domínio é violada. */
export class ErroDominio extends Error {
  readonly codigo: CodigoErroDominio;

  constructor(codigo: CodigoErroDominio, mensagem: string) {
    super(mensagem);
    this.name = 'ErroDominio';
    this.codigo = codigo;

    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, ErroDominio);
    }
  }
}
