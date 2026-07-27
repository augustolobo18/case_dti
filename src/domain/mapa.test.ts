import { describe, it, expect } from 'vitest';
import { ErroDominio } from './erros.js';
import { distanciaManhattan, type Coordenada } from './coordenada.js';
import { criarMapaCidade, parsearZonasExclusao, type ZonaExclusao } from './mapa.js';

describe('parsearZonasExclusao', () => {
  it('string vazia devolve lista vazia', () => {
    expect(parsearZonasExclusao('')).toEqual([]);
  });

  it('string só com espaços devolve lista vazia', () => {
    expect(parsearZonasExclusao('   ')).toEqual([]);
  });

  it('parseia um único retângulo', () => {
    expect(parsearZonasExclusao('2,2:4,5')).toEqual([{ de: { x: 2, y: 2 }, ate: { x: 4, y: 5 } }]);
  });

  it('parseia vários retângulos separados por ;', () => {
    expect(parsearZonasExclusao('2,2:4,5;7,0:8,3')).toEqual([
      { de: { x: 2, y: 2 }, ate: { x: 4, y: 5 } },
      { de: { x: 7, y: 0 }, ate: { x: 8, y: 3 } },
    ]);
  });

  it('tolera espaços ao redor de números e separadores', () => {
    expect(parsearZonasExclusao(' 2, 2 : 4,5 ; 7,0:8,3 ')).toEqual([
      { de: { x: 2, y: 2 }, ate: { x: 4, y: 5 } },
      { de: { x: 7, y: 0 }, ate: { x: 8, y: 3 } },
    ]);
  });

  it('formato inválido (sem ":") lança ErroDominio', () => {
    expect.assertions(2);
    try {
      parsearZonasExclusao('2,2-4,5');
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroDominio);
      expect((erro as ErroDominio).codigo).toBe('COORDENADA_INVALIDA');
    }
  });

  it('coordenada não-inteira lança ErroDominio', () => {
    expect.assertions(2);
    try {
      parsearZonasExclusao('2.5,2:4,5');
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroDominio);
      expect((erro as ErroDominio).codigo).toBe('COORDENADA_INVALIDA');
    }
  });

  it('coordenada não numérica lança ErroDominio', () => {
    expect.assertions(2);
    try {
      parsearZonasExclusao('a,2:4,5');
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroDominio);
      expect((erro as ErroDominio).codigo).toBe('COORDENADA_INVALIDA');
    }
  });

  it('"de" maior que "ate" em algum eixo lança ErroDominio', () => {
    expect.assertions(2);
    try {
      parsearZonasExclusao('4,2:2,5');
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroDominio);
      expect((erro as ErroDominio).codigo).toBe('COORDENADA_INVALIDA');
    }
  });
});

describe('criarMapaCidade — bloqueada', () => {
  const zonas: ZonaExclusao[] = [{ de: { x: 2, y: 2 }, ate: { x: 4, y: 4 } }];
  const mapa = criarMapaCidade({ cidadeTamanho: 10, zonas });

  it('célula dentro do retângulo (borda inclusiva) está bloqueada', () => {
    expect(mapa.bloqueada({ x: 2, y: 2 })).toBe(true);
    expect(mapa.bloqueada({ x: 4, y: 4 })).toBe(true);
    expect(mapa.bloqueada({ x: 3, y: 3 })).toBe(true);
  });

  it('célula fora do retângulo não está bloqueada', () => {
    expect(mapa.bloqueada({ x: 1, y: 2 })).toBe(false);
    expect(mapa.bloqueada({ x: 5, y: 5 })).toBe(false);
  });

  it('zona fora da malha 0..cidadeTamanho lança ErroDominio', () => {
    expect.assertions(2);
    try {
      criarMapaCidade({
        cidadeTamanho: 10,
        zonas: [{ de: { x: 0, y: 0 }, ate: { x: 15, y: 0 } }],
      });
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroDominio);
      expect((erro as ErroDominio).codigo).toBe('COORDENADA_FORA_DA_MALHA');
    }
  });
});

describe('criarMapaCidade — distancia sem zonas (regressão de compatibilidade)', () => {
  const mapa = criarMapaCidade({ cidadeTamanho: 20, zonas: [] });
  const pares: readonly [Coordenada, Coordenada][] = [
    [
      { x: 0, y: 0 },
      { x: 3, y: 4 },
    ],
    [
      { x: 1, y: 1 },
      { x: 1, y: 1 },
    ],
    [
      { x: 10, y: 0 },
      { x: 0, y: 10 },
    ],
    [
      { x: 5, y: 5 },
      { x: 2, y: 8 },
    ],
  ];

  it('é idêntica à distância Manhattan para vários pares', () => {
    for (const [a, b] of pares) {
      expect(mapa.distancia(a, b)).toBe(distanciaManhattan(a, b));
    }
  });
});

