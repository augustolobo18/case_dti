import { describe, it, expect } from 'vitest';
import { ErroDominio } from './erros.js';
import {
  ESTADOS_DRONE,
  carregarDrone,
  criarDrone,
  criarFrota,
  criarGeradorIdSequencial,
  descarregar,
  moverPara,
  recarregar,
  transitar,
  type Drone,
  type EstadoDrone,
  type OpcoesDrone,
} from './drone.js';

const OPCOES: OpcoesDrone = { base: { x: 0, y: 0 }, capacidadeKg: 10, alcanceQuadras: 40 };

describe('criarDrone', () => {
  it('cria um drone idle, na base, sem carga e com bateria cheia (E2-2)', () => {
    const drone = criarDrone({ ...OPCOES, gerarId: () => 'drone-1' });

    expect(drone.estado).toBe('idle');
    expect(drone.posicao).toEqual(OPCOES.base);
    expect(drone.cargaKg).toBe(0);
    expect(drone.capacidadeKg).toBe(OPCOES.capacidadeKg);
    expect(drone.alcanceQuadras).toBe(OPCOES.alcanceQuadras);
    expect(drone.bateriaQuadras).toBe(OPCOES.alcanceQuadras);
    expect(drone.id).toBe('drone-1');
  });

  it('usa crypto.randomUUID como gerador padrão quando nenhum é injetado', () => {
    const drone = criarDrone(OPCOES);
    expect(typeof drone.id).toBe('string');
    expect(drone.id.length).toBeGreaterThan(0);
  });
});

describe('criarFrota', () => {
  it('cria N drones homogêneos com ids distintos', () => {
    let contador = 0;
    const frota = criarFrota(3, { ...OPCOES, gerarId: () => `drone-${++contador}` });

    expect(frota).toHaveLength(3);

    const ids = frota.map((drone) => drone.id);
    expect(new Set(ids).size).toBe(3);

    for (const drone of frota) {
      expect(drone.capacidadeKg).toBe(OPCOES.capacidadeKg);
      expect(drone.alcanceQuadras).toBe(OPCOES.alcanceQuadras);
      expect(drone.estado).toBe('idle');
    }
  });

  it('rejeita quantidade zero com QUANTIDADE_DRONES_INVALIDA', () => {
    expect.assertions(2);
    try {
      criarFrota(0, OPCOES);
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroDominio);
      expect((erro as ErroDominio).codigo).toBe('QUANTIDADE_DRONES_INVALIDA');
    }
  });

  it('rejeita quantidade negativa com QUANTIDADE_DRONES_INVALIDA', () => {
    expect.assertions(2);
    try {
      criarFrota(-1, OPCOES);
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroDominio);
      expect((erro as ErroDominio).codigo).toBe('QUANTIDADE_DRONES_INVALIDA');
    }
  });

  it('rejeita quantidade fracionária com QUANTIDADE_DRONES_INVALIDA', () => {
    expect.assertions(2);
    try {
      criarFrota(1.5, OPCOES);
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroDominio);
      expect((erro as ErroDominio).codigo).toBe('QUANTIDADE_DRONES_INVALIDA');
    }
  });

  it('com um gerador sequencial, produz ids estáveis entre "reinícios" (frotas distintas)', () => {
    const frota1 = criarFrota(3, { ...OPCOES, gerarId: criarGeradorIdSequencial() });
    const frota2 = criarFrota(3, { ...OPCOES, gerarId: criarGeradorIdSequencial() });

    const ids = ['drone-1', 'drone-2', 'drone-3'];
    expect(frota1.map((drone) => drone.id)).toEqual(ids);
    expect(frota2.map((drone) => drone.id)).toEqual(ids);
  });
});

describe('transitar', () => {
  const TRANSICOES_VALIDAS: readonly [EstadoDrone, EstadoDrone][] = [
    ['idle', 'carregando'],
    ['carregando', 'em_voo'],
    ['em_voo', 'entregando'],
    ['entregando', 'em_voo'],
    ['entregando', 'retornando'],
    ['retornando', 'idle'],
  ];

  it.each(TRANSICOES_VALIDAS)('permite a transição de "%s" para "%s"', (de, para) => {
    const drone: Drone = { ...criarDrone({ ...OPCOES, gerarId: () => 'drone-1' }), estado: de };

    const transitado = transitar(drone, para);

    expect(transitado.estado).toBe(para);
    expect(transitado).not.toBe(drone);
    expect(drone.estado).toBe(de);
  });

  it.each(ESTADOS_DRONE)(
    'lança TRANSICAO_INVALIDA ao tentar transitar de "%s" para si mesmo',
    (estado) => {
      expect.assertions(2);
      const drone: Drone = { ...criarDrone({ ...OPCOES, gerarId: () => 'drone-1' }), estado };

      try {
        transitar(drone, estado);
      } catch (erro) {
        expect(erro).toBeInstanceOf(ErroDominio);
        expect((erro as ErroDominio).codigo).toBe('TRANSICAO_INVALIDA');
      }
    },
  );

  it('lança TRANSICAO_INVALIDA para um salto fora da tabela (idle -> em_voo)', () => {
    expect.assertions(2);
    const drone = criarDrone({ ...OPCOES, gerarId: () => 'drone-1' });

    try {
      transitar(drone, 'em_voo');
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroDominio);
      expect((erro as ErroDominio).codigo).toBe('TRANSICAO_INVALIDA');
    }
  });
});

