import { describe, it, expect } from 'vitest';
import { distanciaManhattan, type Coordenada } from './coordenada.js';
import { criarDrone, ESTADOS_DRONE, type Drone, type EstadoDrone } from './drone.js';
import { ErroDominio } from './erros.js';
import { criarMapaCidade, type MapaCidade, type ZonaExclusao } from './mapa.js';
import { criarPedido, type LimitesPedido, type Pedido } from './pedido.js';
import { criarViagem, comStatusViagem, type Viagem } from './viagem.js';
import { alocarPedidos } from './alocacao.js';
import { simular, type TemposSimulacao } from './simulacao.js';

const BASE: Coordenada = { x: 0, y: 0 };
const LIMITES: LimitesPedido = { capacidadeKg: 100, cidadeTamanho: 1000 };
const TEMPOS: TemposSimulacao = {
  velocidadeQuadrasMin: 1,
  carregamentoMin: 5,
  entregaMin: 2,
  recargaMinPorQuadra: 0.5,
};

/** Mapa sem zonas de exclusão — distância se comporta como Manhattan pura. */
const MAPA_SEM_ZONAS: MapaCidade = criarMapaCidade({ cidadeTamanho: 1000, zonas: [] });

function mapaComZonas(zonas: ZonaExclusao[], cidadeTamanho = 1000): MapaCidade {
  return criarMapaCidade({ cidadeTamanho, zonas });
}

let contadorPedido = 0;
function novoPedido(
  dados: Partial<{ x: number; y: number; pesoKg: number; prioridade: string }> = {},
): Pedido {
  contadorPedido += 1;
  const idFixo = `pedido-${contadorPedido}`;
  return criarPedido(
    {
      x: dados.x ?? 0,
      y: dados.y ?? 0,
      pesoKg: dados.pesoKg ?? 1,
      prioridade: dados.prioridade ?? 'baixa',
    },
    { limites: LIMITES, gerarId: () => idFixo },
  );
}

let contadorViagem = 0;
function novaViagem(
  droneId: string,
  pedidos: Pedido[],
  opcoes: { capacidadeKg?: number; alcanceQuadras?: number; mapa?: MapaCidade } = {},
): Viagem {
  contadorViagem += 1;
  return criarViagem({
    droneId,
    pedidos,
    base: BASE,
    capacidadeKg: opcoes.capacidadeKg ?? 100,
    alcanceQuadras: opcoes.alcanceQuadras ?? 100,
    mapa: opcoes.mapa ?? MAPA_SEM_ZONAS,
    gerarId: () => `viagem-${contadorViagem}`,
  });
}

function novoDrone(id: string, alcanceQuadras = 100): Drone {
  return criarDrone({ base: BASE, capacidadeKg: 100, alcanceQuadras, gerarId: () => id });
}

describe('simular — sequência exata de eventos (D14)', () => {
  it('viagem de 1 pedido produz a sequência exata de eventos com os instantes conferidos à mão', () => {
    const pedido = novoPedido({ x: 3, y: 4, pesoKg: 5 });
    const viagem = novaViagem('drone-1', [pedido]);
    const drone = novoDrone('drone-1', 40);

    const resultado = simular({
      viagens: [viagem],
      pedidos: [pedido],
      drones: [drone],
      base: BASE,
      tempos: TEMPOS,
      mapa: MAPA_SEM_ZONAS,
    });

    expect(resultado.eventos).toEqual([
      {
        sequencia: 0,
        instanteMin: 5,
        tipo: 'carga_iniciada',
        droneId: 'drone-1',
        viagemId: viagem.id,
        posicao: BASE,
        estadoDrone: 'carregando',
        cargaKg: 5,
        bateriaQuadras: 40,
      },
      {
        sequencia: 1,
        instanteMin: 5,
        tipo: 'decolagem',
        droneId: 'drone-1',
        viagemId: viagem.id,
        posicao: BASE,
        estadoDrone: 'em_voo',
        cargaKg: 5,
        bateriaQuadras: 40,
      },
      {
        sequencia: 2,
        instanteMin: 12,
        tipo: 'chegada_parada',
        droneId: 'drone-1',
        viagemId: viagem.id,
        posicao: { x: 3, y: 4 },
        estadoDrone: 'entregando',
        cargaKg: 5,
        bateriaQuadras: 33,
      },
      {
        sequencia: 3,
        instanteMin: 14,
        tipo: 'entrega_concluida',
        droneId: 'drone-1',
        viagemId: viagem.id,
        pedidoId: pedido.id,
        posicao: { x: 3, y: 4 },
        estadoDrone: 'entregando',
        cargaKg: 0,
        bateriaQuadras: 33,
      },
      {
        sequencia: 4,
        instanteMin: 21,
        tipo: 'retorno_base',
        droneId: 'drone-1',
        viagemId: viagem.id,
        posicao: BASE,
        estadoDrone: 'retornando',
        cargaKg: 0,
        bateriaQuadras: 26,
      },
      {
        sequencia: 5,
        instanteMin: 28,
        tipo: 'recarga_concluida',
        droneId: 'drone-1',
        viagemId: viagem.id,
        posicao: BASE,
        estadoDrone: 'idle',
        cargaKg: 0,
        bateriaQuadras: 40,
      },
    ]);

    expect(resultado.metricas).toEqual({
      totalEntregas: 1,
      makespanMin: 28,
      tempoMedioEntregaMin: 14,
      tempoPorPedido: [{ pedidoId: pedido.id, instanteEntregaMin: 14 }],
      porDrone: [
        {
          droneId: 'drone-1',
          viagens: 1,
          distanciaQuadras: 14,
          tempoOcupadoMin: 28,
          entregas: 1,
          eficiencia: 1 / 14,
        },
      ],
      droneMaisEficiente: 'drone-1',
    });
  });
});

