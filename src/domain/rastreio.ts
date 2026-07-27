import type { Drone } from './drone.js';
import type { MapaCidade } from './mapa.js';
import type { Pedido, StatusPedido } from './pedido.js';

/** Opções de `montarRastreio`: o pedido, o drone que o carrega (se houver) e o mapa. */
export type OpcoesRastreio = {
  readonly pedido: Pedido;
  readonly drone?: Drone;
  readonly mapa: MapaCidade;
};

/** Rastreio do pedido em linguagem amigável (E6-2): mensagem sempre presente. */
export type Rastreio = {
  readonly pedidoId: string;
  readonly status: StatusPedido;
  readonly mensagem: string;
  readonly distanciaQuadras?: number;
  readonly droneId?: string;
};

/** Distância a partir da qual o pedido ainda não está "chegando" (D42). */
const QUADRAS_FAIXA_CHEGANDO = 1;

/**
 * Monta a mensagem de rastreio para cada status "estático" (não `em_voo`),
 * exaustivo em `StatusPedido` — status novo sem entrada aqui quebra o
 * typecheck, mesmo espírito da tabela de transições de `drone.ts`.
 */
const MENSAGENS_POR_STATUS: Record<Exclude<StatusPedido, 'em_voo'>, string> = {
  pendente: 'Seu pacote foi recebido e está aguardando alocação em uma viagem.',
  alocado: 'Seu pacote foi alocado em uma viagem e aguarda a decolagem do drone.',
  entregue: 'Seu pacote já foi entregue. Obrigado por usar o DroneDelivery!',
  cancelado: 'Este pedido foi cancelado antes da entrega.',
};

/** Mensagem de `em_voo` quando a distância ao cliente é conhecida (D42). */
function mensagemEmVooComDistancia(distanciaQuadras: number): string {
  if (distanciaQuadras <= QUADRAS_FAIXA_CHEGANDO) {
    return 'Seu pacote está chegando!';
  }
  return `Seu pacote está a ${distanciaQuadras} quadra${distanciaQuadras === 1 ? '' : 's'} de você.`;
}

/** Mensagem de `em_voo` quando a distância não pôde ser calculada — degrada, não lança. */
const MENSAGEM_EM_VOO_SEM_DISTANCIA =
  'Seu pacote está a caminho. A distância exata não pôde ser calculada no momento.';

/**
 * Monta o rastreio de um pedido em linguagem amigável (E6-2). Função pura:
 * sem I/O, relógio ou aleatoriedade. Só em `em_voo` a mensagem cita a
 * distância — real, contornando zonas (D42), nunca a Manhattan reta. Sem
 * drone localizável, ou sem rota calculável, degrada para uma mensagem sem
 * distância: é leitura para o cliente final, não invariante de domínio.
 */
export function montarRastreio(opcoes: OpcoesRastreio): Rastreio {
  const { pedido, drone, mapa } = opcoes;

  if (pedido.status !== 'em_voo') {
    return {
      pedidoId: pedido.id,
      status: pedido.status,
      mensagem: MENSAGENS_POR_STATUS[pedido.status],
    };
  }

  if (!drone) {
    return {
      pedidoId: pedido.id,
      status: 'em_voo',
      mensagem: MENSAGEM_EM_VOO_SEM_DISTANCIA,
    };
  }

  const distanciaQuadras = mapa.distancia(drone.posicao, pedido.destino);
  if (distanciaQuadras === null) {
    return {
      pedidoId: pedido.id,
      status: 'em_voo',
      droneId: drone.id,
      mensagem: MENSAGEM_EM_VOO_SEM_DISTANCIA,
    };
  }

  return {
    pedidoId: pedido.id,
    status: 'em_voo',
    droneId: drone.id,
    distanciaQuadras,
    mensagem: mensagemEmVooComDistancia(distanciaQuadras),
  };
}
