import { describe, it, expect } from 'vitest';
import { ErroDominio } from './erros.js';
import type { Coordenada } from './coordenada.js';
import { criarPedido, type LimitesPedido, type Pedido, type Prioridade } from './pedido.js';
import { alocarPedidos, ordenarParaAlocacao } from './alocacao.js';

const BASE: Coordenada = { x: 0, y: 0 };
const LIMITES: LimitesPedido = { capacidadeKg: 1000, cidadeTamanho: 1000 };
let contador = 0;
const gerarIdPedido = () => `pedido-${(contador += 1)}`;

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

function gerarPedidosAleatorios(quantidade: number, seed: number): Pedido[] {
  const aleatorio = criarGeradorSeed(seed);
  const prioridades: Prioridade[] = ['baixa', 'media', 'alta'];
  const pedidos: Pedido[] = [];
  for (let i = 0; i < quantidade; i += 1) {
    pedidos.push(
      novoPedido({
        x: Math.floor(aleatorio() * 50),
        y: Math.floor(aleatorio() * 50),
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

    const ordenados = ordenarParaAlocacao([baixa, media, alta], BASE);

    expect(ordenados.map((p) => p.id)).toEqual([alta.id, media.id, baixa.id]);
  });

  it('empate de prioridade resolve por menor distância da base', () => {
    const longe = novoPedido({ x: 5, y: 0, prioridade: 'alta' });
    const perto = novoPedido({ x: 1, y: 0, prioridade: 'alta' });

    const ordenados = ordenarParaAlocacao([longe, perto], BASE);

    expect(ordenados.map((p) => p.id)).toEqual([perto.id, longe.id]);
  });

  it('empate remanescente resolve por maior peso', () => {
    const leve = novoPedido({ x: 1, y: 0, pesoKg: 1, prioridade: 'alta' });
    const pesado = novoPedido({ x: 1, y: 0, pesoKg: 5, prioridade: 'alta' });

    const ordenados = ordenarParaAlocacao([leve, pesado], BASE);

    expect(ordenados.map((p) => p.id)).toEqual([pesado.id, leve.id]);
  });

  it('mesma entrada em ordem embaralhada produz sempre a mesma saída', () => {
    const a = novoPedido({ x: 1, y: 0, pesoKg: 1, prioridade: 'alta' });
    const b = novoPedido({ x: 2, y: 0, pesoKg: 2, prioridade: 'media' });
    const c = novoPedido({ x: 3, y: 0, pesoKg: 3, prioridade: 'baixa' });

    const ordem1 = ordenarParaAlocacao([a, b, c], BASE).map((p) => p.id);
    const ordem2 = ordenarParaAlocacao([c, a, b], BASE).map((p) => p.id);

    expect(ordem1).toEqual(ordem2);
  });

  it('não muta a entrada', () => {
    const a = novoPedido({ prioridade: 'baixa' });
    const b = novoPedido({ prioridade: 'alta' });
    const entrada = [a, b];
    const copia = [...entrada];

    ordenarParaAlocacao(entrada, BASE);

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
    });

    expect(resultado.naoAlocados).toEqual([
      expect.objectContaining({ pedidoId: pesadoDemais.id, motivo: 'PESO_ACIMA_CAPACIDADE' }),
    ]);
    expect(resultado.viagens.some((v) => v.pedidoIds.includes(leve.id))).toBe(true);
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
});
