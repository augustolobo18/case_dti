import { describe, it, expect } from 'vitest';
import { ErroDominio } from './erros.js';
import type { Coordenada } from './coordenada.js';
import { criarMapaCidade, type MapaCidade, type ZonaExclusao } from './mapa.js';
import { criarPedido, type LimitesPedido, type Pedido, type Prioridade } from './pedido.js';
import { alocarPedidos, ordenarParaAlocacao } from './alocacao.js';

const BASE: Coordenada = { x: 0, y: 0 };
const LIMITES: LimitesPedido = { capacidadeKg: 1000, cidadeTamanho: 1000 };
let contador = 0;
const gerarIdPedido = () => `pedido-${(contador += 1)}`;

/** Mapa sem zonas de exclusão — distância se comporta como Manhattan pura. */
const MAPA_SEM_ZONAS: MapaCidade = criarMapaCidade({ cidadeTamanho: 1000, zonas: [] });

function mapaComZonas(zonas: ZonaExclusao[], cidadeTamanho = 1000): MapaCidade {
  return criarMapaCidade({ cidadeTamanho, zonas });
}

function novoPedido(
  dados: Partial<{ x: number; y: number; pesoKg: number; prioridade: string }> = {},
): Pedido {
  return criarPedido(
    {
      x: dados.x ?? 0,
      y: dados.y ?? 0,
      pesoKg: dados.pesoKg ?? 1,
      prioridade: dados.prioridade ?? 'baixa',
    },
    { limites: LIMITES, gerarId: gerarIdPedido },
  );
}

/** Gerador pseudoaleatório determinístico (mulberry32) — sem `Math.random`. */
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

function gerarPedidosAleatorios(quantidade: number, seed: number, limiteMalha = 50): Pedido[] {
  const aleatorio = criarGeradorSeed(seed);
  const prioridades: Prioridade[] = ['baixa', 'media', 'alta'];
  const pedidos: Pedido[] = [];
  for (let i = 0; i < quantidade; i += 1) {
    pedidos.push(
      novoPedido({
        x: Math.floor(aleatorio() * limiteMalha),
        y: Math.floor(aleatorio() * limiteMalha),
        pesoKg: Math.floor(aleatorio() * 9) + 1,
        prioridade: prioridades[Math.floor(aleatorio() * 3)],
      }),
    );
  }
  return pedidos;
}

describe('ordenarParaAlocacao', () => {
  it('ordena alta antes de media antes de baixa', () => {
    const baixa = novoPedido({ prioridade: 'baixa' });
    const media = novoPedido({ prioridade: 'media' });
    const alta = novoPedido({ prioridade: 'alta' });

    const ordenados = ordenarParaAlocacao([baixa, media, alta], BASE, MAPA_SEM_ZONAS);

    expect(ordenados.map((p) => p.id)).toEqual([alta.id, media.id, baixa.id]);
  });

  it('empate de prioridade resolve por menor distância da base', () => {
    const longe = novoPedido({ x: 5, y: 0, prioridade: 'alta' });
    const perto = novoPedido({ x: 1, y: 0, prioridade: 'alta' });

    const ordenados = ordenarParaAlocacao([longe, perto], BASE, MAPA_SEM_ZONAS);

    expect(ordenados.map((p) => p.id)).toEqual([perto.id, longe.id]);
  });

  it('empate remanescente resolve por maior peso', () => {
    const leve = novoPedido({ x: 1, y: 0, pesoKg: 1, prioridade: 'alta' });
    const pesado = novoPedido({ x: 1, y: 0, pesoKg: 5, prioridade: 'alta' });

    const ordenados = ordenarParaAlocacao([leve, pesado], BASE, MAPA_SEM_ZONAS);

    expect(ordenados.map((p) => p.id)).toEqual([pesado.id, leve.id]);
  });

  it('mesma entrada em ordem embaralhada produz sempre a mesma saída', () => {
    const a = novoPedido({ x: 1, y: 0, pesoKg: 1, prioridade: 'alta' });
    const b = novoPedido({ x: 2, y: 0, pesoKg: 2, prioridade: 'media' });
    const c = novoPedido({ x: 3, y: 0, pesoKg: 3, prioridade: 'baixa' });

    const ordem1 = ordenarParaAlocacao([a, b, c], BASE, MAPA_SEM_ZONAS).map((p) => p.id);
    const ordem2 = ordenarParaAlocacao([c, a, b], BASE, MAPA_SEM_ZONAS).map((p) => p.id);

    expect(ordem1).toEqual(ordem2);
  });

  it('não muta a entrada', () => {
    const a = novoPedido({ prioridade: 'baixa' });
    const b = novoPedido({ prioridade: 'alta' });
    const entrada = [a, b];
    const copia = [...entrada];

    ordenarParaAlocacao(entrada, BASE, MAPA_SEM_ZONAS);

    expect(entrada).toEqual(copia);
  });
});

