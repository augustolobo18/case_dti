/**
 * Erro tipado da camada de persistência.
 * Não é um `ErroDominio`: não representa violação de regra de negócio, e sim
 * falha de infraestrutura (arquivo corrompido, forma inválida). Manter
 * `CodigoErroDominio` livre de preocupações de I/O.
 */
export class ErroPersistencia extends Error {
  constructor(
    mensagem: string,
    readonly causa?: unknown,
  ) {
    super(mensagem);
    this.name = 'ErroPersistencia';

    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, ErroPersistencia);
    }
  }
}