describe('criarMapaCidade — distancia com zonas', () => {
  it('parede que obriga desvio devolve valor maior que o Manhattan', () => {
    // Parede vertical em x=3, y=0..6, deixando y=7..8 livres para contornar
    // ao atravessar de (0,4) a (6,4) numa malha 0..8.
    const zonas: ZonaExclusao[] = [{ de: { x: 3, y: 0 }, ate: { x: 3, y: 6 } }];
    const mapa = criarMapaCidade({ cidadeTamanho: 8, zonas });

    const a: Coordenada = { x: 0, y: 4 };
    const b: Coordenada = { x: 6, y: 4 };

    const distancia = mapa.distancia(a, b);

    expect(distancia).not.toBeNull();
    expect(distancia as number).toBeGreaterThan(distanciaManhattan(a, b));
  });

  it('parede que não fica no caminho não altera a distância', () => {
    const zonas: ZonaExclusao[] = [{ de: { x: 8, y: 8 }, ate: { x: 9, y: 9 } }];
    const mapa = criarMapaCidade({ cidadeTamanho: 10, zonas });

    const a: Coordenada = { x: 0, y: 0 };
    const b: Coordenada = { x: 2, y: 2 };

    expect(mapa.distancia(a, b)).toBe(distanciaManhattan(a, b));
  });

  it('distância para célula bloqueada devolve null', () => {
    const zonas: ZonaExclusao[] = [{ de: { x: 3, y: 3 }, ate: { x: 3, y: 3 } }];
    const mapa = criarMapaCidade({ cidadeTamanho: 10, zonas });

    expect(mapa.distancia({ x: 0, y: 0 }, { x: 3, y: 3 })).toBeNull();
  });

  it('destino cercado por zonas em todos os lados devolve null', () => {
    // Cerca (2,2) inteiramente com uma zona anelar (o próprio (2,2) não bloqueado).
    const zonas: ZonaExclusao[] = [
      { de: { x: 1, y: 1 }, ate: { x: 3, y: 1 } },
      { de: { x: 1, y: 3 }, ate: { x: 3, y: 3 } },
      { de: { x: 1, y: 1 }, ate: { x: 1, y: 3 } },
      { de: { x: 3, y: 1 }, ate: { x: 3, y: 3 } },
    ];
    const mapa = criarMapaCidade({ cidadeTamanho: 10, zonas });

    expect(mapa.distancia({ x: 0, y: 0 }, { x: 2, y: 2 })).toBeNull();
  });

  it('é simétrica: distancia(a,b) === distancia(b,a)', () => {
    const zonas: ZonaExclusao[] = [{ de: { x: 3, y: 0 }, ate: { x: 3, y: 6 } }];
    const mapa = criarMapaCidade({ cidadeTamanho: 8, zonas });
    const a: Coordenada = { x: 0, y: 4 };
    const b: Coordenada = { x: 6, y: 4 };

    expect(mapa.distancia(a, b)).toBe(mapa.distancia(b, a));
  });
});

describe('criarMapaCidade — determinismo (D13)', () => {
  it('duas chamadas seguidas no mesmo mapa dão o mesmo resultado', () => {
    const zonas: ZonaExclusao[] = [{ de: { x: 3, y: 0 }, ate: { x: 3, y: 6 } }];
    const mapa = criarMapaCidade({ cidadeTamanho: 8, zonas });
    const a: Coordenada = { x: 0, y: 4 };
    const b: Coordenada = { x: 6, y: 4 };

    expect(mapa.distancia(a, b)).toBe(mapa.distancia(a, b));
  });

  it('dois mapas criados da mesma config dão o mesmo resultado', () => {
    const zonas: ZonaExclusao[] = [{ de: { x: 3, y: 0 }, ate: { x: 3, y: 6 } }];
    const mapa1 = criarMapaCidade({ cidadeTamanho: 8, zonas });
    const mapa2 = criarMapaCidade({ cidadeTamanho: 8, zonas });
    const a: Coordenada = { x: 0, y: 4 };
    const b: Coordenada = { x: 6, y: 4 };

    expect(mapa1.distancia(a, b)).toBe(mapa2.distancia(a, b));
  });
});