describe('alocarPedidos — greedy (D9)', () => {
  it('pedidos que somados cabem viram uma única viagem', () => {
    const p1 = novoPedido({ x: 1, y: 0, pesoKg: 3 });
    const p2 = novoPedido({ x: 2, y: 0, pesoKg: 3 });

    const resultado = alocarPedidos({
      pedidos: [p1, p2],
      droneIds: ['drone-1'],
      base: BASE,
      capacidadeKg: 10,
      alcanceQuadras: 40,
      mapa: MAPA_SEM_ZONAS,
      gerarId: () => 'viagem-1',
    });

    expect(resultado.viagens).toHaveLength(1);
    expect([...(resultado.viagens[0]?.pedidoIds ?? [])].sort()).toEqual([p1.id, p2.id].sort());
    expect(resultado.naoAlocados).toEqual([]);
  });

  it('peso excedente abre uma segunda viagem', () => {
    const p1 = novoPedido({ x: 1, y: 0, pesoKg: 8 });
    const p2 = novoPedido({ x: 2, y: 0, pesoKg: 8 });

    const resultado = alocarPedidos({
      pedidos: [p1, p2],
      droneIds: ['drone-1', 'drone-2'],
      base: BASE,
      capacidadeKg: 10,
      alcanceQuadras: 40,
      mapa: MAPA_SEM_ZONAS,
    });

    expect(resultado.viagens).toHaveLength(2);
  });

  it('nenhuma viagem gerada excede capacidade nem alcance', () => {
    const pedidos = [
      novoPedido({ x: 5, y: 0, pesoKg: 7 }),
      novoPedido({ x: 6, y: 0, pesoKg: 7 }),
      novoPedido({ x: 7, y: 0, pesoKg: 7 }),
    ];

    const resultado = alocarPedidos({
      pedidos,
      droneIds: ['drone-1', 'drone-2', 'drone-3'],
      base: BASE,
      capacidadeKg: 10,
      alcanceQuadras: 40,
      mapa: MAPA_SEM_ZONAS,
    });

    for (const viagem of resultado.viagens) {
      expect(viagem.cargaKg).toBeLessThanOrEqual(10);
      expect(viagem.distanciaQuadras).toBeLessThanOrEqual(40);
    }
  });

  it('um alta distante não impede que um baixa próximo entre na mesma viagem quando ainda cabe', () => {
    const altaDistante = novoPedido({ x: 20, y: 0, pesoKg: 5, prioridade: 'alta' });
    const baixaPerto = novoPedido({ x: 1, y: 0, pesoKg: 5, prioridade: 'baixa' });

    const resultado = alocarPedidos({
      pedidos: [altaDistante, baixaPerto],
      droneIds: ['drone-1'],
      base: BASE,
      capacidadeKg: 10,
      alcanceQuadras: 100,
      mapa: MAPA_SEM_ZONAS,
    });

    expect(resultado.viagens).toHaveLength(1);
    expect([...(resultado.viagens[0]?.pedidoIds ?? [])].sort()).toEqual(
      [altaDistante.id, baixaPerto.id].sort(),
    );
  });
});

