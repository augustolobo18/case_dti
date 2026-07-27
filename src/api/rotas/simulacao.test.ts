import type { Express } from 'express';
import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import { criarApp } from '../server.js';
import type { CorpoErro } from '../erros.js';
import { criarPedido, type LimitesPedido } from '../../domain/pedido.js';
import type { TemposSimulacao } from '../../domain/simulacao.js';
import { criarMapaCidade } from '../../domain/mapa.js';
import { criarPersistenciaMemoria as criarPersistenciaMemoriaPedidos } from '../../infra/persistencia-pedidos.js';
import { criarPersistenciaMemoria as criarPersistenciaMemoriaViagens } from '../../infra/persistencia-viagens.js';
import { criarRepositorioPedidos, type RepositorioPedidos } from '../../repositorio/pedidos.js';
import {
  criarRepositorioFrota,
  type OpcoesFrota,
  type RepositorioFrota,
} from '../../repositorio/frota.js';
import { criarRepositorioViagens, type RepositorioViagens } from '../../repositorio/viagens.js';
import { criarServicoSimulacao, type ServicoSimulacao } from '../../servicos/simulacao.js';

const LIMITES: LimitesPedido = { capacidadeKg: 10, cidadeTamanho: 1000 };
const OPCOES_FROTA: OpcoesFrota = {
  base: { x: 0, y: 0 },
  capacidadeKg: 10,
  alcanceQuadras: 40,
  quantidade: 1,
};
const TEMPOS: TemposSimulacao = {
  velocidadeQuadrasMin: 1,
  carregamentoMin: 5,
  entregaMin: 2,
  recargaMinPorQuadra: 0.5,
};

function comoErro(corpo: unknown): CorpoErro {
  return corpo as CorpoErro;
}

type CorpoSimulacao = { instanteAtual: number; metricas: { totalEntregas: number } };
type CorpoAvanco = { instanteAtual: number; eventosAplicados: unknown[] };

function comoSimulacao(corpo: unknown): CorpoSimulacao {
  return corpo as CorpoSimulacao;
}

function comoAvanco(corpo: unknown): CorpoAvanco {
  return corpo as CorpoAvanco;
}

function comoListaDrones(corpo: unknown): { estado: string }[] {
  return corpo as { estado: string }[];
}

function comoListaPedidos(corpo: unknown): { status: string }[] {
  return corpo as { status: string }[];
}

function comoListaEventos(corpo: unknown): { instanteMin: number }[] {
  return corpo as { instanteMin: number }[];
}

let pedidos: RepositorioPedidos;
let frota: RepositorioFrota;
let viagens: RepositorioViagens;
let simulacao: ServicoSimulacao;
let app: Express;
let contador = 0;

function novoPedidoAjudante(x: number, y: number, pesoKg = 1) {
  contador += 1;
  const idFixo = `pedido-sim-${contador}`;
  return criarPedido(
    { x, y, pesoKg, prioridade: 'baixa' },
    { limites: LIMITES, gerarId: () => idFixo },
  );
}

beforeEach(() => {
  contador = 0;
  pedidos = criarRepositorioPedidos(criarPersistenciaMemoriaPedidos());
  frota = criarRepositorioFrota(OPCOES_FROTA);
  viagens = criarRepositorioViagens({
    persistencia: criarPersistenciaMemoriaViagens(),
    droneIds: frota.listar().map((d) => d.id),
  });
  const mapa = criarMapaCidade({ cidadeTamanho: LIMITES.cidadeTamanho, zonas: [] });
  simulacao = criarServicoSimulacao({
    pedidos,
    frota,
    viagens,
    base: OPCOES_FROTA.base,
    tempos: TEMPOS,
    mapa,
  });
  app = criarApp({ pedidos, frota, viagens, simulacao, mapa });
});