describe('simular — ordem dos estados respeita a máquina de estados', () => {
  const TRANSICOES_VALIDAS: Record<EstadoDrone, readonly EstadoDrone[]> = {
    idle: ['carregando'],
    carregando: ['em_voo'],
    em_voo: ['entregando'],
    entregando: ['em_voo', 'retornando'],
    retornando: ['idle'],
  };

  it('a sequência de estados de cada drone só percorre transições válidas', () => {
    const p1 = novoPedido({ x: 1, y: 0, pesoKg: 1 });
    const p2 = novoPedido({ x: 2, y: 0, pesoKg: 1 });
    const viagem1 = novaViagem('drone-1', [p1]);
    const viagem2 = novaViagem('drone-1', [p2]);
    const drone = novoDrone('drone-1');

    const resultado = simular({
      viagens: [viagem1, viagem2],
      pedidos: [p1, p2],
      drones: [drone],
      base: BASE,
      tempos: TEMPOS,
      mapa: MAPA_SEM_ZONAS,
    });

    const estados = resultado.eventos
      .filter((e) => e.droneId === 'drone-1')
      .map((e) => e.estadoDrone);

    for (let i = 1; i < estados.length; i += 1) {
      const de = estados[i - 1]!;
      const para = estados[i]!;
      if (de !== para) {
        expect(TRANSICOES_VALIDAS[de]).toContain(para);
      }
    }
    expect(ESTADOS_DRONE).toContain(estados[0]);
  });
});

describe('simular — bateria', () => {
  it('decresce por perna e é restaurada no recarga_concluida', () => {
    const pedido = novoPedido({ x: 5, y: 0, pesoKg: 1 });
    const viagem = novaViagem('drone-1', [pedido]);
    const drone = novoDrone('drone-1', 40);

    const resultado = simular({
      viagens: [viagem],
      pedidos: [pedido],
      drones: [drone],
      base: BASE,
      tempos: TEMPOS,
      mapa: MAPA_SEM_ZONAS,
    });

    const chegada = resultado.eventos.find((e) => e.tipo === 'chegada_parada')!;
    const recarga = resultado.eventos.find((e) => e.tipo === 'recarga_concluida')!;

    expect(chegada.bateriaQuadras).toBe(40 - 5);
    expect(recarga.bateriaQuadras).toBe(40);
  });

  it('a recarga soma consumido × recargaMinPorQuadra ao instante', () => {
    const pedido = novoPedido({ x: 5, y: 0, pesoKg: 1 });
    const viagem = novaViagem('drone-1', [pedido]);
    const drone = novoDrone('drone-1', 40);

    const resultado = simular({
      viagens: [viagem],
      pedidos: [pedido],
      drones: [drone],
      base: BASE,
      tempos: TEMPOS,
      mapa: MAPA_SEM_ZONAS,
    });

    const retorno = resultado.eventos.find((e) => e.tipo === 'retorno_base')!;
    const recarga = resultado.eventos.find((e) => e.tipo === 'recarga_concluida')!;
    const consumido = 2 * 5; // ida + volta

    expect(recarga.instanteMin - retorno.instanteMin).toBe(consumido * TEMPOS.recargaMinPorQuadra);
  });
});