describe('carregarDrone', () => {
  it('transita idle -> carregando e define a carga', () => {
    const drone = criarDrone({ ...OPCOES, gerarId: () => 'drone-1' });

    const carregado = carregarDrone(drone, 7);

    expect(carregado.estado).toBe('carregando');
    expect(carregado.cargaKg).toBe(7);
    expect(drone.cargaKg).toBe(0);
    expect(carregado).not.toBe(drone);
  });

  it('lança PESO_ACIMA_CAPACIDADE quando a carga excede a capacidade do drone', () => {
    expect.assertions(2);
    const drone = criarDrone({ ...OPCOES, gerarId: () => 'drone-1' });

    try {
      carregarDrone(drone, OPCOES.capacidadeKg + 1);
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroDominio);
      expect((erro as ErroDominio).codigo).toBe('PESO_ACIMA_CAPACIDADE');
    }
  });

  it('lança TRANSICAO_INVALIDA se o drone não estiver idle', () => {
    expect.assertions(2);
    const drone: Drone = {
      ...criarDrone({ ...OPCOES, gerarId: () => 'drone-1' }),
      estado: 'em_voo',
    };

    try {
      carregarDrone(drone, 1);
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroDominio);
      expect((erro as ErroDominio).codigo).toBe('TRANSICAO_INVALIDA');
    }
  });
});

describe('moverPara', () => {
  it('desconta a bateria e atualiza a posição, sem mutar a entrada', () => {
    const drone = criarDrone({ ...OPCOES, gerarId: () => 'drone-1' });

    const movido = moverPara(drone, { x: 3, y: 4 }, 7);

    expect(movido.posicao).toEqual({ x: 3, y: 4 });
    expect(movido.bateriaQuadras).toBe(OPCOES.alcanceQuadras - 7);
    expect(drone.posicao).toEqual(OPCOES.base);
    expect(drone.bateriaQuadras).toBe(OPCOES.alcanceQuadras);
  });

  it('aceita um trecho exatamente igual à bateria restante (borda inclusiva)', () => {
    const drone = criarDrone({ ...OPCOES, gerarId: () => 'drone-1' });

    const movido = moverPara(drone, { x: 40, y: 0 }, OPCOES.alcanceQuadras);

    expect(movido.bateriaQuadras).toBe(0);
  });

  it('lança BATERIA_INSUFICIENTE quando o trecho excede a bateria restante', () => {
    expect.assertions(2);
    const drone = criarDrone({ ...OPCOES, gerarId: () => 'drone-1' });

    try {
      moverPara(drone, { x: 41, y: 0 }, OPCOES.alcanceQuadras + 1);
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroDominio);
      expect((erro as ErroDominio).codigo).toBe('BATERIA_INSUFICIENTE');
    }
  });
});

describe('descarregar', () => {
  it('reduz a carga do drone, sem mutar a entrada', () => {
    const drone = { ...criarDrone({ ...OPCOES, gerarId: () => 'drone-1' }), cargaKg: 5 };

    const descarregado = descarregar(drone, 2);

    expect(descarregado.cargaKg).toBe(3);
    expect(drone.cargaKg).toBe(5);
  });
});

describe('recarregar', () => {
  it('devolve a bateria a alcanceQuadras, sem mutar a entrada', () => {
    const drone = { ...criarDrone({ ...OPCOES, gerarId: () => 'drone-1' }), bateriaQuadras: 3 };

    const recarregado = recarregar(drone);

    expect(recarregado.bateriaQuadras).toBe(OPCOES.alcanceQuadras);
    expect(drone.bateriaQuadras).toBe(3);
  });
});

describe('criarGeradorIdSequencial', () => {
  it('gera ids sequenciais com o prefixo padrão "drone"', () => {
    const gerarId = criarGeradorIdSequencial();

    expect(gerarId()).toBe('drone-1');
    expect(gerarId()).toBe('drone-2');
    expect(gerarId()).toBe('drone-3');
  });

  it('aceita um prefixo customizado', () => {
    const gerarId = criarGeradorIdSequencial('d');

    expect(gerarId()).toBe('d-1');
    expect(gerarId()).toBe('d-2');
  });

  it('dois geradores independentes têm contadores próprios', () => {
    const gerarId1 = criarGeradorIdSequencial();
    const gerarId2 = criarGeradorIdSequencial();

    expect(gerarId1()).toBe('drone-1');
    expect(gerarId1()).toBe('drone-2');
    expect(gerarId2()).toBe('drone-1');
  });
});