describe('alocarPedidos — prioridade soberana', () => {
  it('com dois pedidos que não cabem juntos, o alta vai na primeira viagem', () => {
    const alta = novoPedido({ x: 1, y: 0, pesoKg: 8, prioridade: 'alta' });
    const baixa = novoPedido({ x: 2, y: 0, pesoKg: 8, prioridade: 'baixa' });

    const resultado = alocarPedidos({
      pedidos: [baixa, alta],
      droneIds: ['drone-1', 'drone-2'],
      base: BASE,
      capacidadeKg: 10,
      alcanceQuadras: 40,
      mapa: MAPA_SEM_ZONAS,
    });

    const primeiraViagem = resultado.viagens[0];
    expect(primeiraViagem?.pedidoIds).toEqual([alta.id]);
  });
});

describe('alocarPedidos — inviáveis', () => {
  it('destino cujo ida-e-volta excede o alcance sai em naoAlocados com INALCANCAVEL', () => {
    const inalcancavel = novoPedido({ x: 30, y: 0, pesoKg: 1 });
    const alcancavel = novoPedido({ x: 1, y: 0, pesoKg: 1 });

    const resultado = alocarPedidos({
      pedidos: [inalcancavel, alcancavel],
      droneIds: ['drone-1'],
      base: BASE,
      capacidadeKg: 10,
      alcanceQuadras: 40,
      mapa: MAPA_SEM_ZONAS,
    });

    expect(resultado.naoAlocados).toEqual([
      expect.objectContaining({ pedidoId: inalcancavel.id, motivo: 'INALCANCAVEL' }),
    ]);
    expect(resultado.viagens.some((v) => v.pedidoIds.includes(inalcancavel.id))).toBe(false);
    expect(resultado.viagens.some((v) => v.pedidoIds.includes(alcancavel.id))).toBe(true);
  });

  it('peso acima da capacidade atual sai com PESO_ACIMA_CAPACIDADE', () => {
    const pesadoDemais = novoPedido({ x: 1, y: 0, pesoKg: 500 });
    const leve = novoPedido({ x: 1, y: 0, pesoKg: 1 });

    const resultado = alocarPedidos({
      pedidos: [pesadoDemais, leve],
      droneIds: ['drone-1'],
      base: BASE,
      capacidadeKg: 10,
      alcanceQuadras: 40,
      mapa: MAPA_SEM_ZONAS,
    });

    expect(resultado.naoAlocados).toEqual([
      expect.objectContaining({ pedidoId: pesadoDemais.id, motivo: 'PESO_ACIMA_CAPACIDADE' }),
    ]);
    expect(resultado.viagens.some((v) => v.pedidoIds.includes(leve.id))).toBe(true);
  });

  it('destino dentro de uma zona de exclusão sai em naoAlocados com DESTINO_BLOQUEADO', () => {
    const mapa = mapaComZonas([{ de: { x: 3, y: 3 }, ate: { x: 3, y: 3 } }], 10);
    const bloqueado = novoPedido({ x: 3, y: 3, pesoKg: 1 });
    const livre = novoPedido({ x: 1, y: 0, pesoKg: 1 });

    const resultado = alocarPedidos({
      pedidos: [bloqueado, livre],
      droneIds: ['drone-1'],
      base: BASE,
      capacidadeKg: 10,
      alcanceQuadras: 40,
      mapa,
    });

    expect(resultado.naoAlocados).toEqual([
      expect.objectContaining({ pedidoId: bloqueado.id, motivo: 'DESTINO_BLOQUEADO' }),
    ]);
    expect(resultado.viagens.some((v) => v.pedidoIds.includes(livre.id))).toBe(true);
    // As demais viagens continuam intactas mesmo com um pedido bloqueado (D29).
    expect(resultado.viagens.every((v) => !v.pedidoIds.includes(bloqueado.id))).toBe(true);
  });

  it('destino cercado por zonas em todos os lados sai em naoAlocados com SEM_ROTA', () => {
    const zonas: ZonaExclusao[] = [
      { de: { x: 1, y: 1 }, ate: { x: 3, y: 1 } },
      { de: { x: 1, y: 3 }, ate: { x: 3, y: 3 } },
      { de: { x: 1, y: 1 }, ate: { x: 1, y: 3 } },
      { de: { x: 3, y: 1 }, ate: { x: 3, y: 3 } },
    ];
    const mapa = mapaComZonas(zonas, 10);
    const cercado = novoPedido({ x: 2, y: 2, pesoKg: 1 });
    const livre = novoPedido({ x: 1, y: 0, pesoKg: 1 });

    const resultado = alocarPedidos({
      pedidos: [cercado, livre],
      droneIds: ['drone-1'],
      base: BASE,
      capacidadeKg: 10,
      alcanceQuadras: 40,
      mapa,
    });

    expect(resultado.naoAlocados).toEqual([
      expect.objectContaining({ pedidoId: cercado.id, motivo: 'SEM_ROTA' }),
    ]);
    expect(resultado.viagens.some((v) => v.pedidoIds.includes(livre.id))).toBe(true);
  });
});