describe('simular — série vs. paralelo entre drones', () => {
  it('duas viagens do mesmo drone rodam em série', () => {
    const p1 = novoPedido({ x: 1, y: 0, pesoKg: 1 });
    const p2 = novoPedido({ x: 1, y: 0, pesoKg: 1 });
    const viagem1 = novaViagem('drone-1', [p1]);
    const viagem2 = novaViagem('drone-1', [p2]);
    const drone = novoDrone('drone-1');

    const resultado = simular({
      viagens: [viagem1, viagem2],
      pedidos: [p1, p2],
      drones: [drone],
      base: BASE,
      tempos: TEMPOS,
      mapa: MAPA_SEM_ZONAS,
    });

    const fimViagem1 = resultado.eventos.find(
      (e) => e.viagemId === viagem1.id && e.tipo === 'recarga_concluida',
    )!;
    const inicioViagem2 = resultado.eventos.find(
      (e) => e.viagemId === viagem2.id && e.tipo === 'carga_iniciada',
    )!;

    expect(inicioViagem2.instanteMin).toBe(fimViagem1.instanteMin + TEMPOS.carregamentoMin);
  });

  it('viagens de drones diferentes rodam em paralelo (ambas começam em 0)', () => {
    const p1 = novoPedido({ x: 1, y: 0, pesoKg: 1 });
    const p2 = novoPedido({ x: 1, y: 0, pesoKg: 1 });
    const viagem1 = novaViagem('drone-1', [p1]);
    const viagem2 = novaViagem('drone-2', [p2]);
    const drone1 = novoDrone('drone-1');
    const drone2 = novoDrone('drone-2');

    const resultado = simular({
      viagens: [viagem1, viagem2],
      pedidos: [p1, p2],
      drones: [drone1, drone2],
      base: BASE,
      tempos: TEMPOS,
      mapa: MAPA_SEM_ZONAS,
    });

    const carga1 = resultado.eventos.find(
      (e) => e.viagemId === viagem1.id && e.tipo === 'carga_iniciada',
    )!;
    const carga2 = resultado.eventos.find(
      (e) => e.viagemId === viagem2.id && e.tipo === 'carga_iniciada',
    )!;

    expect(carga1.instanteMin).toBe(carga2.instanteMin);
  });
});

describe('simular — múltiplos pedidos no mesmo destino', () => {
  it('todos são entregues na mesma parada, ordenados por id', () => {
    const p1 = novoPedido({ x: 3, y: 3, pesoKg: 1 });
    const p2 = novoPedido({ x: 3, y: 3, pesoKg: 1 });
    const viagem = novaViagem('drone-1', [p2, p1]);
    const drone = novoDrone('drone-1');

    const resultado = simular({
      viagens: [viagem],
      pedidos: [p1, p2],
      drones: [drone],
      base: BASE,
      tempos: TEMPOS,
      mapa: MAPA_SEM_ZONAS,
    });

    const entregas = resultado.eventos.filter((e) => e.tipo === 'entrega_concluida');
    const idsOrdenados = [p1.id, p2.id].sort();

    expect(entregas.map((e) => e.pedidoId)).toEqual(idsOrdenados);
    expect(resultado.eventos.filter((e) => e.tipo === 'chegada_parada')).toHaveLength(1);
  });
});

describe('simular — métricas', () => {
  it('makespan é o maior instante final; média confere; tempoPorPedido cobre todos', () => {
    const p1 = novoPedido({ x: 1, y: 0, pesoKg: 1 });
    const p2 = novoPedido({ x: 10, y: 0, pesoKg: 1 });
    const viagem1 = novaViagem('drone-1', [p1]);
    const viagem2 = novaViagem('drone-2', [p2]);
    const drone1 = novoDrone('drone-1');
    const drone2 = novoDrone('drone-2');

    const resultado = simular({
      viagens: [viagem1, viagem2],
      pedidos: [p1, p2],
      drones: [drone1, drone2],
      base: BASE,
      tempos: TEMPOS,
      mapa: MAPA_SEM_ZONAS,
    });

    const maiorInstante = Math.max(...resultado.eventos.map((e) => e.instanteMin));
    expect(resultado.metricas.makespanMin).toBe(maiorInstante);
    expect(resultado.metricas.totalEntregas).toBe(2);
    expect(resultado.metricas.tempoPorPedido.map((t) => t.pedidoId).sort()).toEqual(
      [p1.id, p2.id].sort(),
    );

    const soma = resultado.metricas.tempoPorPedido.reduce((s, t) => s + t.instanteEntregaMin, 0);
    expect(resultado.metricas.tempoMedioEntregaMin).toBe(soma / 2);
  });
});

