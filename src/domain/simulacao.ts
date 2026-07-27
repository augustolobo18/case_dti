import { saoIguais, type Coordenada } from './coordenada.js';
import {
  carregarDrone,
  descarregar,
  moverPara,
  recarregar,
  transitar,
  type Drone,
  type EstadoDrone,
} from './drone.js';
import { ErroDominio } from './erros.js';
import type { MapaCidade } from './mapa.js';
import type { Pedido } from './pedido.js';
import type { Viagem } from './viagem.js';

/** Tipos de evento produzidos pelo motor de simulação (E4-1/E4-2/E4-3). */
export type TipoEvento =
  | 'carga_iniciada'
  | 'decolagem'
  | 'chegada_parada'
  | 'entrega_concluida'
  | 'retorno_base'
  | 'recarga_concluida';

/** Um evento discreto da linha do tempo de um drone, imutável. */
export type EventoSimulacao = {
  readonly sequencia: number;
  readonly instanteMin: number;
  readonly tipo: TipoEvento;
  readonly droneId: string;
  readonly viagemId: string;
  readonly pedidoId?: string;
  readonly posicao: Coordenada;
  readonly estadoDrone: EstadoDrone;
  readonly cargaKg: number;
  readonly bateriaQuadras: number;
};

/** Tempo de entrega de um pedido, para a métrica `tempoPorPedido`. */
export type TempoPorPedido = {
  readonly pedidoId: string;
  readonly instanteEntregaMin: number;
};

/**
 * Totais por drone: quantas viagens, distância acumulada, tempo ocupado,
 * entregas concluídas e eficiência (`entregas ÷ distanciaQuadras`, D19).
 */
export type MetricasPorDrone = {
  readonly droneId: string;
  readonly viagens: number;
  readonly distanciaQuadras: number;
  readonly tempoOcupadoMin: number;
  readonly entregas: number;
  readonly eficiencia: number;
};

/** Métricas agregadas da simulação (E4-2/E6-1/D19). */
export type MetricasSimulacao = {
  readonly totalEntregas: number;
  readonly makespanMin: number;
  readonly tempoMedioEntregaMin: number;
  readonly tempoPorPedido: readonly TempoPorPedido[];
  readonly porDrone: readonly MetricasPorDrone[];
  /** Drone de maior eficiência (entregas ÷ distância); empate por menor `droneId`; `null` sem viagens. */
  readonly droneMaisEficiente: string | null;
};

/** Linha do tempo completa: os eventos ordenados e as métricas derivadas. */
export type LinhaDoTempo = {
  readonly eventos: readonly EventoSimulacao[];
  readonly metricas: MetricasSimulacao;
};

/** Constantes de tempo/velocidade da simulação (D14/D15/D34) — entram por parâmetro. */
export type TemposSimulacao = {
  readonly velocidadeQuadrasMin: number;
  readonly carregamentoMin: number;
  readonly entregaMin: number;
  readonly recargaMinPorQuadra: number;
};

/** Opções de `simular`: viagens, pedidos, frota, base, mapa e os tempos operacionais. */
export type OpcoesSimulacao = {
  readonly viagens: readonly Viagem[];
  readonly pedidos: readonly Pedido[];
  readonly drones: readonly Drone[];
  readonly base: Coordenada;
  readonly tempos: TemposSimulacao;
  readonly mapa: MapaCidade;
};

/** Arredonda para 3 casas decimais — ponto único de arredondamento (mitiga deriva de ponto flutuante). */
function arredondar(valor: number): number {
  return Math.round(valor * 1000) / 1000;
}

/**
 * Reduz as paradas de uma viagem (excluindo a base nas duas pontas) às
 * paradas físicas distintas, mesclando entradas consecutivas de mesma
 * coordenada (vários pedidos no mesmo destino viram uma única parada física).
 */
function paradasDeEntrega(paradas: readonly Coordenada[]): Coordenada[] {
  const meio = paradas.slice(1, -1);
  const resultado: Coordenada[] = [];

  for (const parada of meio) {
    const ultima = resultado[resultado.length - 1];
    if (!ultima || !saoIguais(ultima, parada)) {
      resultado.push(parada);
    }
  }

  return resultado;
}

/**
 * Comparador total dos eventos, nunca devolve 0: `instanteMin` → `droneId` →
 * `sequencia` (esta última já é única dentro do mesmo drone).
 */
