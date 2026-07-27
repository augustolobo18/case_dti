import type { Express } from 'express';
import request from 'supertest';
import { describe, it, expect, beforeEach } from 'vitest';
import { criarApp } from '../server.js';
import type { CorpoErro } from '../erros.js';
import { criarPedido, type Pedido, type LimitesPedido } from '../../domain/pedido.js';
import { criarPersistenciaMemoria } from '../../infra/persistencia-pedidos.js';
import { criarPersistenciaMemoria as criarPersistenciaMemoriaViagens } from '../../infra/persistencia-viagens.js';
import { criarRepositorioPedidos, type RepositorioPedidos } from '../../repositorio/pedidos.js';
import { criarRepositorioFrota, type OpcoesFrota } from '../../repositorio/frota.js';
import { criarRepositorioViagens } from '../../repositorio/viagens.js';
import { criarServicoSimulacao } from '../../servicos/simulacao.js';
import type { TemposSimulacao } from '../../domain/simulacao.js';

const LIMITES: LimitesPedido = { capacidadeKg: 10, cidadeTamanho: 10 };
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

/** Tipa o corpo da resposta como envelope de erro (D20), evitando acesso `any`. */
function comoErro(corpo: unknown): CorpoErro {
  return corpo as CorpoErro;
}

/** Tipa o corpo da resposta como `Pedido`, evitando acesso `any`. */
function comoPedido(corpo: unknown): Pedido {
  return corpo as Pedido;
}

/** Tipa o corpo da resposta como lista de `Pedido`, evitando acesso `any`. */
function comoListaPedidos(corpo: unknown): Pedido[] {
  return corpo as Pedido[];
}

let repositorio: RepositorioPedidos;
let app: Express;
let contador = 0;

beforeEach(() => {
  repositorio = criarRepositorioPedidos(criarPersistenciaMemoria());
  const frota = criarRepositorioFrota(OPCOES_FROTA);
  const viagens = criarRepositorioViagens({
    persistencia: criarPersistenciaMemoriaViagens(),
    droneIds: frota.listar().map((d) => d.id),
  });
  const simulacao = criarServicoSimulacao({
    pedidos: repositorio,
    frota,
    viagens,
    base: OPCOES_FROTA.base,
    tempos: TEMPOS,
  });
  app = criarApp({ pedidos: repositorio, frota, viagens, simulacao });
  contador = 0;
});

const PEDIDO_VALIDO = { x: 3, y: 4, pesoKg: 5, prioridade: 'alta' };

describe('POST /pedidos', () => {
  it('cadastra um pedido válido e devolve 201 com id e status pendente', async () => {
    const resposta = await request(app).post('/pedidos').send(PEDIDO_VALIDO);

    expect(resposta.status).toBe(201);
    expect(resposta.body).toMatchObject({ status: 'pendente' });
    expect(typeof comoPedido(resposta.body).id).toBe('string');
  });

  it('rejeita peso acima da capacidade com 422', async () => {
    const resposta = await request(app)
      .post('/pedidos')
      .send({ ...PEDIDO_VALIDO, pesoKg: 999 });

    expect(resposta.status).toBe(422);
    expect(comoErro(resposta.body).erro.codigo).toBe('PESO_ACIMA_CAPACIDADE');
  });

  it('rejeita peso zero/negativo com 400', async () => {
    const resposta = await request(app)
      .post('/pedidos')
      .send({ ...PEDIDO_VALIDO, pesoKg: 0 });

    expect(resposta.status).toBe(400);
    expect(comoErro(resposta.body).erro.codigo).toBe('PESO_INVALIDO');
  });

  it('rejeita prioridade desconhecida com 400', async () => {
    const resposta = await request(app)
      .post('/pedidos')
      .send({ ...PEDIDO_VALIDO, prioridade: 'urgente' });

    expect(resposta.status).toBe(400);
    expect(comoErro(resposta.body).erro.codigo).toBe('PRIORIDADE_INVALIDA');
  });

  it('rejeita coordenada fora da malha com 422', async () => {
    const resposta = await request(app)
      .post('/pedidos')
      .send({ ...PEDIDO_VALIDO, x: 9999 });

    expect(resposta.status).toBe(422);
    expect(comoErro(resposta.body).erro.codigo).toBe('COORDENADA_FORA_DA_MALHA');
  });

  it('rejeita corpo sem campo obrigatório com 400 e detalhes', async () => {
    const resposta = await request(app).post('/pedidos').send({ x: 1, y: 1, pesoKg: 1 });

    expect(resposta.status).toBe(400);
    expect(comoErro(resposta.body).erro.codigo).toBeDefined();
    expect(comoErro(resposta.body).erro.detalhes).toBeDefined();
  });
});