describe('simular — determinismo', () => {
  function opcoesFixas() {
    const p1 = novoPedido({ x: 3, y: 4, pesoKg: 2 });
    const p2 = novoPedido({ x: 6, y: 1, pesoKg: 3 });
    const viagem1 = novaViagem('drone-1', [p1]);
    const viagem2 = novaViagem('drone-2', [p2]);
    return {
      viagens: [viagem1, viagem2],
      pedidos: [p1, p2],
      drones: [novoDrone('drone-1'), novoDrone('drone-2')],
      base: BASE,
      tempos: TEMPOS,
      mapa: MAPA_SEM_ZONAS,
    };
  }

  it('duas execuções da mesma entrada produzem linhas do tempo idênticas', () => {
    const opcoes = opcoesFixas();

    const resultado1 = simular(opcoes);
    const resultado2 = simular(opcoes);

    expect(resultado1).toEqual(resultado2);
  });

  it('cenário de carga (~500 pedidos, semente fixa): nenhum drone termina com bateria negativa', () => {
    function criarGeradorSeed(seed: number): () => number {
      let estado = seed;
      return () => {
        estado |= 0;
        estado = (estado + 0x6d2b79f5) | 0;
        let t = Math.imul(estado ^ (estado >>> 15), 1 | estado);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    const aleatorio = criarGeradorSeed(7);
    const pedidos: Pedido[] = [];
    for (let i = 0; i < 500; i += 1) {
      pedidos.push(
        novoPedido({
          x: Math.floor(aleatorio() * 50),
          y: Math.floor(aleatorio() * 50),
          pesoKg: Math.floor(aleatorio() * 9) + 1,
        }),
      );
    }

    const droneIds = ['drone-1', 'drone-2', 'drone-3', 'drone-4', 'drone-5'];
    const drones = droneIds.map((id) => novoDrone(id, 200));

    let contadorAlocacao = 0;
    const alocacao = alocarPedidos({
      pedidos,
      droneIds,
      base: BASE,
      capacidadeKg: 10,
      alcanceQuadras: 200,
      mapa: MAPA_SEM_ZONAS,
      gerarId: () => `viagem-carga-${(contadorAlocacao += 1)}`,
    });

    function executar(): ReturnType<typeof simular> {
      return simular({
        viagens: alocacao.viagens,
        pedidos,
        drones,
        base: BASE,
        tempos: TEMPOS,
        mapa: MAPA_SEM_ZONAS,
      });
    }

    const resultado1 = executar();
    const resultado2 = executar();

    expect(resultado1).toEqual(resultado2);

    const idsAlocados = new Set(alocacao.viagens.flatMap((v) => v.pedidoIds));
    expect(resultado1.metricas.tempoPorPedido.map((t) => t.pedidoId).sort()).toEqual(
      [...idsAlocados].sort(),
    );

    for (const evento of resultado1.eventos) {
      expect(evento.bateriaQuadras).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('simular — viagem de drone inexistente falha alto (D44)', () => {
  it('lança VIAGEM_INCONSISTENTE citando a viagem e o drone ausente da frota', () => {
    const pedido = novoPedido({ x: 1, y: 0, pesoKg: 1 });
    const viagem = novaViagem('drone-fantasma', [pedido]);

    expect.assertions(3);
    try {
      simular({
        viagens: [viagem],
        pedidos: [pedido],
        drones: [], // frota sem "drone-fantasma"
        base: BASE,
        tempos: TEMPOS,
        mapa: MAPA_SEM_ZONAS,
      });
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroDominio);
      expect((erro as ErroDominio).codigo).toBe('VIAGEM_INCONSISTENTE');
      expect((erro as ErroDominio).message).toMatch(/drone-fantasma/);
    }
  });

  it('regressão: com a frota coerente, a linha do tempo continua a mesma de hoje', () => {
    const pedido = novoPedido({ x: 1, y: 0, pesoKg: 1 });
    const viagem = novaViagem('drone-1', [pedido]);
    const drone = novoDrone('drone-1');

    const resultado = simular({
      viagens: [viagem],
      pedidos: [pedido],
      drones: [drone],
      base: BASE,
      tempos: TEMPOS,
      mapa: MAPA_SEM_ZONAS,
    });

    expect(resultado.eventos.length).toBeGreaterThan(0);
    expect(resultado.metricas.totalEntregas).toBe(1);
  });
});

describe('simular — viagem já concluída é ignorada', () => {
  it('não gera eventos para viagem com status "concluida"', () => {
    const pedido = novoPedido({ x: 1, y: 0, pesoKg: 1 });
    const viagem = comStatusViagem(novaViagem('drone-1', [pedido]), 'concluida');
    const drone = novoDrone('drone-1');

    const resultado = simular({
      viagens: [viagem],
      pedidos: [pedido],
      drones: [drone],
      base: BASE,
      tempos: TEMPOS,
      mapa: MAPA_SEM_ZONAS,
    });

    expect(resultado.eventos).toEqual([]);
    expect(resultado.metricas).toEqual({
      totalEntregas: 0,
      makespanMin: 0,
      tempoMedioEntregaMin: 0,
      tempoPorPedido: [],
      porDrone: [],
      droneMaisEficiente: null,
    });
  });
});

describe('simular — métrica de eficiência (D19)', () => {
  it('cada drone traz entregas e eficiencia = entregas / distanciaQuadras', () => {
    const p1 = novoPedido({ x: 1, y: 0, pesoKg: 1 });
    const p2 = novoPedido({ x: 10, y: 0, pesoKg: 1 });
    const viagem1 = novaViagem('drone-1', [p1]);
    const viagem2 = novaViagem('drone-2', [p2]);
    const drone1 = novoDrone('drone-1');
    const drone2 = novoDrone('drone-2');

    const resultado = simular({
      viagens: [viagem1, viagem2],
      pedidos: [p1, p2],
      drones: [drone1, drone2],
      base: BASE,
      tempos: TEMPOS,
      mapa: MAPA_SEM_ZONAS,
    });

    const metricasDrone1 = resultado.metricas.porDrone.find((m) => m.droneId === 'drone-1')!;
    expect(metricasDrone1.entregas).toBe(1);
    expect(metricasDrone1.eficiencia).toBe(1 / metricasDrone1.distanciaQuadras);
  });

  it('droneMaisEficiente é o de maior entregas/distancia; empate resolve por menor droneId', () => {
    const p1 = novoPedido({ x: 1, y: 0, pesoKg: 1 });
    const p2 = novoPedido({ x: 1, y: 0, pesoKg: 1 });
    const viagem1 = novaViagem('drone-2', [p1]);
    const viagem2 = novaViagem('drone-1', [p2]);
    const drone1 = novoDrone('drone-1');
    const drone2 = novoDrone('drone-2');

    const resultado = simular({
      viagens: [viagem1, viagem2],
      pedidos: [p1, p2],
      drones: [drone1, drone2],
      base: BASE,
      tempos: TEMPOS,
      mapa: MAPA_SEM_ZONAS,
    });

    // Ambos os drones têm a mesma eficiência (mesma distância, 1 entrega
    // cada) — o empate deve resolver por menor droneId ("drone-1").
    expect(resultado.metricas.droneMaisEficiente).toBe('drone-1');
  });

  it('sem viagens, droneMaisEficiente é null', () => {
    const resultado = simular({
      viagens: [],
      pedidos: [],
      drones: [novoDrone('drone-1')],
      base: BASE,
      tempos: TEMPOS,
      mapa: MAPA_SEM_ZONAS,
    });

    expect(resultado.metricas.droneMaisEficiente).toBeNull();
  });

  it('distância 0 não produz Infinity nem NaN na eficiência', () => {
    // Pedido no próprio ponto da base: distância percorrida é 0.
    const pedido = novoPedido({ x: 0, y: 0, pesoKg: 1 });
    const viagem = novaViagem('drone-1', [pedido]);
    const drone = novoDrone('drone-1');

    const resultado = simular({
      viagens: [viagem],
      pedidos: [pedido],
      drones: [drone],
      base: BASE,
      tempos: TEMPOS,
      mapa: MAPA_SEM_ZONAS,
    });

    const metricasDrone = resultado.metricas.porDrone[0]!;
    expect(metricasDrone.distanciaQuadras).toBe(0);
    expect(Number.isFinite(metricasDrone.eficiencia)).toBe(true);
    expect(Number.isNaN(metricasDrone.eficiencia)).toBe(false);
  });

  it('regressão: totalEntregas, makespanMin e tempoMedioEntregaMin não mudam de valor', () => {
    const pedido = novoPedido({ x: 3, y: 4, pesoKg: 5 });
    const viagem = novaViagem('drone-1', [pedido]);
    const drone = novoDrone('drone-1', 40);

    const resultado = simular({
      viagens: [viagem],
      pedidos: [pedido],
      drones: [drone],
      base: BASE,
      tempos: TEMPOS,
      mapa: MAPA_SEM_ZONAS,
    });

    expect(resultado.metricas.totalEntregas).toBe(1);
    expect(resultado.metricas.makespanMin).toBe(28);
    expect(resultado.metricas.tempoMedioEntregaMin).toBe(14);
  });
});

describe('simular — com zonas de exclusão (E5-2/D17)', () => {
  // Parede vertical em x=3, y=0..6, deixando y=7..8 livres para contornar,
  // numa malha 0..8. Obriga o desvio entre ORIGEM e DESTINO.
  const ZONA: ZonaExclusao = { de: { x: 3, y: 0 }, ate: { x: 3, y: 6 } };
  const CIDADE_TAMANHO_ZONA = 8;
  const MAPA_ZONA = mapaComZonas([ZONA], CIDADE_TAMANHO_ZONA);
  const ORIGEM: Coordenada = { x: 0, y: 4 };
  const DESTINO: Coordenada = { x: 6, y: 4 };

  it('perna que contorna a zona consome mais bateria e mais tempo que o equivalente Manhattan', () => {
    const pedidoSemZona = novoPedido({ x: DESTINO.x, y: DESTINO.y, pesoKg: 1 });
    const viagemSemZona = criarViagem({
      droneId: 'drone-1',
      pedidos: [pedidoSemZona],
      base: ORIGEM,
      capacidadeKg: 10,
      alcanceQuadras: 100,
      mapa: MAPA_SEM_ZONAS,
      gerarId: () => 'viagem-sem-zona',
    });
    const droneSemZona = criarDrone({
      base: ORIGEM,
      capacidadeKg: 10,
      alcanceQuadras: 100,
      gerarId: () => 'drone-1',
    });

    const resultadoSemZona = simular({
      viagens: [viagemSemZona],
      pedidos: [pedidoSemZona],
      drones: [droneSemZona],
      base: ORIGEM,
      tempos: TEMPOS,
      mapa: MAPA_SEM_ZONAS,
    });

    const pedidoComZona = novoPedido({ x: DESTINO.x, y: DESTINO.y, pesoKg: 1 });
    const viagemComZona = criarViagem({
      droneId: 'drone-2',
      pedidos: [pedidoComZona],
      base: ORIGEM,
      capacidadeKg: 10,
      alcanceQuadras: 100,
      mapa: MAPA_ZONA,
      gerarId: () => 'viagem-com-zona',
    });
    const droneComZona = criarDrone({
      base: ORIGEM,
      capacidadeKg: 10,
      alcanceQuadras: 100,
      gerarId: () => 'drone-2',
    });

    const resultadoComZona = simular({
      viagens: [viagemComZona],
      pedidos: [pedidoComZona],
      drones: [droneComZona],
      base: ORIGEM,
      tempos: TEMPOS,
      mapa: MAPA_ZONA,
    });

    const chegadaSemZona = resultadoSemZona.eventos.find((e) => e.tipo === 'chegada_parada')!;
    const chegadaComZona = resultadoComZona.eventos.find((e) => e.tipo === 'chegada_parada')!;
    const bateriaConsumidaSemZona = 100 - chegadaSemZona.bateriaQuadras;
    const bateriaConsumidaComZona = 100 - chegadaComZona.bateriaQuadras;

    expect(bateriaConsumidaComZona).toBeGreaterThan(bateriaConsumidaSemZona);
    expect(chegadaComZona.instanteMin).toBeGreaterThan(chegadaSemZona.instanteMin);
    expect(resultadoComZona.metricas.makespanMin).toBeGreaterThan(
      resultadoSemZona.metricas.makespanMin,
    );
  });

  it('a distância total do drone deriva das pernas percorridas, não do campo persistido na viagem', () => {
    const pedido = novoPedido({ x: DESTINO.x, y: DESTINO.y, pesoKg: 1 });
    const viagemReal = criarViagem({
      droneId: 'drone-1',
      pedidos: [pedido],
      base: ORIGEM,
      capacidadeKg: 10,
      alcanceQuadras: 100,
      mapa: MAPA_ZONA,
      gerarId: () => 'viagem-legado',
    });
    // Simula uma viagem persistida antes das zonas: paradas corretas, mas
    // "congelada" com a distância Manhattan antiga (sem o desvio real).
    const distanciaManhattanRedondaAntiga = 2 * distanciaManhattan(ORIGEM, DESTINO);
    const viagemComCampoDesatualizado: Viagem = {
      ...viagemReal,
      distanciaQuadras: distanciaManhattanRedondaAntiga,
    };
    const drone = criarDrone({
      base: ORIGEM,
      capacidadeKg: 10,
      alcanceQuadras: 100,
      gerarId: () => 'drone-1',
    });

    const resultado = simular({
      viagens: [viagemComCampoDesatualizado],
      pedidos: [pedido],
      drones: [drone],
      base: ORIGEM,
      tempos: TEMPOS,
      mapa: MAPA_ZONA,
    });

    expect(viagemComCampoDesatualizado.distanciaQuadras).not.toBe(viagemReal.distanciaQuadras);
    expect(resultado.metricas.porDrone[0]?.distanciaQuadras).toBe(viagemReal.distanciaQuadras);
    expect(resultado.metricas.porDrone[0]?.distanciaQuadras).not.toBe(
      viagemComCampoDesatualizado.distanciaQuadras,
    );
  });

  it('bateria insuficiente por causa do desvio falha com BATERIA_INSUFICIENTE', () => {
    expect.assertions(2);
    const pedido = novoPedido({ x: DESTINO.x, y: DESTINO.y, pesoKg: 1 });
    const viagem = criarViagem({
      droneId: 'drone-1',
      pedidos: [pedido],
      base: ORIGEM,
      capacidadeKg: 10,
      alcanceQuadras: 100,
      mapa: MAPA_ZONA,
      gerarId: () => 'viagem-bateria',
    });
    // Bateria cobre a distância Manhattan direta (6), mas não o desvio real (12).
    const bateriaLimitada = distanciaManhattan(ORIGEM, DESTINO) + 1;
    const drone = criarDrone({
      base: ORIGEM,
      capacidadeKg: 10,
      alcanceQuadras: bateriaLimitada,
      gerarId: () => 'drone-1',
    });

    try {
      simular({
        viagens: [viagem],
        pedidos: [pedido],
        drones: [drone],
        base: ORIGEM,
        tempos: TEMPOS,
        mapa: MAPA_ZONA,
      });
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroDominio);
      expect((erro as ErroDominio).codigo).toBe('BATERIA_INSUFICIENTE');
    }
  });

  it('determinismo é preservado com zonas: duas execuções produzem linhas do tempo idênticas', () => {
    const pedido = novoPedido({ x: DESTINO.x, y: DESTINO.y, pesoKg: 1 });
    const viagem = criarViagem({
      droneId: 'drone-1',
      pedidos: [pedido],
      base: ORIGEM,
      capacidadeKg: 10,
      alcanceQuadras: 100,
      mapa: MAPA_ZONA,
      gerarId: () => 'viagem-determinismo-zona',
    });
    const drone = criarDrone({
      base: ORIGEM,
      capacidadeKg: 10,
      alcanceQuadras: 100,
      gerarId: () => 'drone-1',
    });
    const opcoes = {
      viagens: [viagem],
      pedidos: [pedido],
      drones: [drone],
      base: ORIGEM,
      tempos: TEMPOS,
      mapa: MAPA_ZONA,
    };

    const resultado1 = simular(opcoes);
    const resultado2 = simular(opcoes);

    expect(resultado1).toEqual(resultado2);
  });
});
