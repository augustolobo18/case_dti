import type { Express } from 'express';
import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import { criarApp } from '../server.js';
import type { CorpoErro } from '../erros.js';
import { criarPedido, type LimitesPedido, type Pedido } from '../../domain/pedido.js';
import { criarPersistenciaMemoria as criarPersistenciaMemoriaPedidos } from '../../infra/persistencia-pedidos.js';
import { criarPersistenciaMemoria as criarPersistenciaMemoriaViagens } from '../../infra/persistencia-viagens.js';
import { criarRepositorioPedidos, type RepositorioPedidos } from '../../repositorio/pedidos.js';
import { criarRepositorioFrota, type OpcoesFrota } from '../../repositorio/frota.js';
import { criarRepositorioViagens, type RepositorioViagens } from '../../repositorio/viagens.js';
import { criarServicoSimulacao, type ServicoSimulacao } from '../../servicos/simulacao.js';
import type { TemposSimulacao } from '../../domain/simulacao.js';
import type { RespostaViagem } from '../apresentadores/viagem.js';

const LIMITES: LimitesPedido = { capacidadeKg: 10, cidadeTamanho: 100 };
const OPCOES_FROTA: OpcoesFrota = {
  base: { x: 0, y: 0 },
  capacidadeKg: 10,
  alcanceQuadras: 40,
  quantidade: 2,
};
const TEMPOS: TemposSimulacao = {
  velocidadeQuadrasMin: 1,
  carregamentoMin: 5,
  entregaMin: 2,
  recargaMinPorQuadra: 0.5,
};

/** Tipa o corpo da resposta como envelope de erro (D20), evitando acesso `any`. */
function comoErro(corpo: unknown): CorpoErro {
  return corpo as CorpoErro;
}

/** Corpo da resposta de `POST /entregas/alocar`. */
type CorpoAlocar = {
  readonly viagens: RespostaViagem[];
  readonly naoAlocados: readonly { pedidoId: string; motivo: string; mensagem: string }[];
};

function comoAlocacao(corpo: unknown): CorpoAlocar {
  return corpo as CorpoAlocar;
}

function comoListaViagens(corpo: unknown): RespostaViagem[] {
  return corpo as RespostaViagem[];
}

function comoListaPedidos(corpo: unknown): Pedido[] {
  return corpo as Pedido[];
}

let pedidos: RepositorioPedidos;
let viagens: RepositorioViagens;
let simulacao: ServicoSimulacao;
let app: Express;
let contador = 0;

function novoPedidoAjudante(
  dados: Partial<{ x: number; y: number; pesoKg: number; prioridade: string }> = {},
) {
  contador += 1;
  const idFixo = `pedido-teste-${contador}`;
  return criarPedido(
    {
      x: dados.x ?? 1,
      y: dados.y ?? 0,
      pesoKg: dados.pesoKg ?? 1,
      prioridade: dados.prioridade ?? 'baixa',
    },
    { limites: LIMITES, gerarId: () => idFixo },
  );
}

beforeEach(() => {
  pedidos = criarRepositorioPedidos(criarPersistenciaMemoriaPedidos());
  const frota = criarRepositorioFrota(OPCOES_FROTA);
  viagens = criarRepositorioViagens({
    persistencia: criarPersistenciaMemoriaViagens(),
    droneIds: frota.listar().map((d) => d.id),
  });
  simulacao = criarServicoSimulacao({
    pedidos,
    frota,
    viagens,
    base: OPCOES_FROTA.base,
    tempos: TEMPOS,
  });
  app = criarApp({ pedidos, frota, viagens, simulacao });
  contador = 0;
});

describe('GET /entregas/rota', () => {
  it('sem alocação devolve 200 com lista vazia', async () => {
    const resposta = await request(app).get('/entregas/rota');

    expect(resposta.status).toBe(200);
    expect(resposta.body).toEqual([]);
  });

  it('depois de alocar, devolve as mesmas viagens', async () => {
    pedidos.adicionar(novoPedidoAjudante({ x: 1, y: 0, pesoKg: 3 }));

    await request(app).post('/entregas/alocar');
    const resposta = await request(app).get('/entregas/rota');

    expect(resposta.status).toBe(200);
    expect(comoListaViagens(resposta.body)).toHaveLength(1);
  });
});