function compararEventos(a: EventoSimulacao, b: EventoSimulacao): number {
  if (a.instanteMin !== b.instanteMin) {
    return a.instanteMin - b.instanteMin;
  }
  if (a.droneId !== b.droneId) {
    return a.droneId < b.droneId ? -1 : 1;
  }
  return a.sequencia - b.sequencia;
}

/** Distância entre `a` e `b` pelo mapa; falha alto se não houver rota (estado inalcançável). */
function distanciaOuFalhar(mapa: MapaCidade, a: Coordenada, b: Coordenada): number {
  const distancia = mapa.distancia(a, b);
  if (distancia === null) {
    throw new ErroDominio(
      'ROTA_IMPOSSIVEL',
      `Não há rota entre (${a.x}, ${a.y}) e (${b.x}, ${b.y}) contornando as zonas de ` +
        'exclusão — estado inalcançável ao simular uma viagem já planejada.',
    );
  }
  return distancia;
}

/**
 * Simula a execução das viagens `planejada`/`em_execucao` (viagens
 * `concluida` são ignoradas), transformando-as em uma linha do tempo de
 * eventos com timestamps (E4-1/E4-2/E4-3). Função pura: sem I/O, sem relógio
 * real, sem aleatoriedade — mesma entrada produz sempre a mesma saída (D13).
 *
 * Cada drone tem seu próprio relógio começando em 0 (drones diferentes voam
 * em paralelo); o mesmo drone executa suas viagens em série, na ordem de
 * entrada. Reaproveita as funções puras de `drone.ts` (`transitar`,
 * `carregarDrone`, `moverPara`, `descarregar`, `recarregar`) para que a
 * máquina de estados e a bateria sigam a mesma regra em toda a base de código.
 */
