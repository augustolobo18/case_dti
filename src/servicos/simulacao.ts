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
      droneMaisEficiente: null,
    },
  };
  let instante = 0;
  let indiceProximoEvento = 0;

  /**
   * Desfaz o progresso que a rodada anterior aplicou às viagens ainda não
   * concluídas (D46). `recomputar` reconstrói a linha do tempo do zero e zera o
   * relógio (D33); sem zerar o mundo junto, os eventos dessas viagens seriam
   * reaplicados sobre um estado já avançado — despachar pedido já `entregue`
   * lança e trava a simulação sem volta.
   *
   * Viagem `concluida` é preservada: ela não entra na nova linha do tempo (D35),
   * então seus pedidos e seu status permanecem como estão.
   */
  function reiniciarViagensNaoConcluidas(): void {
    const naoConcluidas = viagens.listar().filter((viagem) => viagem.status !== 'concluida');
    if (naoConcluidas.length === 0) {
      return;
    }

    pedidos.emLote(() =>
      viagens.emLote(() => {
        const ids = naoConcluidas.flatMap((viagem) => viagem.pedidoIds);
        // Só `em_voo` e `entregue` precisam voltar: `alocado` já é o alvo,
        // `cancelado` é final e `pendente` é viagem incoerente do boot, que a
        // reconciliação (D27) trata — nenhum dos três deve fazer isto lançar.
        const reiniciaveis = ids.filter((id) => {
          const status = pedidos.buscarPorId(id).status;
          return status === 'em_voo' || status === 'entregue';
        });
        if (reiniciaveis.length > 0) {
          pedidos.reiniciarParaAlocado(reiniciaveis);
        }

        const porId = new Set(naoConcluidas.map((viagem) => viagem.id));
        viagens.substituirTodas(
          viagens
            .listar()
            .map((viagem) =>
              porId.has(viagem.id) ? comStatusViagem(viagem, 'planejada') : viagem,
            ),
        );
      }),
    );

    // A frota volta ao estado inicial da simulação: toda viagem começa e termina
    // na base, então esse é o único estado consistente com um relógio em zero.
    for (const drone of frota.listar()) {
      frota.atualizar({
        ...drone,
        estado: 'idle',
        posicao: base,
        cargaKg: 0,
        bateriaQuadras: drone.alcanceQuadras,
      });
    }
  }

  function recomputar(): LinhaDoTempo {
    reiniciarViagensNaoConcluidas();

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

    // Modo de lote (D43): a mutação em memória de cada evento continua
    // imediata (é dela que `atualizarStatusViagem` depende para o
    // early-return); só a gravação em disco é adiada para o fim do laço,
    // uma vez por arquivo em vez de uma vez por evento aplicado.
    const aplicados = pedidos.emLote(() =>
      viagens.emLote(() => {
        const eventosAplicados: EventoSimulacao[] = [];
        while (
          indiceProximoEvento < linha.eventos.length &&
          linha.eventos[indiceProximoEvento]!.instanteMin <= instanteMin
        ) {
          const evento = linha.eventos[indiceProximoEvento]!;
          aplicarEvento(evento);
          eventosAplicados.push(evento);
          indiceProximoEvento += 1;
        }
        return eventosAplicados;
      }),
    );

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