describe('POST /entregas/alocar', () => {
  it('com pedidos pendentes devolve 201 com { viagens, naoAlocados }', async () => {
    pedidos.adicionar(novoPedidoAjudante({ x: 1, y: 0, pesoKg: 3 }));
    pedidos.adicionar(novoPedidoAjudante({ x: 2, y: 0, pesoKg: 3 }));

    const resposta = await request(app).post('/entregas/alocar');

    expect(resposta.status).toBe(201);
    const corpo = comoAlocacao(resposta.body);
    expect(corpo.viagens).toHaveLength(1);
    expect(corpo.naoAlocados).toEqual([]);

    const [viagem] = corpo.viagens;
    expect(typeof viagem?.droneId).toBe('string');
    expect(Array.isArray(viagem?.pedidoIds)).toBe(true);
    expect(Array.isArray(viagem?.paradas)).toBe(true);
    expect(typeof viagem?.distanciaQuadras).toBe('number');
    expect(typeof viagem?.cargaKg).toBe('number');
    expect(typeof viagem?.totalParadas).toBe('number');
    expect(viagem?.totalPedidos).toBe(2);
    expect(viagem?.paradas[0]).toEqual(OPCOES_FROTA.base);
    expect(viagem?.paradas.at(-1)).toEqual(OPCOES_FROTA.base);
  });

  it('sem nenhum pedido pendente devolve 201 com listas vazias (idempotente)', async () => {
    const resposta = await request(app).post('/entregas/alocar');

    expect(resposta.status).toBe(201);
    expect(comoAlocacao(resposta.body)).toEqual({ viagens: [], naoAlocados: [] });
  });

  it('depois de alocar, GET /pedidos?status=alocado reflete a mudança', async () => {
    const pedido = pedidos.adicionar(novoPedidoAjudante({ x: 1, y: 0, pesoKg: 3 }));

    await request(app).post('/entregas/alocar');
    const resposta = await request(app).get('/pedidos').query({ status: 'alocado' });

    expect(comoListaPedidos(resposta.body).map((p) => p.id)).toEqual([pedido.id]);
  });

  it('pedido inviável aparece em naoAlocados e continua pendente', async () => {
    const inviavel = pedidos.adicionar(novoPedidoAjudante({ x: 99, y: 0, pesoKg: 1 }));

    const resposta = await request(app).post('/entregas/alocar');

    expect(resposta.status).toBe(201);
    const corpo = comoAlocacao(resposta.body);
    expect(corpo.naoAlocados).toEqual([
      expect.objectContaining({ pedidoId: inviavel.id, motivo: 'INALCANCAVEL' }),
    ]);

    const pendentes = await request(app).get('/pedidos').query({ status: 'pendente' });
    expect(comoListaPedidos(pendentes.body).map((p) => p.id)).toEqual([inviavel.id]);
  });

  it('frota vazia devolve erro 422 padronizado', async () => {
    const pedidosVazio = criarRepositorioPedidos(criarPersistenciaMemoriaPedidos());
    const frotaVazia = {
      listar: () => [],
      buscarPorId: () => {
        throw new Error('não usado neste teste');
      },
      atualizar: () => {
        throw new Error('não usado neste teste');
      },
    };
    const viagensVazias = criarRepositorioViagens({
      persistencia: criarPersistenciaMemoriaViagens(),
      droneIds: [],
    });
    const simulacaoVazia = criarServicoSimulacao({
      pedidos: pedidosVazio,
      frota: frotaVazia,
      viagens: viagensVazias,
      base: OPCOES_FROTA.base,
      tempos: TEMPOS,
    });
    const appSemFrota = criarApp({
      pedidos: pedidosVazio,
      frota: frotaVazia,
      viagens: viagensVazias,
      simulacao: simulacaoVazia,
    });
    pedidosVazio.adicionar(novoPedidoAjudante({ x: 1, y: 0, pesoKg: 1 }));

    const resposta = await request(appSemFrota).post('/entregas/alocar');

    expect(resposta.status).toBe(422);
    expect(comoErro(resposta.body).erro.codigo).toBe('FROTA_VAZIA');
  });
});

describe('POST /entregas/alocar — integração com a simulação (D13/D33)', () => {
  it('deixa a linha do tempo pronta e o relógio em 0', async () => {
    pedidos.adicionar(novoPedidoAjudante({ x: 1, y: 0, pesoKg: 3 }));

    await request(app).post('/entregas/alocar');

    expect(simulacao.instanteAtual()).toBe(0);
    expect(simulacao.linhaDoTempo().eventos.length).toBeGreaterThan(0);
  });
});

describe('GET /entregas/rota — status e filtro', () => {
  it('expõe o status da viagem e aceita ?status=', async () => {
    pedidos.adicionar(novoPedidoAjudante({ x: 1, y: 0, pesoKg: 3 }));
    await request(app).post('/entregas/alocar');

    const todas = await request(app).get('/entregas/rota');
    expect(comoListaViagens(todas.body)[0]?.status).toBe('planejada');

    const filtradas = await request(app).get('/entregas/rota').query({ status: 'planejada' });
    expect(comoListaViagens(filtradas.body)).toHaveLength(1);

    const concluidas = await request(app).get('/entregas/rota').query({ status: 'concluida' });
    expect(comoListaViagens(concluidas.body)).toHaveLength(0);
  });
});

describe('DELETE /entregas/concluidas', () => {
  it('remove só as viagens concluídas', async () => {
    pedidos.adicionar(novoPedidoAjudante({ x: 1, y: 0, pesoKg: 3 }));
    await request(app).post('/entregas/alocar');
    const makespan = simulacao.linhaDoTempo().metricas.makespanMin;
    simulacao.avancarPara(makespan + 1000);

    const resposta = await request(app).delete('/entregas/concluidas');

    expect(resposta.status).toBe(200);
    const restantes = await request(app).get('/entregas/rota');
    expect(comoListaViagens(restantes.body)).toHaveLength(0);
  });

  it('realocar depois de concluir não reexecuta as viagens já concluídas', async () => {
    pedidos.adicionar(novoPedidoAjudante({ x: 1, y: 0, pesoKg: 3 }));
    await request(app).post('/entregas/alocar');
    const makespan = simulacao.linhaDoTempo().metricas.makespanMin;
    simulacao.avancarPara(makespan + 1000);

    await request(app).delete('/entregas/concluidas');
    pedidos.adicionar(novoPedidoAjudante({ x: 2, y: 0, pesoKg: 3 }));
    await request(app).post('/entregas/alocar');

    const rota = await request(app).get('/entregas/rota');
    expect(comoListaViagens(rota.body)).toHaveLength(1);
    for (const viagem of comoListaViagens(rota.body)) {
      expect(viagem.status).toBe('planejada');
    }
  });
});
