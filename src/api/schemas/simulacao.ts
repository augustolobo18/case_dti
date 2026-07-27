import { z } from 'zod';
import { STATUS_VIAGEM } from '../../domain/viagem.js';

/**
 * Valida a forma do corpo de `POST /simulacao/avancar` (D3): exatamente um
 * entre `ateInstante` (absoluto) e `minutos` (relativo ao instante corrente),
 * número finito não negativo. Valida a forma, não a regra — instante
 * retroativo é checado pelo domínio/serviço (`AVANCO_INVALIDO`, D23).
 */
export const schemaAvancoSimulacao = z
  .object({
    ateInstante: z
      .number({ invalid_type_error: 'ateInstante deve ser um número' })
      .finite('ateInstante deve ser um número finito')
      .nonnegative('ateInstante não pode ser negativo')
      .optional(),
    minutos: z
      .number({ invalid_type_error: 'minutos deve ser um número' })
      .finite('minutos deve ser um número finito')
      .nonnegative('minutos não pode ser negativo')
      .optional(),
  })
  .refine((dados) => (dados.ateInstante !== undefined) !== (dados.minutos !== undefined), {
    message: 'Informe exatamente um entre "ateInstante" e "minutos".',
  });

/** Valida o recorte opcional de `GET /simulacao/eventos` por instante (`desde`/`ate`). */
export const schemaFiltrosEventos = z.object({
  desde: z.coerce
    .number({ invalid_type_error: 'desde deve ser um número' })
    .finite('desde deve ser um número finito')
    .optional(),
  ate: z.coerce
    .number({ invalid_type_error: 'ate deve ser um número' })
    .finite('ate deve ser um número finito')
    .optional(),
});

/** Valida o filtro opcional de `GET /entregas/rota` por status da viagem. */
export const schemaFiltrosViagem = z.object({
  status: z.enum(STATUS_VIAGEM).optional(),
});
