import { describe, it, expect } from 'vitest';
import { ErroDominio } from './erros.js';
import type { Coordenada } from './coordenada.js';
import { criarPedido, type LimitesPedido, type Pedido } from './pedido.js';
import { criarViagem, reconciliarViagens, rotearNearestNeighbor } from './viagem.js';

const BASE: Coordenada = { x: 0, y: 0 };
const LIMITES: LimitesPedido = { capacidadeKg: 100, cidadeTamanho: 100 };
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

describe('rotearNearestNeighbor', () => {
  it('lista vazia devolve só a base e distância 0', () => {
    const resultado = rotearNearestNeighbor(BASE, []);

    expect(resultado.paradas).toEqual([BASE]);
    expect(resultado.distanciaQuadras).toBe(0);
  });

  it('um destino devolve [base, destino, base] com distância 2 × manhattan', () => {
    const destino: Coordenada = { x: 3, y: 4 };

    const resultado = rotearNearestNeighbor(BASE, [destino]);

    expect(resultado.paradas).toEqual([BASE, destino, BASE]);
    expect(resultado.distanciaQuadras).toBe(2 * 7);
  });

  it('três destinos são visitados na ordem do vizinho mais próximo, não na ordem de entrada', () => {
    const perto: Coordenada = { x: 1, y: 0 };
    const meio: Coordenada = { x: 3, y: 0 };
    const longe: Coordenada = { x: 6, y: 0 };

    const resultado = rotearNearestNeighbor(BASE, [longe, perto, meio]);

    expect(resultado.paradas).toEqual([BASE, perto, meio, longe, BASE]);
    expect(resultado.distanciaQuadras).toBe(1 + 2 + 3 + 6);
  });

  it('empate de distância resolve por menor x, depois menor y (determinismo)', () => {
    const candidatoA: Coordenada = { x: 2, y: 5 };
    const candidatoB: Coordenada = { x: 5, y: 2 };

    const resultado = rotearNearestNeighbor(BASE, [candidatoB, candidatoA]);

    expect(resultado.paradas[1]).toEqual(candidatoA);
  });

  it('não muta a entrada de destinos', () => {
    const destinos: Coordenada[] = [
      { x: 5, y: 0 },
      { x: 1, y: 0 },
    ];
    const copia = [...destinos];

    rotearNearestNeighbor(BASE, destinos);

    expect(destinos).toEqual(copia);
  });
});