describe('alocarPedidos — round-robin', () => {
  it('com 2 drones e 3 viagens, a distribuição é drone-1, drone-2, drone-1', () => {
    // Cada par de pedidos cabe exatamente em uma viagem (peso 10 = capacidade),
    // forçando o greedy a abrir 3 viagens para 3 pares distintos.
    const pedidos = [
      novoPedido({ x: 1, y: 0, pesoKg: 10, prioridade: 'alta' }),
      novoPedido({ x: 2, y: 0, pesoKg: 10, prioridade: 'alta' }),
      novoPedido({ x: 3, y: 0, pesoKg: 10, prioridade: 'alta' }),
    ];

    const resultado = alocarPedidos({
      pedidos,
      droneIds: ['drone-1', 'drone-2'],
      base: BASE,
      capacidadeKg: 10,
      alcanceQuadras: 40,
      mapa: MAPA_SEM_ZONAS,
    });

    expect(resultado.viagens).toHaveLength(3);
    expect(resultado.viagens.map((v) => v.droneId)).toEqual(['drone-1', 'drone-2', 'drone-1']);
  });

  it('frota vazia lança ErroDominio FROTA_VAZIA', () => {
    expect.assertions(2);
    const pedido = novoPedido({ x: 1, y: 0, pesoKg: 1 });

    try {
      alocarPedidos({
        pedidos: [pedido],
        droneIds: [],
        base: BASE,
        capacidadeKg: 10,
        alcanceQuadras: 40,
        mapa: MAPA_SEM_ZONAS,
      });
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroDominio);
      expect((erro as ErroDominio).codigo).toBe('FROTA_VAZIA');
    }
  });
});

describe('alocarPedidos — filtro de status', () => {
  it('ignora pedidos cancelado, alocado ou entregue', () => {
    const pendente = novoPedido({ x: 1, y: 0 });
    const cancelado = { ...novoPedido({ x: 1, y: 0 }), status: 'cancelado' as const };
    const alocado = { ...novoPedido({ x: 1, y: 0 }), status: 'alocado' as const };
    const entregue = { ...novoPedido({ x: 1, y: 0 }), status: 'entregue' as const };

    const resultado = alocarPedidos({
      pedidos: [pendente, cancelado, alocado, entregue],
      droneIds: ['drone-1'],
      base: BASE,
      capacidadeKg: 10,
      alcanceQuadras: 40,
      mapa: MAPA_SEM_ZONAS,
    });

    const idsAlocados = resultado.viagens.flatMap((v) => v.pedidoIds);
    expect(idsAlocados).toEqual([pendente.id]);
    expect(resultado.naoAlocados).toEqual([]);
  });
});