describe('GET /pedidos', () => {
  it('devolve lista vazia e 200 quando não há pedidos', async () => {
    const resposta = await request(app).get('/pedidos');

    expect(resposta.status).toBe(200);
    expect(resposta.body).toEqual([]);
  });

  it('filtra por status e por prioridade, isolados e combinados', async () => {
    const alta = repositorio.adicionar(
      criarPedidoAjudante({ x: 1, y: 1, pesoKg: 1, prioridade: 'alta' }),
    );
    const baixa = repositorio.adicionar(
      criarPedidoAjudante({ x: 1, y: 1, pesoKg: 1, prioridade: 'baixa' }),
    );
    repositorio.cancelar(baixa.id);

    const porStatus = await request(app).get('/pedidos').query({ status: 'pendente' });
    expect(porStatus.body).toHaveLength(1);
    expect(comoListaPedidos(porStatus.body)[0]?.id).toBe(alta.id);

    const porPrioridade = await request(app).get('/pedidos').query({ prioridade: 'alta' });
    expect(porPrioridade.body).toHaveLength(1);

    const combinado = await request(app)
      .get('/pedidos')
      .query({ status: 'pendente', prioridade: 'alta' });
    expect(combinado.body).toHaveLength(1);
  });

  it('rejeita filtro inválido com 400', async () => {
    const resposta = await request(app).get('/pedidos').query({ status: 'xpto' });

    expect(resposta.status).toBe(400);
  });
});

describe('GET /pedidos/:id', () => {
  it('devolve 200 para pedido existente', async () => {
    const pedido = repositorio.adicionar(criarPedidoAjudante(PEDIDO_VALIDO));

    const resposta = await request(app).get(`/pedidos/${pedido.id}`);

    expect(resposta.status).toBe(200);
    expect(comoPedido(resposta.body).id).toBe(pedido.id);
  });

  it('devolve 404 para id inexistente', async () => {
    const resposta = await request(app).get('/pedidos/id-inexistente');

    expect(resposta.status).toBe(404);
    expect(comoErro(resposta.body).erro.codigo).toBe('PEDIDO_NAO_ENCONTRADO');
  });
});

describe('POST /pedidos/:id/cancelar', () => {
  it('cancela pedido pendente e devolve 200 com status cancelado', async () => {
    const pedido = repositorio.adicionar(criarPedidoAjudante(PEDIDO_VALIDO));

    const resposta = await request(app).post(`/pedidos/${pedido.id}/cancelar`);

    expect(resposta.status).toBe(200);
    expect(comoPedido(resposta.body).status).toBe('cancelado');
  });

  it('rejeita cancelar um pedido já cancelado com 422', async () => {
    const pedido = repositorio.adicionar(criarPedidoAjudante(PEDIDO_VALIDO));
    repositorio.cancelar(pedido.id);

    const resposta = await request(app).post(`/pedidos/${pedido.id}/cancelar`);

    expect(resposta.status).toBe(422);
    expect(comoErro(resposta.body).erro.codigo).toBe('CANCELAMENTO_NAO_PERMITIDO');
  });

  it('devolve 404 ao cancelar id inexistente', async () => {
    const resposta = await request(app).post('/pedidos/id-inexistente/cancelar');

    expect(resposta.status).toBe(404);
  });

  it('pedido cancelado some de ?status=pendente', async () => {
    const pedido = repositorio.adicionar(criarPedidoAjudante(PEDIDO_VALIDO));
    await request(app).post(`/pedidos/${pedido.id}/cancelar`);

    const resposta = await request(app).get('/pedidos').query({ status: 'pendente' });

    expect(resposta.body).toEqual([]);
  });
});

describe('rota inexistente', () => {
  it('devolve 404 no envelope padronizado', async () => {
    const resposta = await request(app).get('/rota-que-nao-existe');

    expect(resposta.status).toBe(404);
    expect(comoErro(resposta.body).erro.codigo).toBe('ROTA_NAO_ENCONTRADA');
  });
});

/** Monta um pedido válido diretamente pelo domínio, com id determinístico, para popular o repositório nos testes de leitura. */
function criarPedidoAjudante(dados: { x: number; y: number; pesoKg: number; prioridade: string }) {
  contador += 1;
  const idFixo = `id-teste-${contador}`;
  return criarPedido(dados, { limites: LIMITES, gerarId: () => idFixo });
}
