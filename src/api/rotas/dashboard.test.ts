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

let app: Express;

beforeEach(() => {
  const pedidos = criarRepositorioPedidos(criarPersistenciaMemoria());
  const frota = criarRepositorioFrota(OPCOES_FROTA);
  const viagens = criarRepositorioViagens({
    persistencia: criarPersistenciaMemoriaViagens(),
    droneIds: frota.listar().map((d) => d.id),
  });
  const mapa = criarMapaCidade({ cidadeTamanho: 10, zonas: [] });
  const simulacao = criarServicoSimulacao({
    pedidos,
    frota,
    viagens,
    base: OPCOES_FROTA.base,
    tempos: TEMPOS,
    mapa,
  });
  app = criarApp({ pedidos, frota, viagens, simulacao, mapa });
});

describe('GET /dashboard', () => {
  it('devolve 200 com content-type text/html e o título esperado', async () => {
    const resposta = await request(app).get('/dashboard');

    expect(resposta.status).toBe(200);
    expect(resposta.headers['content-type']).toContain('text/html');
    expect(resposta.text).toContain('<title>DroneDelivery — Dashboard</title>');
  });
});
