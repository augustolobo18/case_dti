import { randomUUID } from 'node:crypto';
import { ErroDominio } from './erros.js';
import type { Coordenada } from './coordenada.js';

/**
 * Estados possíveis do drone, na ordem em que a máquina de estados os percorre
 * (`idle -> carregando -> em_voo -> entregando -> retornando -> idle`, E4-1).
 */
export const ESTADOS_DRONE = ['idle', 'carregando', 'em_voo', 'entregando', 'retornando'] as const;
export type EstadoDrone = (typeof ESTADOS_DRONE)[number];

/**
 * Tabela de transições permitidas da máquina de estados do drone (E4-1, seção
 * 2.2 do plano). Qualquer par fora desta tabela lança `TRANSICAO_INVALIDA`.
 */
const TRANSICOES: Record<EstadoDrone, readonly EstadoDrone[]> = {
  idle: ['carregando'],
  carregando: ['em_voo'],
  em_voo: ['entregando'],
  entregando: ['em_voo', 'retornando'],
  retornando: ['idle'],
};

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
 * Transita o drone para `novoEstado`, validando contra a tabela `TRANSICOES`
 * (E4-1). Transição fora da tabela — inclusive permanecer no mesmo estado —
 * lança `TRANSICAO_INVALIDA`. Função pura: devolve nova cópia, não muta a entrada.
 */
export function transitar(drone: Drone, novoEstado: EstadoDrone): Drone {
  const permitidas = TRANSICOES[drone.estado];
  if (!permitidas.includes(novoEstado)) {
    throw new ErroDominio(
      'TRANSICAO_INVALIDA',
      `Transição inválida: drone ${drone.id} não pode ir de "${drone.estado}" para "${novoEstado}".`,
    );
  }

  return { ...drone, estado: novoEstado };
}

/**
 * Carrega o drone com `cargaKg` e transita `idle -> carregando` (E4-1).
 * Lança `PESO_ACIMA_CAPACIDADE` se a carga exceder a capacidade do drone;
 * a transição inválida (drone não `idle`) propaga de `transitar`.
 */
export function carregarDrone(drone: Drone, cargaKg: number): Drone {
  if (cargaKg > drone.capacidadeKg) {
    throw new ErroDominio(
      'PESO_ACIMA_CAPACIDADE',
      `Carga de ${cargaKg}kg acima da capacidade do drone (${drone.capacidadeKg}kg).`,
    );
  }

  const transitado = transitar(drone, 'carregando');
  return { ...transitado, cargaKg };
}

/**
 * Move o drone até `destino`, descontando `distanciaQuadras` da bateria
 * (D15/E4-3). Lança `BATERIA_INSUFICIENTE` quando o trecho excede a bateria
 * restante. Não altera o `estado` — a máquina de estados transita à parte.
 */
export function moverPara(drone: Drone, destino: Coordenada, distanciaQuadras: number): Drone {
  if (distanciaQuadras > drone.bateriaQuadras) {
    throw new ErroDominio(
      'BATERIA_INSUFICIENTE',
      `Trecho de ${distanciaQuadras} quadras excede a bateria restante do drone ` +
        `${drone.id} (${drone.bateriaQuadras} quadras).`,
    );
  }

  return { ...drone, posicao: destino, bateriaQuadras: drone.bateriaQuadras - distanciaQuadras };
}

/** Descarrega `pesoKg` do drone (entrega de um pedido, E4-1). Não altera o `estado`. */
export function descarregar(drone: Drone, pesoKg: number): Drone {
  return { ...drone, cargaKg: drone.cargaKg - pesoKg };
}

/** Restaura a bateria do drone a `alcanceQuadras` (recarga na base, D15/E4-3). */
export function recarregar(drone: Drone): Drone {
  return { ...drone, bateriaQuadras: drone.alcanceQuadras };
}

/**
 * Cria um gerador de ids sequenciais e determinísticos (`drone-1`, `drone-2`, ...),
 * fechando sobre um contador próprio. Usado para dar ids estáveis à frota entre
 * reinícios (a frota é derivada da config a cada boot, ver D8) — ao contrário de
 * `randomUUID`, que mudaria a cada subida do processo.
 */
export function criarGeradorIdSequencial(prefixo = 'drone'): () => string {
  let contador = 0;
  return () => `${prefixo}-${++contador}`;
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