describe('GET /simulacao', () => {
  it('sem alocação devolve 200 com instanteAtual 0 e métricas zeradas', async () => {
    const resposta = await request(app).get('/simulacao');

    expect(resposta.status).toBe(200);
    expect(comoSimulacao(resposta.body)).toEqual({
      instanteAtual: 0,
      metricas: {
        totalEntregas: 0,
        makespanMin: 0,
        tempoMedioEntregaMin: 0,
        tempoPorPedido: [],
        porDrone: [],
      },
    });
  });
});

describe('POST /simulacao/avancar', () => {
  async function alocarUmPedido() {
    pedidos.adicionar(novoPedidoAjudante(3, 4, 5));
    await request(app).post('/entregas/alocar');
  }

  it('com ateInstante válido devolve 200 e muda GET /drones e GET /pedidos', async () => {
    await alocarUmPedido();

    const resposta = await request(app).post('/simulacao/avancar').send({ ateInstante: 5 });

    expect(resposta.status).toBe(200);
    expect(comoAvanco(resposta.body).instanteAtual).toBe(5);
    expect(comoAvanco(resposta.body).eventosAplicados.length).toBeGreaterThan(0);

    const drones = await request(app).get('/drones');
    expect(comoListaDrones(drones.body)[0]).toMatchObject({ estado: 'em_voo' });

    const pedidosResposta = await request(app).get('/pedidos');
    expect(comoListaPedidos(pedidosResposta.body)[0]).toMatchObject({ status: 'em_voo' });
  });

  it('aceita "minutos" como avanço relativo ao instante corrente', async () => {
    await alocarUmPedido();

    const resposta = await request(app).post('/simulacao/avancar').send({ minutos: 5 });

    expect(resposta.status).toBe(200);
    expect(comoAvanco(resposta.body).instanteAtual).toBe(5);
  });

  it('instante retroativo devolve 422 AVANCO_INVALIDO', async () => {
    await alocarUmPedido();
    await request(app).post('/simulacao/avancar').send({ ateInstante: 10 });

    const resposta = await request(app).post('/simulacao/avancar').send({ ateInstante: 5 });

    expect(resposta.status).toBe(422);
    expect(comoErro(resposta.body).erro.codigo).toBe('AVANCO_INVALIDO');
  });

  it('corpo com ambos os campos devolve 400', async () => {
    const resposta = await request(app)
      .post('/simulacao/avancar')
      .send({ ateInstante: 5, minutos: 5 });

    expect(resposta.status).toBe(400);
  });

  it('corpo sem nenhum campo devolve 400', async () => {
    const resposta = await request(app).post('/simulacao/avancar').send({});

    expect(resposta.status).toBe(400);
  });

  it('corpo com número negativo devolve 400', async () => {
    const resposta = await request(app).post('/simulacao/avancar').send({ ateInstante: -1 });

    expect(resposta.status).toBe(400);
  });
});

describe('GET /simulacao/eventos', () => {
  it('lista os eventos da linha do tempo', async () => {
    pedidos.adicionar(novoPedidoAjudante(3, 4, 5));
    await request(app).post('/entregas/alocar');

    const resposta = await request(app).get('/simulacao/eventos');

    expect(resposta.status).toBe(200);
    expect(Array.isArray(resposta.body)).toBe(true);
    expect(comoListaEventos(resposta.body).length).toBeGreaterThan(0);
  });

  it('aceita recorte por "desde" e "ate"', async () => {
    pedidos.adicionar(novoPedidoAjudante(3, 4, 5));
    await request(app).post('/entregas/alocar');

    const completo = await request(app).get('/simulacao/eventos');
    const recorte = await request(app).get('/simulacao/eventos').query({ desde: 0, ate: 5 });

    expect(comoListaEventos(recorte.body).length).toBeLessThanOrEqual(
      comoListaEventos(completo.body).length,
    );
    for (const evento of comoListaEventos(recorte.body)) {
      expect(evento.instanteMin).toBeGreaterThanOrEqual(0);
      expect(evento.instanteMin).toBeLessThanOrEqual(5);
    }
  });

  it('sem alocação devolve lista vazia', async () => {
    const resposta = await request(app).get('/simulacao/eventos');

    expect(resposta.status).toBe(200);
    expect(resposta.body).toEqual([]);
  });
});