describe('alocarPedidos — determinismo e carga', () => {
  it('entrada vazia devolve { viagens: [], naoAlocados: [] }', () => {
    const resultado = alocarPedidos({
      pedidos: [],
      droneIds: ['drone-1'],
      base: BASE,
      capacidadeKg: 10,
      alcanceQuadras: 40,
      mapa: MAPA_SEM_ZONAS,
    });

    expect(resultado).toEqual({ viagens: [], naoAlocados: [] });
  });

  it('com ~500 pedidos gerados por seed fixa, duas execuções produzem o mesmo resultado e nenhuma viagem viola os limites', () => {
    const pedidos = gerarPedidosAleatorios(500, 42);

    function criarGeradorIdViagem(): () => string {
      let contadorViagem = 0;
      return () => `viagem-${(contadorViagem += 1)}`;
    }

    function opcoesParaExecucao() {
      return {
        pedidos,
        droneIds: ['drone-1', 'drone-2', 'drone-3', 'drone-4', 'drone-5'],
        base: BASE,
        capacidadeKg: 10,
        alcanceQuadras: 60,
        mapa: MAPA_SEM_ZONAS,
        gerarId: criarGeradorIdViagem(),
      };
    }

    const resultado1 = alocarPedidos(opcoesParaExecucao());
    const resultado2 = alocarPedidos(opcoesParaExecucao());

    expect(resultado1).toEqual(resultado2);

    for (const viagem of resultado1.viagens) {
      expect(viagem.cargaKg).toBeLessThanOrEqual(10);
      expect(viagem.distanciaQuadras).toBeLessThanOrEqual(60);
    }

    const idsEmViagens = new Set(resultado1.viagens.flatMap((v) => v.pedidoIds));
    const idsNaoAlocados = new Set(resultado1.naoAlocados.map((n) => n.pedidoId));
    // Todo pedido pendente está ou alocado, ou reportado — nunca as duas coisas.
    for (const pedido of pedidos) {
      const emViagem = idsEmViagens.has(pedido.id);
      const naoAlocado = idsNaoAlocados.has(pedido.id);
      expect(emViagem !== naoAlocado).toBe(true);
    }
  });

  it('com ~500 pedidos e zonas de exclusão, o custo continua tratável e nenhuma viagem viola os limites', () => {
    // Malha pequena (0..50) para o cenário com zonas: mantém o pathfinding
    // (BFS memoizado por origem) barato mesmo para várias centenas de pedidos.
    const cidadeTamanho = 50;
    const pedidos = gerarPedidosAleatorios(500, 7, cidadeTamanho);
    const zonas: ZonaExclusao[] = [
      { de: { x: 20, y: 0 }, ate: { x: 20, y: 35 } },
      { de: { x: 35, y: 15 }, ate: { x: 35, y: 50 } },
    ];
    const mapa = mapaComZonas(zonas, cidadeTamanho);

    function criarGeradorIdViagem(): () => string {
      let contadorViagem = 0;
      return () => `viagem-zona-${(contadorViagem += 1)}`;
    }

    const resultado = alocarPedidos({
      pedidos,
      droneIds: ['drone-1', 'drone-2', 'drone-3', 'drone-4', 'drone-5'],
      base: BASE,
      capacidadeKg: 10,
      alcanceQuadras: 200,
      mapa,
      gerarId: criarGeradorIdViagem(),
    });

    for (const viagem of resultado.viagens) {
      expect(viagem.cargaKg).toBeLessThanOrEqual(10);
      expect(viagem.distanciaQuadras).toBeLessThanOrEqual(200);
    }

    const idsEmViagens = new Set(resultado.viagens.flatMap((v) => v.pedidoIds));
    const idsNaoAlocados = new Set(resultado.naoAlocados.map((n) => n.pedidoId));
    for (const pedido of pedidos) {
      const emViagem = idsEmViagens.has(pedido.id);
      const naoAlocado = idsNaoAlocados.has(pedido.id);
      expect(emViagem !== naoAlocado).toBe(true);
    }
  });
});