describe('criarViagem', () => {
  const gerarIdFixo = () => 'viagem-fixa';

  it('monta viagem válida com cargaKg somado e distanciaQuadras da rota', () => {
    const pedidoA = novoPedido({ x: 1, y: 0, pesoKg: 2 });
    const pedidoB = novoPedido({ x: 3, y: 0, pesoKg: 3 });

    const viagem = criarViagem({
      droneId: 'drone-1',
      pedidos: [pedidoA, pedidoB],
      base: BASE,
      capacidadeKg: 10,
      alcanceQuadras: 40,
      gerarId: gerarIdFixo,
    });

    expect(viagem).toEqual({
      id: 'viagem-fixa',
      droneId: 'drone-1',
      pedidoIds: [pedidoA.id, pedidoB.id],
      paradas: [BASE, pedidoA.destino, pedidoB.destino, BASE],
      distanciaQuadras: 1 + 2 + 3,
      cargaKg: 5,
    });
  });

  it('aceita viagem exatamente no limite de capacidade (borda inclusiva)', () => {
    const pedido = novoPedido({ x: 1, y: 0, pesoKg: 10 });

    const viagem = criarViagem({
      droneId: 'drone-1',
      pedidos: [pedido],
      base: BASE,
      capacidadeKg: 10,
      alcanceQuadras: 40,
      gerarId: gerarIdFixo,
    });

    expect(viagem.cargaKg).toBe(10);
  });

  it('aceita viagem exatamente no limite de alcance (borda inclusiva)', () => {
    const pedido = novoPedido({ x: 5, y: 0, pesoKg: 1 });

    const viagem = criarViagem({
      droneId: 'drone-1',
      pedidos: [pedido],
      base: BASE,
      capacidadeKg: 10,
      alcanceQuadras: 10,
      gerarId: gerarIdFixo,
    });

    expect(viagem.distanciaQuadras).toBe(10);
  });

  it('lança VIAGEM_ACIMA_CAPACIDADE quando a carga excede a capacidade', () => {
    expect.assertions(2);
    const pedido = novoPedido({ x: 1, y: 0, pesoKg: 11 });

    try {
      criarViagem({
        droneId: 'drone-1',
        pedidos: [pedido],
        base: BASE,
        capacidadeKg: 10,
        alcanceQuadras: 40,
        gerarId: gerarIdFixo,
      });
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroDominio);
      expect((erro as ErroDominio).codigo).toBe('VIAGEM_ACIMA_CAPACIDADE');
    }
  });

  it('lança VIAGEM_ACIMA_ALCANCE quando a distância excede o alcance', () => {
    expect.assertions(2);
    const pedido = novoPedido({ x: 6, y: 0, pesoKg: 1 });

    try {
      criarViagem({
        droneId: 'drone-1',
        pedidos: [pedido],
        base: BASE,
        capacidadeKg: 10,
        alcanceQuadras: 10,
        gerarId: gerarIdFixo,
      });
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroDominio);
      expect((erro as ErroDominio).codigo).toBe('VIAGEM_ACIMA_ALCANCE');
    }
  });

  it('lança VIAGEM_SEM_PEDIDOS quando a lista de pedidos está vazia', () => {
    expect.assertions(2);
    try {
      criarViagem({
        droneId: 'drone-1',
        pedidos: [],
        base: BASE,
        capacidadeKg: 10,
        alcanceQuadras: 40,
        gerarId: gerarIdFixo,
      });
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroDominio);
      expect((erro as ErroDominio).codigo).toBe('VIAGEM_SEM_PEDIDOS');
    }
  });

  it('usa o gerarId injetado', () => {
    const pedido = novoPedido({ x: 1, y: 0, pesoKg: 1 });

    const viagem = criarViagem({
      droneId: 'drone-1',
      pedidos: [pedido],
      base: BASE,
      capacidadeKg: 10,
      alcanceQuadras: 40,
      gerarId: () => 'id-customizado',
    });

    expect(viagem.id).toBe('id-customizado');
  });
});

describe('reconciliarViagens', () => {
  const pedido = novoPedido({ x: 1, y: 0, pesoKg: 1 });
  const viagemValida = criarViagem({
    droneId: 'drone-1',
    pedidos: [pedido],
    base: BASE,
    capacidadeKg: 10,
    alcanceQuadras: 40,
    gerarId: () => 'viagem-1',
  });
  const pedidoOrfao = novoPedido({ x: 2, y: 0, pesoKg: 1 });
  const viagemOrfa = criarViagem({
    droneId: 'drone-9',
    pedidos: [pedidoOrfao],
    base: BASE,
    capacidadeKg: 10,
    alcanceQuadras: 40,
    gerarId: () => 'viagem-2',
  });

  it('frota completa mantém tudo e devolve pedidoIdsOrfaos vazio', () => {
    const resultado = reconciliarViagens([viagemValida], ['drone-1', 'drone-2']);

    expect(resultado.viagens).toEqual([viagemValida]);
    expect(resultado.pedidoIdsOrfaos).toEqual([]);
  });

  it('viagem com droneId inexistente é removida e seus pedidoIds saem como órfãos', () => {
    const resultado = reconciliarViagens([viagemValida, viagemOrfa], ['drone-1']);

    expect(resultado.viagens).toEqual([viagemValida]);
    expect(resultado.pedidoIdsOrfaos).toEqual([pedidoOrfao.id]);
  });

  it('não muta a entrada', () => {
    const entrada = [viagemValida, viagemOrfa];
    const copia = [...entrada];

    reconciliarViagens(entrada, ['drone-1']);

    expect(entrada).toEqual(copia);
  });
});
