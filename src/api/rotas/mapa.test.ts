import type { Express } from 'express';
import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import { criarApp } from '../server.js';
import { criarMapaCidade } from '../../domain/mapa.js';
import { criarPersistenciaMemoria } from '../../infra/persistencia-pedidos.js';
import { criarPersistenciaMemoria as criarPersistenciaMemoriaViagens } from '../../infra/persistencia-viagens.js';
import { criarRepositorioPedidos } from '../../repositorio/pedidos.js';
import { criarRepositorioFrota, type OpcoesFrota } from '../../repositorio/frota.js';
import { criarRepositorioViagens } from '../../repositorio/viagens.js';
import { criarServicoSimulacao } from '../../servicos/simulacao.js';
import type { TemposSimulacao } from '../../domain/simulacao.js';
import type { RespostaMapa } from '../apresentadores/mapa.js';

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

function comoRespostaMapa(corpo: unknown): RespostaMapa {
  return corpo as RespostaMapa;
}

function montarApp(
  cidadeTamanho: number,
  zonas: { de: { x: number; y: number }; ate: { x: number; y: number } }[],
) {
  const pedidos = criarRepositorioPedidos(criarPersistenciaMemoria());
  const frota = criarRepositorioFrota(OPCOES_FROTA);
  const viagens = criarRepositorioViagens({
    persistencia: criarPersistenciaMemoriaViagens(),
    droneIds: frota.listar().map((d) => d.id),
  });
  const mapa = criarMapaCidade({ cidadeTamanho, zonas });
  const simulacao = criarServicoSimulacao({
    pedidos,
    frota,
    viagens,
    base: OPCOES_FROTA.base,
    tempos: TEMPOS,
    mapa,
  });
  return criarApp({ pedidos, frota, viagens, simulacao, mapa });
}

let app: Express;

beforeEach(() => {
  app = montarApp(10, []);
});

describe('GET /mapa', () => {
  it('devolve 200 com cidadeTamanho, base e zonas vazias', async () => {
    const resposta = await request(app).get('/mapa');

    expect(resposta.status).toBe(200);
    expect(comoRespostaMapa(resposta.body)).toEqual({
      cidadeTamanho: 10,
      base: OPCOES_FROTA.base,
      zonas: [],
    });
  });

  it('com zonas configuradas, elas aparecem na resposta', async () => {
    const zonas = [{ de: { x: 2, y: 2 }, ate: { x: 4, y: 4 } }];
    const appComZonas = montarApp(10, zonas);

    const resposta = await request(appComZonas).get('/mapa');

    expect(resposta.status).toBe(200);
    expect(comoRespostaMapa(resposta.body).zonas).toEqual(zonas);
  });
});
