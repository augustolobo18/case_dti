import { randomUUID } from 'node:crypto';
import type { Coordenada } from './coordenada.js';
import { ErroDominio } from './erros.js';
import type { MapaCidade } from './mapa.js';
import { PRIORIDADES, type Pedido } from './pedido.js';
import { criarViagem, rotearNearestNeighbor, type Viagem } from './viagem.js';

/** Motivo pelo qual um pedido não pôde ser alocado em viagem nenhuma. */
export type MotivoNaoAlocado =
  'INALCANCAVEL' | 'PESO_ACIMA_CAPACIDADE' | 'DESTINO_BLOQUEADO' | 'SEM_ROTA';

/** Registro de um pedido inviável, com o motivo e uma mensagem amigável (dado do dashboard, E6). */
export type PedidoNaoAlocado = {
  readonly pedidoId: string;
  readonly motivo: MotivoNaoAlocado;
  readonly mensagem: string;
};

/** Resultado da alocação: as viagens fechadas e o relatório de pedidos inviáveis. */
export type ResultadoAlocacao = {
  readonly viagens: readonly Viagem[];
  readonly naoAlocados: readonly PedidoNaoAlocado[];
};

/** Opções da alocação: pedidos, frota e os limites operacionais (entram por parâmetro). */
export type OpcoesAlocacao = {
  readonly pedidos: readonly Pedido[];
  readonly droneIds: readonly string[];
  readonly base: Coordenada;
  readonly capacidadeKg: number;
  readonly alcanceQuadras: number;
  readonly mapa: MapaCidade;
  readonly gerarId?: () => string;
};

/** Peso numérico de cada prioridade — maior índice em `PRIORIDADES` é mais urgente. */
function pesoPrioridade(prioridade: Pedido['prioridade']): number {
  return PRIORIDADES.indexOf(prioridade);
}

/**
 * Distância da base ao destino do pedido, pelo mapa (E5-2/D17). `null` do mapa
 * (sem rota) nunca deveria ocorrer aqui — a fila já passou por
 * `separarInviaveis` — mas, se ocorrer, ordena por último em vez de quebrar a
 * ordenação (contrato defensivo).
 */
function distanciaParaOrdenacao(mapa: MapaCidade, base: Coordenada, destino: Coordenada): number {
  return mapa.distancia(base, destino) ?? Number.POSITIVE_INFINITY;
}

/**
 * Ordena os pedidos para alocação (D11/E3-2): prioridade (alta > media > baixa)
 * → distância da base (menor primeiro) → peso (maior primeiro). Comparador
 * total e determinístico; ordena sobre uma cópia, sem mutar a entrada.
 */