describe('criarMapaCidade — caminho() (E6-4/D39)', () => {
  it('a === b devolve [a]', () => {
    const mapa = criarMapaCidade({ cidadeTamanho: 10, zonas: [] });
    const a: Coordenada = { x: 3, y: 3 };

    expect(mapa.caminho(a, a)).toEqual([a]);
  });

  it('destino bloqueado devolve null (mesma condição de distancia)', () => {
    const zonas: ZonaExclusao[] = [{ de: { x: 3, y: 3 }, ate: { x: 3, y: 3 } }];
    const mapa = criarMapaCidade({ cidadeTamanho: 10, zonas });

    expect(mapa.caminho({ x: 0, y: 0 }, { x: 3, y: 3 })).toBeNull();
  });

  it('destino cercado devolve null (mesma condição de distancia)', () => {
    const zonas: ZonaExclusao[] = [
      { de: { x: 1, y: 1 }, ate: { x: 3, y: 1 } },
      { de: { x: 1, y: 3 }, ate: { x: 3, y: 3 } },
      { de: { x: 1, y: 1 }, ate: { x: 1, y: 3 } },
      { de: { x: 3, y: 1 }, ate: { x: 3, y: 3 } },
    ];
    const mapa = criarMapaCidade({ cidadeTamanho: 10, zonas });

    expect(mapa.caminho({ x: 0, y: 0 }, { x: 2, y: 2 })).toBeNull();
  });

  it('sem zonas: trajeto Manhattan mínimo — comprimento, adjacência e sem repetição', () => {
    const mapa = criarMapaCidade({ cidadeTamanho: 20, zonas: [] });
    const a: Coordenada = { x: 0, y: 0 };
    const b: Coordenada = { x: 3, y: 4 };

    const caminho = mapa.caminho(a, b);

    expect(caminho).not.toBeNull();
    const passos = caminho as Coordenada[];
    expect(passos).toHaveLength((mapa.distancia(a, b) as number) + 1);
    expect(passos[0]).toEqual(a);
    expect(passos.at(-1)).toEqual(b);

    const vistos = new Set<string>();
    for (let i = 0; i < passos.length; i += 1) {
      const chave = `${passos[i]!.x},${passos[i]!.y}`;
      expect(vistos.has(chave)).toBe(false);
      vistos.add(chave);
      if (i > 0) {
        const anterior = passos[i - 1]!;
        const atual = passos[i]!;
        expect(distanciaManhattan(anterior, atual)).toBe(1);
      }
    }
  });

  it('com zona no meio: nenhuma célula do caminho está bloqueada, e comprimento bate com distancia+1', () => {
    const zonas: ZonaExclusao[] = [{ de: { x: 3, y: 0 }, ate: { x: 3, y: 6 } }];
    const mapa = criarMapaCidade({ cidadeTamanho: 8, zonas });
    const a: Coordenada = { x: 0, y: 4 };
    const b: Coordenada = { x: 6, y: 4 };

    const caminho = mapa.caminho(a, b);

    expect(caminho).not.toBeNull();
    const passos = caminho as Coordenada[];
    expect(passos).toHaveLength((mapa.distancia(a, b) as number) + 1);
    for (const passo of passos) {
      expect(mapa.bloqueada(passo)).toBe(false);
    }
  });

  it('determinismo: duas chamadas iguais e dois mapas da mesma config produzem o mesmo array', () => {
    const zonas: ZonaExclusao[] = [{ de: { x: 3, y: 0 }, ate: { x: 3, y: 6 } }];
    const mapa1 = criarMapaCidade({ cidadeTamanho: 8, zonas });
    const mapa2 = criarMapaCidade({ cidadeTamanho: 8, zonas });
    const a: Coordenada = { x: 0, y: 4 };
    const b: Coordenada = { x: 6, y: 4 };

    expect(mapa1.caminho(a, b)).toEqual(mapa1.caminho(a, b));
    expect(mapa1.caminho(a, b)).toEqual(mapa2.caminho(a, b));
  });

  it('desempate exato: entre caminhos mínimos, elege o de menor x, depois menor y (D12)', () => {
    const mapa = criarMapaCidade({ cidadeTamanho: 10, zonas: [] });
    const a: Coordenada = { x: 0, y: 0 };
    const b: Coordenada = { x: 2, y: 2 };

    const caminho = mapa.caminho(a, b);

    expect(caminho).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: 2 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
    ]);
  });
});
