import { randomUUID } from 'node:crypto';
import { ErroDominio } from './erros.js';
import { criarCoordenada, type Coordenada } from './coordenada.js';

/** Prioridades possíveis de um pedido, em ordem crescente de urgência. */
export const PRIORIDADES = ['baixa', 'media', 'alta'] as const;
export type Prioridade = (typeof PRIORIDADES)[number];

/** Status do ciclo de vida do pedido, distinto da máquina de estados do drone (D7). */
export const STATUS_PEDIDO = ['pendente', 'alocado', 'em_voo', 'entregue', 'cancelado'] as const;
export type StatusPedido = (typeof STATUS_PEDIDO)[number];

/** Pedido de entrega, imutável. */
export type Pedido = {
  readonly id: string;
  readonly destino: Coordenada;
  readonly pesoKg: number;
  readonly prioridade: Prioridade;
  readonly status: StatusPedido;
};

/** Dados brutos de entrada para o cadastro de um novo pedido (entrada não confiável). */
export type DadosNovoPedido = {
  readonly x: number;
  readonly y: number;
  readonly pesoKg: number;
  readonly prioridade: string;
};

/** Limites operacionais necessários para validar um pedido. */
export type LimitesPedido = {
  readonly capacidadeKg: number;
  readonly cidadeTamanho: number;
};

/** Opções de criação do pedido: limites obrigatórios e gerador de id (injetável nos testes). */
export type OpcoesPedido = {
  readonly limites: LimitesPedido;
  readonly gerarId?: () => string;
};

function ehPrioridadeValida(valor: unknown): valor is Prioridade {
  return PRIORIDADES.includes(valor as Prioridade);
}

/**
 * Cria um `Pedido` validando prioridade, peso e destino (D5).
 * O status inicial é sempre `pendente`.
 */
export function criarPedido(dados: DadosNovoPedido, opcoes: OpcoesPedido): Pedido {
  const { limites, gerarId = randomUUID } = opcoes;

  if (!ehPrioridadeValida(dados.prioridade)) {
    throw new ErroDominio(
      'PRIORIDADE_INVALIDA',
      `Prioridade inválida: "${dados.prioridade}". Valores aceitos: ${PRIORIDADES.join(', ')}.`,
    );
  }

  if (!Number.isFinite(dados.pesoKg) || dados.pesoKg <= 0) {
    throw new ErroDominio(
      'PESO_INVALIDO',
      `Peso inválido: ${dados.pesoKg}kg. O peso deve ser um número finito maior que zero.`,
    );
  }

  if (dados.pesoKg > limites.capacidadeKg) {
    throw new ErroDominio(
      'PESO_ACIMA_CAPACIDADE',
      `Peso de ${dados.pesoKg}kg acima da capacidade do drone (${limites.capacidadeKg}kg).`,
    );
  }

  const destino = criarCoordenada(dados.x, dados.y, limites.cidadeTamanho);

  return {
    id: gerarId(),
    destino,
    pesoKg: dados.pesoKg,
    prioridade: dados.prioridade,
    status: 'pendente',
  };
}

/** Devolve uma nova cópia do pedido com o status alterado, sem mutar o original. */
export function comStatus(pedido: Pedido, status: StatusPedido): Pedido {
  return { ...pedido, status };
}

/**
 * Cancela um pedido, devolvendo uma nova cópia com status `cancelado` (E1-3).
 * Só é permitido cancelar pedido `pendente`; qualquer outro status (incluindo
 * já `cancelado`) lança `CANCELAMENTO_NAO_PERMITIDO`. Função pura, não muta a entrada.
 */
export function cancelarPedido(pedido: Pedido): Pedido {
  if (pedido.status !== 'pendente') {
    throw new ErroDominio(
      'CANCELAMENTO_NAO_PERMITIDO',
      `Pedido ${pedido.id} não pode ser cancelado: está com status "${pedido.status}", ` +
        'só é permitido cancelar pedido "pendente".',
    );
  }

  return comStatus(pedido, 'cancelado');
}

/**
 * Aloca um pedido em uma viagem, devolvendo uma nova cópia com status
 * `alocado` (E3-1). Só é permitido alocar pedido `pendente`; qualquer outro
 * status lança `ALOCACAO_NAO_PERMITIDA`. Função pura, não muta a entrada.
 */
export function alocarPedido(pedido: Pedido): Pedido {
  if (pedido.status !== 'pendente') {
    throw new ErroDominio(
      'ALOCACAO_NAO_PERMITIDA',
      `Pedido ${pedido.id} não pode ser alocado: está com status "${pedido.status}", ` +
        'só é permitido alocar pedido "pendente".',
    );
  }

  return comStatus(pedido, 'alocado');
}

/**
 * Reverte um pedido alocado de volta a `pendente` (D27 — reconciliação de
 * viagem órfã no boot). Só é permitido reverter pedido `alocado`; qualquer
 * outro status lança `ALOCACAO_NAO_PERMITIDA`. Função pura, não muta a entrada.
 */
export function reverterParaPendente(pedido: Pedido): Pedido {
  if (pedido.status !== 'alocado') {
    throw new ErroDominio(
      'ALOCACAO_NAO_PERMITIDA',
      `Pedido ${pedido.id} não pode voltar a pendente: está com status "${pedido.status}", ` +
        'só é permitido reverter pedido "alocado".',
    );
  }

  return comStatus(pedido, 'pendente');
}

/**
 * Despacha um pedido alocado para voo, devolvendo uma nova cópia com status
 * `em_voo` (E4-1). Só é permitido despachar pedido `alocado`; qualquer outro
 * status lança `ENTREGA_NAO_PERMITIDA`. Função pura, não muta a entrada.
 */
export function despacharPedido(pedido: Pedido): Pedido {
  if (pedido.status !== 'alocado') {
    throw new ErroDominio(
      'ENTREGA_NAO_PERMITIDA',
      `Pedido ${pedido.id} não pode ser despachado: está com status "${pedido.status}", ` +
        'só é permitido despachar pedido "alocado".',
    );
  }

  return comStatus(pedido, 'em_voo');
}

/**
 * Entrega um pedido em voo, devolvendo uma nova cópia com status `entregue`
 * (E4-1). Só é permitido entregar pedido `em_voo`; qualquer outro status
 * lança `ENTREGA_NAO_PERMITIDA`. Função pura, não muta a entrada.
 */
export function entregarPedido(pedido: Pedido): Pedido {
  if (pedido.status !== 'em_voo') {
    throw new ErroDominio(
      'ENTREGA_NAO_PERMITIDA',
      `Pedido ${pedido.id} não pode ser entregue: está com status "${pedido.status}", ` +
        'só é permitido entregar pedido "em_voo".',
    );
  }

  return comStatus(pedido, 'entregue');
}
