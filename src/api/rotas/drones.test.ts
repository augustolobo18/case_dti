import type { Express } from 'express';
import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import { criarApp } from '../server.js';
import type { CorpoErro } from '../erros.js';
import { criarPersistenciaMemoria } from '../../infra/persistencia-pedidos.js';
import { criarPersistenciaMemoria as criarPersistenciaMemoriaViagens } from '../../infra/persistencia-viagens.js';
import { criarRepositorioPedidos } from '../../repositorio/pedidos.js';
import { criarRepositorioFrota, type OpcoesFrota } from '../../repositorio/frota.js';
import { criarRepositorioViagens } from '../../repositorio/viagens.js';
import type { RespostaDrone } from '../apresentadores/drone.js';

const OPCOES_FROTA: OpcoesFrota = {
  base: { x: 0, y: 0 },
  capacidadeKg: 10,
  alcanceQuadras: 40,
  quantidade: 3,
};

/** Tipa o corpo da resposta como envelope de erro (D20), evitando acesso `any`. */
function comoErro(corpo: unknown): CorpoErro {
  return corpo as CorpoErro;
}

/** Tipa o corpo da resposta como `RespostaDrone`, evitando acesso `any`. */
function comoDrone(corpo: unknown): RespostaDrone {
  return corpo as RespostaDrone;
}

/** Tipa o corpo da resposta como lista de `RespostaDrone`, evitando acesso `any`. */
function comoListaDrones(corpo: unknown): RespostaDrone[] {
  return corpo as RespostaDrone[];
}

let app: Express;

beforeEach(() => {
  const pedidos = criarRepositorioPedidos(criarPersistenciaMemoria());
  const frota = criarRepositorioFrota(OPCOES_FROTA);
  const viagens = criarRepositorioViagens({
    persistencia: criarPersistenciaMemoriaViagens(),
    droneIds: frota.listar().map((d) => d.id),
  });
  app = criarApp({ pedidos, frota, viagens });
});

describe('GET /drones', () => {
  it('devolve 200 com um item por drone da frota', async () => {
    const resposta = await request(app).get('/drones');

    expect(resposta.status).toBe(200);
    expect(comoListaDrones(resposta.body)).toHaveLength(OPCOES_FROTA.quantidade);
  });

  it('cada drone recém-criado aparece idle, na base, sem carga e com bateria cheia', async () => {
    const resposta = await request(app).get('/drones');
    const [drone] = comoListaDrones(resposta.body);

    expect(drone).toMatchObject({
      estado: 'idle',
      posicao: OPCOES_FROTA.base,
      cargaKg: 0,
      capacidadeKg: OPCOES_FROTA.capacidadeKg,
      alcanceQuadras: OPCOES_FROTA.alcanceQuadras,
      bateriaQuadras: OPCOES_FROTA.alcanceQuadras,
      bateriaPercentual: 100,
    });
    expect(typeof drone?.id).toBe('string');
  });
});

describe('GET /drones/:id', () => {
  it('devolve 200 com o drone existente', async () => {
    const resposta = await request(app).get('/drones/drone-1');

    expect(resposta.status).toBe(200);
    expect(comoDrone(resposta.body).id).toBe('drone-1');
  });

  it('devolve 404 com envelope padronizado para id inexistente', async () => {
    const resposta = await request(app).get('/drones/inexistente');

    expect(resposta.status).toBe(404);
    expect(comoErro(resposta.body).erro.codigo).toBe('DRONE_NAO_ENCONTRADO');
  });
});
