import { z } from 'zod';
import { PRIORIDADES, STATUS_PEDIDO } from '../../domain/pedido.js';

/**
 * Valida a forma do payload de cadastro (D3): tipos e presença dos campos.
 * De propósito frouxo quanto ao *valor* de `prioridade` — a regra de negócio
 * (valores aceitos, peso e coordenada) é responsabilidade do domínio (D23).
 */
export const schemaNovoPedido = z.object({
  x: z.number({ required_error: 'x é obrigatório', invalid_type_error: 'x deve ser um número' }),
  y: z.number({ required_error: 'y é obrigatório', invalid_type_error: 'y deve ser um número' }),
  pesoKg: z.number({
    required_error: 'pesoKg é obrigatório',
    invalid_type_error: 'pesoKg deve ser um número',
  }),
  prioridade: z.string({
    required_error: 'prioridade é obrigatória',
    invalid_type_error: 'prioridade deve ser uma string',
  }),
});

/** Valida os filtros de listagem, restritos aos valores canônicos dos enums (D22). */
export const schemaFiltrosPedido = z.object({
  status: z.enum(STATUS_PEDIDO).optional(),
  prioridade: z.enum(PRIORIDADES).optional(),
});
