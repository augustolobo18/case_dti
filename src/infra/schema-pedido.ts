import { z } from 'zod';
import { PRIORIDADES, STATUS_PEDIDO } from '../domain/pedido.js';

/**
 * Valida a forma de um `Pedido` já persistido (lido de `data/pedidos.json`).
 * Diferente do schema de payload da API (`schemaNovoPedido`), que valida uma
 * entrada frouxa ainda não processada pelo domínio (D23), este descreve um
 * pedido que já passou pelo domínio: tem `id`, tem `status`, e `prioridade`
 * só admite os valores canônicos — vindos de `PRIORIDADES` e `STATUS_PEDIDO`,
 * nunca duplicados como literais (D22).
 */
export const schemaPedidoPersistido = z.object({
  id: z
    .string({
      required_error: 'id é obrigatório',
      invalid_type_error: 'id deve ser uma string',
    })
    .min(1, 'id não pode ser vazio'),
  destino: z.object({
    x: z
      .number({ invalid_type_error: 'destino.x deve ser um número' })
      .int('destino.x deve ser um número inteiro'),
    y: z
      .number({ invalid_type_error: 'destino.y deve ser um número' })
      .int('destino.y deve ser um número inteiro'),
  }),
  pesoKg: z
    .number({ invalid_type_error: 'pesoKg deve ser um número' })
    .positive('pesoKg deve ser maior que zero'),
  prioridade: z.enum(PRIORIDADES, {
    errorMap: () => ({ message: `prioridade deve ser uma de: ${PRIORIDADES.join(', ')}` }),
  }),
  status: z.enum(STATUS_PEDIDO, {
    errorMap: () => ({ message: `status deve ser um de: ${STATUS_PEDIDO.join(', ')}` }),
  }),
});

/** Schema do arquivo inteiro: um array de pedidos persistidos. */
export const schemaArquivoPedidos = z.array(schemaPedidoPersistido);
