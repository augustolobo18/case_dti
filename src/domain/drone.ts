import { randomUUID } from 'node:crypto';
import { ErroDominio } from './erros.js';
import type { Coordenada } from './coordenada.js';

/**
 * Estados possíveis do drone, na ordem em que a máquina de estados os percorre
 * (`idle -> carregando -> em_voo -> entregando -> retornando -> idle`).
 * Este bloco modela apenas o tipo; as transições ficam para o Bloco 5 (E4-1).
 */
export const ESTADOS_DRONE = ['idle', 'carregando', 'em_voo', 'entregando', 'retornando'] as const;
export type EstadoDrone = (typeof ESTADOS_DRONE)[number];

/** Drone da frota, imutável. */
export type Drone = {
  readonly id: string;
  readonly estado: EstadoDrone;
  readonly posicao: Coordenada;
  readonly cargaKg: number;
  readonly capacidadeKg: number;
  readonly alcanceQuadras: number;
  readonly bateriaQuadras: number;
};

/** Opções de criação de um drone: limites obrigatórios e gerador de id (injetável nos testes). */
export type OpcoesDrone = {
  readonly base: Coordenada;
  readonly capacidadeKg: number;
  readonly alcanceQuadras: number;
  readonly gerarId?: () => string;
};

/**
 * Cria um único `Drone`, sempre `idle`, na base, sem carga e com bateria
 * cheia (`bateriaQuadras === alcanceQuadras`, D15).
 */
export function criarDrone(opcoes: OpcoesDrone): Drone {
  const { base, capacidadeKg, alcanceQuadras, gerarId = randomUUID } = opcoes;

  return {
    id: gerarId(),
    estado: 'idle',
    posicao: base,
    cargaKg: 0,
    capacidadeKg,
    alcanceQuadras,
    bateriaQuadras: alcanceQuadras,
  };
}

/**
 * Cria uma frota homogênea de `quantidade` drones, todos com os mesmos
 * limites e cada um com um `id` único (D8).
 */
export function criarFrota(quantidade: number, opcoes: OpcoesDrone): Drone[] {
  if (!Number.isInteger(quantidade) || quantidade < 1) {
    throw new ErroDominio(
      'QUANTIDADE_DRONES_INVALIDA',
      `Quantidade de drones inválida: ${quantidade}. Deve ser um inteiro maior ou igual a 1.`,
    );
  }

  return Array.from({ length: quantidade }, () => criarDrone(opcoes));
}
