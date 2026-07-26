import { z } from 'zod';

/** Schema de uma coordenada `{ x, y }` — inteiros, sem depender do tamanho da malha. */
const schemaCoordenada = z.object({
  x: z.number({ invalid_type_error: 'x deve ser um número' }).int('x deve ser um número inteiro'),
  y: z.number({ invalid_type_error: 'y deve ser um número' }).int('y deve ser um número inteiro'),
});

/**
 * Valida a forma de uma `Viagem` já persistida (lida de `data/viagens.json`).
 * Espelha `schema-pedido.ts`: descreve o dado já processado pelo domínio, sem
 * reescrever literais que já existem em `viagem.ts`.
 */
export const schemaViagemPersistida = z.object({
  id: z
    .string({
      required_error: 'id é obrigatório',
      invalid_type_error: 'id deve ser uma string',
    })
    .min(1, 'id não pode ser vazio'),
  droneId: z
    .string({
      required_error: 'droneId é obrigatório',
      invalid_type_error: 'droneId deve ser uma string',
    })
    .min(1, 'droneId não pode ser vazio'),
  pedidoIds: z.array(z.string().min(1, 'pedidoIds não pode conter string vazia')),
  paradas: z.array(schemaCoordenada).min(1, 'paradas deve ter ao menos a base'),
  distanciaQuadras: z
    .number({ invalid_type_error: 'distanciaQuadras deve ser um número' })
    .nonnegative('distanciaQuadras não pode ser negativa'),
  cargaKg: z
    .number({ invalid_type_error: 'cargaKg deve ser um número' })
    .nonnegative('cargaKg não pode ser negativa'),
});

/** Schema do arquivo inteiro: um array de viagens persistidas. */
export const schemaArquivoViagens = z.array(schemaViagemPersistida);
