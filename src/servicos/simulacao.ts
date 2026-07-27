import { ErroDominio } from '../domain/erros.js';
import type { Coordenada } from '../domain/coordenada.js';
import type { MapaCidade } from '../domain/mapa.js';
import {
  simular,
  type EventoSimulacao,
  type LinhaDoTempo,
  type TemposSimulacao,
} from '../domain/simulacao.js';
import { comStatusViagem } from '../domain/viagem.js';
import type { RepositorioPedidos } from '../repositorio/pedidos.js';
import type { RepositorioFrota } from '../repositorio/frota.js';
import type { RepositorioViagens } from '../repositorio/viagens.js';

/** Opções de criação do serviço de simulação: repositórios, base, mapa e tempos operacionais. */
export type OpcoesServicoSimulacao = {
  readonly pedidos: RepositorioPedidos;
  readonly frota: RepositorioFrota;
  readonly viagens: RepositorioViagens;
  readonly base: Coordenada;
  readonly tempos: TemposSimulacao;
  readonly mapa: MapaCidade;
};

/** Resultado de um avanço do relógio: o instante alcançado e os eventos recém-aplicados. */
export type ResultadoAvanco = {
  readonly instanteAtual: number;
  readonly eventosAplicados: readonly EventoSimulacao[];
};

/**
 * Serviço de simulação: orquestra o motor puro (`domain/simulacao.ts`) e os
 * repositórios, sem conter regra de negócio própria (D30/D31/D32/D33).
 */
export type ServicoSimulacao = {
  recomputar(): LinhaDoTempo;
  linhaDoTempo(): LinhaDoTempo;
  instanteAtual(): number;
  avancarPara(instanteMin: number): ResultadoAvanco;
};

/**
 * Cria o serviço de simulação (E4). A linha do tempo não é persistida (D31):
 * é sempre recomputada a partir das viagens/pedidos/frota atuais. `avancarPara`
 * aplica, em ordem, todo evento ainda não aplicado com `instanteMin <=` o alvo
 * (D32) — cada evento atualiza o drone na frota e, conforme o tipo, despacha
 * ou entrega o pedido e atualiza o status da viagem.
 */
export function criarServicoSimulacao(opcoes: OpcoesServicoSimulacao): ServicoSimulacao {
  const { pedidos, frota, viagens, base, tempos, mapa } = opcoes;

  let linha: LinhaDoTempo = {
    eventos: [],
    metricas: {
      totalEntregas: 0,
      makespanMin: 0,
      tempoMedioEntregaMin: 0,
      tempoPorPedido: [],
      porDrone: [],
    },
  };
  let instante = 0;
  let indiceProximoEvento = 0;

  function recomputar(): LinhaDoTempo {
    linha = simular({
      viagens: viagens.listar(),
      pedidos: pedidos.listar(),
      drones: frota.listar(),
      base,
      tempos,
      mapa,
    });
    instante = 0;
    indiceProximoEvento = 0;
    return linha;
  }

  /** Atualiza o status da viagem `viagemId` para `status`, via write-through do repositório. */
  function atualizarStatusViagem(viagemId: string, status: 'em_execucao' | 'concluida'): void {
    const atuais = viagens.listar();
    const alvo = atuais.find((viagem) => viagem.id === viagemId);
    if (!alvo || alvo.status === status) {
      return;
    }
    const atualizadas = atuais.map((viagem) =>
      viagem.id === viagemId ? comStatusViagem(viagem, status) : viagem,
    );
    viagens.substituirTodas(atualizadas);
  }

  function aplicarEvento(evento: EventoSimulacao): void {
    const droneAtual = frota.buscarPorId(evento.droneId);
    frota.atualizar({
      ...droneAtual,
      estado: evento.estadoDrone,
      posicao: evento.posicao,
      cargaKg: evento.cargaKg,
      bateriaQuadras: evento.bateriaQuadras,
    });

    switch (evento.tipo) {
      case 'decolagem': {
        const viagem = viagens.listar().find((item) => item.id === evento.viagemId);
        if (viagem) {
          pedidos.despachar(viagem.pedidoIds);
        }
        atualizarStatusViagem(evento.viagemId, 'em_execucao');
        break;
      }
      case 'entrega_concluida': {
        if (evento.pedidoId !== undefined) {
          pedidos.entregar([evento.pedidoId]);
        }
        break;
      }
      case 'recarga_concluida': {
        atualizarStatusViagem(evento.viagemId, 'concluida');
        break;
      }
      default:
        break;
    }
  }

  function avancarPara(instanteMin: number): ResultadoAvanco {
    if (instanteMin < instante) {
      throw new ErroDominio(
        'AVANCO_INVALIDO',
        `Não é possível avançar para ${instanteMin}min: o relógio já está em ${instante}min ` +
          'e só avança para frente.',
      );
    }

    const aplicados: EventoSimulacao[] = [];
    while (
      indiceProximoEvento < linha.eventos.length &&
      linha.eventos[indiceProximoEvento]!.instanteMin <= instanteMin
    ) {
      const evento = linha.eventos[indiceProximoEvento]!;
      aplicarEvento(evento);
      aplicados.push(evento);
      indiceProximoEvento += 1;
    }

    instante = instanteMin;
    return { instanteAtual: instante, eventosAplicados: aplicados };
  }

  recomputar();

  return {
    recomputar,
    linhaDoTempo(): LinhaDoTempo {
      return linha;
    },
    instanteAtual(): number {
      return instante;
    },
    avancarPara,
  };
}
