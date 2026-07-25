import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { ErroDominio } from '../domain/erros.js';
import { corpoErro, statusHttpDe } from './erros.js';

/** Handler de rota inexistente — devolve 404 no mesmo envelope padronizado (E7-1). */
export function rotaNaoEncontrada(req: Request, res: Response): void {
  res
    .status(404)
    .json(
      corpoErro('ROTA_NAO_ENCONTRADA', `Rota não encontrada: ${req.method} ${req.originalUrl}.`),
    );
}

/**
 * Middleware central de erro (D20). Traduz `ErroDominio` para o status HTTP
 * mapeado, `ZodError` para 400 com os campos/motivos em `detalhes`, e
 * qualquer outro erro para 500 com mensagem genérica (sem vazar stack).
 */
export function tratarErros(
  erro: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- assinatura de 4 args exigida pelo Express p/ reconhecer error handler
  _next: NextFunction,
): void {
  if (erro instanceof ErroDominio) {
    res.status(statusHttpDe(erro.codigo)).json(corpoErro(erro.codigo, erro.message));
    return;
  }

  if (erro instanceof ZodError) {
    res.status(400).json(
      corpoErro(
        'REQUISICAO_INVALIDA',
        'Requisição inválida: verifique os campos enviados.',
        erro.issues.map((issue) => ({ campo: issue.path.join('.'), motivo: issue.message })),
      ),
    );
    return;
  }

  res.status(500).json(corpoErro('ERRO_INTERNO', 'Erro interno inesperado.'));
}