export function simular(opcoes: OpcoesSimulacao): LinhaDoTempo {
  const { viagens, pedidos, drones, base, tempos, mapa } = opcoes;

  const pedidosPorId = new Map(pedidos.map((pedido) => [pedido.id, pedido]));
  const dronesPorId = new Map(drones.map((drone) => [drone.id, drone]));

  const viagensPorDrone = new Map<string, Viagem[]>();
  for (const viagem of viagens) {
    if (viagem.status === 'concluida') {
      continue;
    }
    const grupo = viagensPorDrone.get(viagem.droneId);
    if (grupo) {
      grupo.push(viagem);
    } else {
      viagensPorDrone.set(viagem.droneId, [viagem]);
    }
  }

  const eventos: EventoSimulacao[] = [];
  const tempoPorPedido: TempoPorPedido[] = [];
  const porDrone: MetricasPorDrone[] = [];

  for (const [droneId, viagensDoDrone] of viagensPorDrone) {
    const droneReal = dronesPorId.get(droneId);
    if (!droneReal) {
      // Drone referenciado pela viagem não existe mais na frota atual — nada a simular.
      continue;
    }

    let sequencia = 0;
    let instanteAtual = 0;
    let distanciaTotal = 0;
    let entregasDoDrone = 0;
    let droneEstado: Drone = {
      id: droneId,
      estado: 'idle',
      posicao: base,
      cargaKg: 0,
      capacidadeKg: droneReal.capacidadeKg,
      alcanceQuadras: droneReal.alcanceQuadras,
      bateriaQuadras: droneReal.alcanceQuadras,
    };

    const registrar = (tipo: TipoEvento, viagemId: string, pedidoId?: string): void => {
      eventos.push({
        sequencia,
        instanteMin: instanteAtual,
        tipo,
        droneId,
        viagemId,
        ...(pedidoId !== undefined ? { pedidoId } : {}),
        posicao: droneEstado.posicao,
        estadoDrone: droneEstado.estado,
        cargaKg: droneEstado.cargaKg,
        bateriaQuadras: droneEstado.bateriaQuadras,
      });
      sequencia += 1;
    };

    for (const viagem of viagensDoDrone) {
      droneEstado = carregarDrone(droneEstado, viagem.cargaKg);
      instanteAtual = arredondar(instanteAtual + tempos.carregamentoMin);
      registrar('carga_iniciada', viagem.id);

      droneEstado = transitar(droneEstado, 'em_voo');
      registrar('decolagem', viagem.id);

      const paradas = paradasDeEntrega(viagem.paradas);
      const pedidosDaViagem = viagem.pedidoIds
        .map((id) => pedidosPorId.get(id))
        .filter((pedido): pedido is Pedido => pedido !== undefined);
      const entregues = new Set<string>();

      paradas.forEach((parada, indice) => {
        const distanciaPerna = distanciaOuFalhar(mapa, droneEstado.posicao, parada);
        distanciaTotal += distanciaPerna;
        instanteAtual = arredondar(instanteAtual + distanciaPerna / tempos.velocidadeQuadrasMin);
        droneEstado = moverPara(droneEstado, parada, distanciaPerna);
        droneEstado = transitar(droneEstado, 'entregando');
        registrar('chegada_parada', viagem.id);

        const pedidosNestaParada = pedidosDaViagem
          .filter((pedido) => !entregues.has(pedido.id) && saoIguais(pedido.destino, parada))
          .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

        for (const pedido of pedidosNestaParada) {
          entregues.add(pedido.id);
          instanteAtual = arredondar(instanteAtual + tempos.entregaMin);
          droneEstado = descarregar(droneEstado, pedido.pesoKg);
          registrar('entrega_concluida', viagem.id, pedido.id);
          tempoPorPedido.push({ pedidoId: pedido.id, instanteEntregaMin: instanteAtual });
          entregasDoDrone += 1;
        }

        const ehUltimaParada = indice === paradas.length - 1;
        droneEstado = transitar(droneEstado, ehUltimaParada ? 'retornando' : 'em_voo');
      });

      const distanciaVolta = distanciaOuFalhar(mapa, droneEstado.posicao, base);
      distanciaTotal += distanciaVolta;
      instanteAtual = arredondar(instanteAtual + distanciaVolta / tempos.velocidadeQuadrasMin);
      droneEstado = moverPara(droneEstado, base, distanciaVolta);
      registrar('retorno_base', viagem.id);

      const consumido = droneEstado.alcanceQuadras - droneEstado.bateriaQuadras;
      instanteAtual = arredondar(instanteAtual + consumido * tempos.recargaMinPorQuadra);
      droneEstado = recarregar(droneEstado);
      droneEstado = transitar(droneEstado, 'idle');
      registrar('recarga_concluida', viagem.id);
    }

    porDrone.push({
      droneId,
      viagens: viagensDoDrone.length,
      distanciaQuadras: distanciaTotal,
      tempoOcupadoMin: instanteAtual,
      entregas: entregasDoDrone,
      // Distância 0 (drone que só entregou na própria base) não pode gerar
      // Infinity/NaN: sem distância percorrida, a eficiência é 0.
      eficiencia: distanciaTotal > 0 ? entregasDoDrone / distanciaTotal : 0,
    });
  }

  const eventosOrdenados = [...eventos].sort(compararEventos);

  const totalEntregas = tempoPorPedido.length;
  const makespanMin =
    eventosOrdenados.length > 0
      ? Math.max(...eventosOrdenados.map((evento) => evento.instanteMin))
      : 0;
  const tempoMedioEntregaMin =
    totalEntregas > 0
      ? arredondar(
          tempoPorPedido.reduce((soma, tempo) => soma + tempo.instanteEntregaMin, 0) /
            totalEntregas,
        )
      : 0;

  const droneMaisEficiente = elegerDroneMaisEficiente(porDrone);

  return {
    eventos: eventosOrdenados,
    metricas: {
      totalEntregas,
      makespanMin,
      tempoMedioEntregaMin,
      tempoPorPedido,
      porDrone,
      droneMaisEficiente,
    },
  };
}

/**
 * Elege o drone de maior eficiência (`entregas ÷ distanciaQuadras`, D19);
 * empate resolve por menor `droneId`. Sem nenhum drone com viagens, `null`.
 */
function elegerDroneMaisEficiente(porDrone: readonly MetricasPorDrone[]): string | null {
  let eleito: MetricasPorDrone | undefined;

  for (const metricas of porDrone) {
    if (
      !eleito ||
      metricas.eficiencia > eleito.eficiencia ||
      (metricas.eficiencia === eleito.eficiencia && metricas.droneId < eleito.droneId)
    ) {
      eleito = metricas;
    }
  }

  return eleito?.droneId ?? null;
}
