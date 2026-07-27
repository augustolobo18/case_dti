import { randomUUID } from 'node:crypto';
import { distanciaManhattan, type Coordenada } from './coordenada.js';
import { ErroDominio } from './erros.js';
import { PRIORIDADES, type Pedido } from './pedido.js';
import { criarViagem, rotearNearestNeighbor, type Viagem } from './viagem.js';

/** Motivo pelo qual um pedido não pôde ser alocado em viagem nenhuma. */
export type MotivoNaoAlocado = 'INALCANCAVEL' | 'PESO_ACIMA_CAPACIDADE';

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
  readonly gerarId?: () => string;
};

/** Peso numérico de cada prioridade — maior índice em `PRIORIDADES` é mais urgente. */
function pesoPrioridade(prioridade: Pedido['prioridade']): number {
  return PRIORIDADES.indexOf(prioridade);
}

/**
 * Ordena os pedidos para alocação (D11/E3-2): prioridade (alta > media > baixa)
 * → distância da base (menor primeiro) → peso (maior primeiro). Comparador
 * total e determinístico; ordena sobre uma cópia, sem mutar a entrada.
 */
export function ordenarParaAlocacao(pedidos: readonly Pedido[], base: Coordenada): Pedido[] {
  return [...pedidos].sort((a, b) => {
    const prioridadeDiferenca = pesoPrioridade(b.prioridade) - pesoPrioridade(a.prioridade);
    if (prioridadeDiferenca !== 0) {
      return prioridadeDiferenca;
    }

    const distanciaDiferenca =
      distanciaManhattan(base, a.destino) - distanciaManhattan(base, b.destino);
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
 * para o empacotamento: destino cujo ida-e-volta excede o alcance sozinho
 * (`INALCANCAVEL`), ou peso acima da capacidade atual do drone
 * (`PESO_ACIMA_CAPACIDADE` — possível se a config mudou após o cadastro).
 */
function separarInviaveis(
  pedidos: readonly Pedido[],
  base: Coordenada,
  capacidadeKg: number,
  alcanceQuadras: number,
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

    const idaEVolta = 2 * distanciaManhattan(base, pedido.destino);
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

      const { distanciaQuadras } = rotearNearestNeighbor(base, [
        ...grupo.map((p) => p.destino),
        candidato.destino,
      ]);

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
  const { pedidos, droneIds, base, capacidadeKg, alcanceQuadras, gerarId = randomUUID } = opcoes;

  const pendentes = pedidos.filter((pedido) => pedido.status === 'pendente');

  if (pendentes.length === 0) {
    return { viagens: [], naoAlocados: [] };
  }

  const { viaveis, naoAlocados } = separarInviaveis(pendentes, base, capacidadeKg, alcanceQuadras);

  if (viaveis.length === 0) {
    return { viagens: [], naoAlocados };
  }

  if (droneIds.length === 0) {
    throw new ErroDominio(
      'FROTA_VAZIA',
      'Não é possível alocar pedidos: a frota está vazia (nenhum drone disponível).',
    );
  }

  const ordenados = ordenarParaAlocacao(viaveis, base);
  const grupos = empacotar(ordenados, base, capacidadeKg, alcanceQuadras);

  const viagens = grupos.map((grupo, indice) =>
    criarViagem({
      droneId: droneIds[indice % droneIds.length]!,
      pedidos: grupo,
      base,
      capacidadeKg,
      alcanceQuadras,
      gerarId,
    }),
  );

  return { viagens, naoAlocados };
}
