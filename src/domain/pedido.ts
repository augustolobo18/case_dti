import { randomUUID } from 'node:crypto';
import { ErroDominio } from './erros.js';
import { criarCoordenada, type Coordenada } from './coordenada.js';

/** Prioridades possíveis de um pedido, em ordem crescente de urgência. */
export const PRIORIDADES = ['baixa', 'media', 'alta'] as const;
export type Prioridade = (typeof PRIORIDADES)[number];

/** Status do ciclo de vida do pedido, distinto da máquina de estados do drone (D7). */
export const STATUS_PEDIDO = ['pendente', 'alocado', 'em_voo', 'entregue'] as const;
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