export function ordenarParaAlocacao(
  pedidos: readonly Pedido[],
  base: Coordenada,
  mapa: MapaCidade,
): Pedido[] {
  return [...pedidos].sort((a, b) => {
    const prioridadeDiferenca = pesoPrioridade(b.prioridade) - pesoPrioridade(a.prioridade);
    if (prioridadeDiferenca !== 0) {
      return prioridadeDiferenca;
    }

    const distanciaDiferenca =
      distanciaParaOrdenacao(mapa, base, a.destino) - distanciaParaOrdenacao(mapa, base, b.destino);
    if (distanciaDiferenca !== 0) {
      return distanciaDiferenca;
    }

    const pesoDiferenca = b.pesoKg - a.pesoKg;
    if (pesoDiferenca !== 0) {
      return pesoDiferenca;
    }

    // Desempate final estável: pelo id, para que o comparador nunca devolva 0
    // e deixe a ordem remanescente à mercê da implementação do `sort`.
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/**
 * Separa os pedidos inviáveis (nunca cabem em viagem nenhuma) dos que seguem
 * para o empacotamento: peso acima da capacidade atual do drone
 * (`PESO_ACIMA_CAPACIDADE` — possível se a config mudou após o cadastro),
 * destino dentro de uma zona de exclusão (`DESTINO_BLOQUEADO`), destino sem
 * caminho até a base contornando as zonas (`SEM_ROTA`, E5-2), ou destino cujo
 * ida-e-volta excede o alcance sozinho (`INALCANCAVEL`).
 */
function separarInviaveis(
  pedidos: readonly Pedido[],
  base: Coordenada,
  capacidadeKg: number,
  alcanceQuadras: number,
  mapa: MapaCidade,
): { viaveis: Pedido[]; naoAlocados: PedidoNaoAlocado[] } {
  const viaveis: Pedido[] = [];
  const naoAlocados: PedidoNaoAlocado[] = [];

  for (const pedido of pedidos) {
    if (pedido.pesoKg > capacidadeKg) {
      naoAlocados.push({
        pedidoId: pedido.id,
        motivo: 'PESO_ACIMA_CAPACIDADE',
        mensagem:
          `Pedido ${pedido.id}: peso ${pedido.pesoKg}kg acima da capacidade do drone ` +
          `(${capacidadeKg}kg).`,
      });
      continue;
    }

    if (mapa.bloqueada(pedido.destino)) {
      naoAlocados.push({
        pedidoId: pedido.id,
        motivo: 'DESTINO_BLOQUEADO',
        mensagem:
          `Pedido ${pedido.id}: destino (${pedido.destino.x}, ${pedido.destino.y}) está ` +
          'dentro de uma zona de exclusão aérea.',
      });
      continue;
    }

    const distanciaAteBase = mapa.distancia(base, pedido.destino);
    if (distanciaAteBase === null) {
      naoAlocados.push({
        pedidoId: pedido.id,
        motivo: 'SEM_ROTA',
        mensagem:
          `Pedido ${pedido.id}: não há rota até o destino (${pedido.destino.x}, ` +
          `${pedido.destino.y}) contornando as zonas de exclusão.`,
      });
      continue;
    }

    const idaEVolta = 2 * distanciaAteBase;
    if (idaEVolta > alcanceQuadras) {
      naoAlocados.push({
        pedidoId: pedido.id,
        motivo: 'INALCANCAVEL',
        mensagem:
          `Pedido ${pedido.id}: ida e volta até o destino (${idaEVolta} quadras) excede o ` +
          `alcance do drone (${alcanceQuadras} quadras).`,
      });
      continue;
    }

    viaveis.push(pedido);
  }

  return { viaveis, naoAlocados };
}

/**
 * Empacota a fila já ordenada em viagens por first-fit-decreasing (D9): abre
 * uma viagem, percorre a fila tentando inserir cada candidato — aceita se,
 * após reroteamento por vizinho mais próximo (D12), a carga couber na
 * capacidade e a distância total couber no alcance (D10). Pedido que não cabe
 * é pulado e reavaliado na viagem seguinte. Fecha e abre viagens até esvaziar
 * a fila. Puro: apenas monta grupos de pedidos, sem atribuir drone ainda.
 */
function empacotar(
  fila: readonly Pedido[],
  base: Coordenada,
  capacidadeKg: number,
  alcanceQuadras: number,
  mapa: MapaCidade,
): Pedido[][] {
  const restantes = [...fila];
  const viagens: Pedido[][] = [];

  while (restantes.length > 0) {
    const grupo: Pedido[] = [];
    let cargaAtual = 0;

    for (let indice = 0; indice < restantes.length;) {
      const candidato = restantes[indice]!;
      const novaCarga = cargaAtual + candidato.pesoKg;

      if (novaCarga > capacidadeKg) {
        indice += 1;
        continue;
      }

      const { distanciaQuadras } = rotearNearestNeighbor(
        base,
        [...grupo.map((p) => p.destino), candidato.destino],
        mapa,
      );

      if (distanciaQuadras > alcanceQuadras) {
        indice += 1;
        continue;
      }

      grupo.push(candidato);
      cargaAtual = novaCarga;
      restantes.splice(indice, 1);
      // Não avança `indice`: o próximo elemento ocupou a posição do removido.
    }

    if (grupo.length === 0) {
      // Nenhum candidato coube nesta rodada: com a fila já filtrada por
      // `separarInviaveis`, isso é um bug do algoritmo, não uma entrada
      // inválida — falha alto em vez de girar para sempre sem progresso.
      throw new ErroDominio(
        'EMPACOTAMENTO_INCONSISTENTE',
        'Empacotamento inconsistente: nenhum pedido restante coube na viagem, ' +
          'mesmo após a filtragem de inviáveis.',
      );
    }

    viagens.push(grupo);
  }

  return viagens;
}

/**
 * Aloca os pedidos `pendente` em viagens, minimizando o número de viagens
 * (D9/E3-1), respeitando capacidade e alcance, com ordenação determinística
 * (D11/E3-2). Função pura: sem I/O, sem relógio, sem `Math.random`; `gerarId`
 * é injetável, como em `criarPedido`/`criarDrone`.
 */
export function alocarPedidos(opcoes: OpcoesAlocacao): ResultadoAlocacao {
  const {
    pedidos,
    droneIds,
    base,
    capacidadeKg,
    alcanceQuadras,
    mapa,
    gerarId = randomUUID,
  } = opcoes;

  const pendentes = pedidos.filter((pedido) => pedido.status === 'pendente');

  if (pendentes.length === 0) {
    return { viagens: [], naoAlocados: [] };
  }

  const { viaveis, naoAlocados } = separarInviaveis(
    pendentes,
    base,
    capacidadeKg,
    alcanceQuadras,
    mapa,
  );

  if (viaveis.length === 0) {
    return { viagens: [], naoAlocados };
  }

  if (droneIds.length === 0) {
    throw new ErroDominio(
      'FROTA_VAZIA',
      'Não é possível alocar pedidos: a frota está vazia (nenhum drone disponível).',
    );
  }

  const ordenados = ordenarParaAlocacao(viaveis, base, mapa);
  const grupos = empacotar(ordenados, base, capacidadeKg, alcanceQuadras, mapa);

  const viagens = grupos.map((grupo, indice) =>
    criarViagem({
      droneId: droneIds[indice % droneIds.length]!,
      pedidos: grupo,
      base,
      capacidadeKg,
      alcanceQuadras,
      mapa,
      gerarId,
    }),
  );

  return { viagens, naoAlocados };
}
