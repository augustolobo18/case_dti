import { describe, it, expect } from 'vitest';
import { criarMapaCidade, type ZonaExclusao } from './mapa.js';
import { criarPedido, comStatus, type LimitesPedido, type Pedido } from './pedido.js';
import { criarDrone, type Drone } from './drone.js';
import { montarRastreio } from './rastreio.js';

const LIMITES: LimitesPedido = { capacidadeKg: 10, cidadeTamanho: 20 };
const MAPA_SEM_ZONAS = criarMapaCidade({ cidadeTamanho: 20, zonas: [] });

function novoPedido(status: Pedido['status'] = 'pendente'): Pedido {
  const pedido = criarPedido(
    { x: 5, y: 5, pesoKg: 1, prioridade: 'baixa' },
    { limites: LIMITES, gerarId: () => 'pedido-rastreio' },
  );
  return comStatus(pedido, status);
}

function novoDrone(posicao: { x: number; y: number }): Drone {
  return criarDrone({
    base: posicao,
    capacidadeKg: 10,
    alcanceQuadras: 40,
    gerarId: () => 'drone-rastreio',
  });
}

describe('montarRastreio — uma mensagem própria por status', () => {
  it('pendente tem mensagem própria, sem distância nem drone', () => {
    const rastreio = montarRastreio({ pedido: novoPedido('pendente'), mapa: MAPA_SEM_ZONAS });

    expect(rastreio.status).toBe('pendente');
    expect(rastreio.mensagem.length).toBeGreaterThan(0);
    expect(rastreio.distanciaQuadras).toBeUndefined();
    expect(rastreio.droneId).toBeUndefined();
  });

  it('alocado tem mensagem própria', () => {
    const rastreio = montarRastreio({ pedido: novoPedido('alocado'), mapa: MAPA_SEM_ZONAS });

    expect(rastreio.status).toBe('alocado');
    expect(rastreio.mensagem.length).toBeGreaterThan(0);
  });

  it('entregue tem mensagem própria', () => {
    const rastreio = montarRastreio({ pedido: novoPedido('entregue'), mapa: MAPA_SEM_ZONAS });

    expect(rastreio.status).toBe('entregue');
    expect(rastreio.mensagem.length).toBeGreaterThan(0);
  });

  it('cancelado tem mensagem própria', () => {
    const rastreio = montarRastreio({ pedido: novoPedido('cancelado'), mapa: MAPA_SEM_ZONAS });

    expect(rastreio.status).toBe('cancelado');
    expect(rastreio.mensagem.length).toBeGreaterThan(0);
  });

  it('em_voo com drone localizável traz droneId e distanciaQuadras em quadras', () => {
    const pedido = novoPedido('em_voo');
    const drone = novoDrone({ x: 0, y: 0 });

    const rastreio = montarRastreio({ pedido, drone, mapa: MAPA_SEM_ZONAS });

    expect(rastreio.status).toBe('em_voo');
    expect(rastreio.droneId).toBe(drone.id);
    expect(rastreio.distanciaQuadras).toBe(10); // Manhattan (0,0)->(5,5)
  });

  it('em_voo com zona entre drone e cliente usa a distância desviada, não a Manhattan reta (D42)', () => {
    const zonas: ZonaExclusao[] = [{ de: { x: 3, y: 0 }, ate: { x: 3, y: 6 } }];
    const cidadeTamanho = 8;
    const mapa = criarMapaCidade({ cidadeTamanho, zonas });
    const pedido = criarPedido(
      { x: 6, y: 4, pesoKg: 1, prioridade: 'baixa' },
      { limites: { capacidadeKg: 10, cidadeTamanho }, gerarId: () => 'pedido-zona' },
    );
    const emVoo = comStatus(pedido, 'em_voo');
    const drone = criarDrone({
      base: { x: 0, y: 4 },
      capacidadeKg: 10,
      alcanceQuadras: 100,
      gerarId: () => 'drone-zona',
    });

    const rastreio = montarRastreio({ pedido: emVoo, drone, mapa });

    expect(rastreio.distanciaQuadras).toBeGreaterThan(6); // Manhattan direto seria 6
  });

  it('em_voo com drone na coordenada do cliente entra na faixa "chegando" (0 quadras)', () => {
    const pedido = novoPedido('em_voo');
    const drone = novoDrone({ x: 5, y: 5 });

    const rastreio = montarRastreio({ pedido, drone, mapa: MAPA_SEM_ZONAS });

    expect(rastreio.distanciaQuadras).toBe(0);
    expect(rastreio.mensagem.toLowerCase()).toContain('chegando');
  });

  it('em_voo sem drone localizável degrada para mensagem sem distância, não lança', () => {
    const pedido = novoPedido('em_voo');

    expect(() => montarRastreio({ pedido, mapa: MAPA_SEM_ZONAS })).not.toThrow();

    const rastreio = montarRastreio({ pedido, mapa: MAPA_SEM_ZONAS });
    expect(rastreio.distanciaQuadras).toBeUndefined();
    expect(rastreio.mensagem.length).toBeGreaterThan(0);
  });

  it('em_voo a 2 quadras do cliente usa plural na mensagem', () => {
    const pedido = novoPedido('em_voo');
    // (5,5) -> destino (5,5) do pedido de teste é fixo em x:5,y:5; drone a 2 quadras de distância.
    const drone = novoDrone({ x: 3, y: 5 });

    const rastreio = montarRastreio({ pedido, drone, mapa: MAPA_SEM_ZONAS });

    expect(rastreio.distanciaQuadras).toBe(2);
    expect(rastreio.mensagem).toContain('a 2 quadras de você');
  });

  it('em_voo a 5 quadras do cliente usa plural na mensagem', () => {
    const pedido = novoPedido('em_voo');
    const drone = novoDrone({ x: 0, y: 5 });

    const rastreio = montarRastreio({ pedido, drone, mapa: MAPA_SEM_ZONAS });

    expect(rastreio.distanciaQuadras).toBe(5);
    expect(rastreio.mensagem).toContain('a 5 quadras');
  });

  it('em_voo a 1 quadra ou menos continua caindo na faixa "chegando" (regressão)', () => {
    const pedido = novoPedido('em_voo');
    const drone = novoDrone({ x: 4, y: 5 }); // 1 quadra de distância

    const rastreio = montarRastreio({ pedido, drone, mapa: MAPA_SEM_ZONAS });

    expect(rastreio.distanciaQuadras).toBe(1);
    expect(rastreio.mensagem.toLowerCase()).toContain('chegando');
  });

  it('em_voo sem rota até o cliente degrada para mensagem sem distância, não lança', () => {
    const zonas: ZonaExclusao[] = [{ de: { x: 5, y: 5 }, ate: { x: 5, y: 5 } }];
    const mapa = criarMapaCidade({ cidadeTamanho: 20, zonas });
    const pedido = novoPedido('em_voo');
    const drone = novoDrone({ x: 0, y: 0 });

    expect(() => montarRastreio({ pedido, drone, mapa })).not.toThrow();
    const rastreio = montarRastreio({ pedido, drone, mapa });
    expect(rastreio.distanciaQuadras).toBeUndefined();
  });
});

describe('montarRastreio — função pura', () => {
  it('duas chamadas com a mesma entrada produzem o mesmo resultado', () => {
    const pedido = novoPedido('em_voo');
    const drone = novoDrone({ x: 0, y: 0 });

    const r1 = montarRastreio({ pedido, drone, mapa: MAPA_SEM_ZONAS });
    const r2 = montarRastreio({ pedido, drone, mapa: MAPA_SEM_ZONAS });

    expect(r1).toEqual(r2);
  });
});
