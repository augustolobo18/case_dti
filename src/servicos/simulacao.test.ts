import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ErroDominio } from '../domain/erros.js';
import { alocarPedidos } from '../domain/alocacao.js';
import { criarMapaCidade, type MapaCidade } from '../domain/mapa.js';
import { criarPedido, type LimitesPedido } from '../domain/pedido.js';
import type { TemposSimulacao } from '../domain/simulacao.js';
import { criarViagem } from '../domain/viagem.js';
import {
  criarPersistenciaMemoria as criarPersistenciaMemoriaPedidos,
  type PersistenciaPedidos,
} from '../infra/persistencia-pedidos.js';
import {
  criarPersistenciaMemoria as criarPersistenciaMemoriaViagens,
  type PersistenciaViagens,
} from '../infra/persistencia-viagens.js';
import { criarRepositorioPedidos, type RepositorioPedidos } from '../repositorio/pedidos.js';
import { criarRepositorioFrota, type RepositorioFrota } from '../repositorio/frota.js';
import { criarRepositorioViagens, type RepositorioViagens } from '../repositorio/viagens.js';
import { criarServicoSimulacao } from './simulacao.js';

const LIMITES: LimitesPedido = { capacidadeKg: 10, cidadeTamanho: 1000 };
const BASE = { x: 0, y: 0 };
const TEMPOS: TemposSimulacao = {
  velocidadeQuadrasMin: 1,
  carregamentoMin: 5,
  entregaMin: 2,
  recargaMinPorQuadra: 0.5,
};

const MAPA_SEM_ZONAS: MapaCidade = criarMapaCidade({ cidadeTamanho: 1000, zonas: [] });

let pedidos: RepositorioPedidos;
let frota: RepositorioFrota;
let viagens: RepositorioViagens;
let contador = 0;

function novoPedidoAjudante(x: number, y: number, pesoKg = 1) {
  contador += 1;
  const idFixo = `pedido-teste-${contador}`;
  return criarPedido(
    { x, y, pesoKg, prioridade: 'baixa' },
    { limites: LIMITES, gerarId: () => idFixo },
  );
}

beforeEach(() => {
  contador = 0;
  pedidos = criarRepositorioPedidos(criarPersistenciaMemoriaPedidos());
  frota = criarRepositorioFrota({
    base: BASE,
    capacidadeKg: 10,
    alcanceQuadras: 40,
    quantidade: 1,
  });
  viagens = criarRepositorioViagens({
    persistencia: criarPersistenciaMemoriaViagens(),
    droneIds: frota.listar().map((d) => d.id),
  });
});

function alocarEPersistir() {
  const pendentes = pedidos.listar({ status: 'pendente' });
  const resultado = alocarPedidos({
    pedidos: pendentes,
    droneIds: frota.listar().map((d) => d.id),
    base: BASE,
    capacidadeKg: 10,
    alcanceQuadras: 40,
    mapa: MAPA_SEM_ZONAS,
  });
  if (resultado.viagens.length > 0) {
    pedidos.marcarComoAlocados(resultado.viagens.flatMap((v) => v.pedidoIds));
    viagens.substituirTodas([...viagens.listar(), ...resultado.viagens]);
  }
  return resultado;
}

describe('criarServicoSimulacao', () => {
  it('sem alocação, a linha do tempo nasce zerada e o instante em 0', () => {
    const servico = criarServicoSimulacao({
      pedidos,
      frota,
      viagens,
      base: BASE,
      tempos: TEMPOS,
      mapa: MAPA_SEM_ZONAS,
    });

    expect(servico.instanteAtual()).toBe(0);
    expect(servico.linhaDoTempo()).toEqual({
      eventos: [],
      metricas: {
        totalEntregas: 0,
        makespanMin: 0,
        tempoMedioEntregaMin: 0,
        tempoPorPedido: [],
        porDrone: [],
        droneMaisEficiente: null,
      },
    });
  });

  it('recomputar monta a linha do tempo das viagens não concluídas e zera o instante', () => {
    const pedido = pedidos.adicionar(novoPedidoAjudante(3, 4, 5));
    alocarEPersistir();
    const servico = criarServicoSimulacao({
      pedidos,
      frota,
      viagens,
      base: BASE,
      tempos: TEMPOS,
      mapa: MAPA_SEM_ZONAS,
    });

    const linha = servico.recomputar();

    expect(linha.eventos.length).toBeGreaterThan(0);
    expect(linha.metricas.tempoPorPedido.map((t) => t.pedidoId)).toEqual([pedido.id]);
    expect(servico.instanteAtual()).toBe(0);
  });

  it('avancarPara aplica só os eventos até o instante e deixa o estado intermediário coerente', () => {
    pedidos.adicionar(novoPedidoAjudante(3, 4, 5));
    alocarEPersistir();
    const servico = criarServicoSimulacao({
      pedidos,
      frota,
      viagens,
      base: BASE,
      tempos: TEMPOS,
      mapa: MAPA_SEM_ZONAS,
    });
    servico.recomputar();

    // instante 5: só carga_iniciada + decolagem já ocorreram.
    servico.avancarPara(5);

    const droneId = frota.listar()[0]!.id;
    expect(frota.buscarPorId(droneId).estado).toBe('em_voo');
    expect(pedidos.listar()[0]?.status).toBe('em_voo');
    expect(viagens.listar()[0]?.status).toBe('em_execucao');
  });

  it('avançar duas vezes não reaplica evento já aplicado', () => {
    pedidos.adicionar(novoPedidoAjudante(3, 4, 5));
    alocarEPersistir();
    const servico = criarServicoSimulacao({
      pedidos,
      frota,
      viagens,
      base: BASE,
      tempos: TEMPOS,
      mapa: MAPA_SEM_ZONAS,
    });
    servico.recomputar();

    const primeiro = servico.avancarPara(5);
    const segundo = servico.avancarPara(5);

    expect(primeiro.eventosAplicados.length).toBeGreaterThan(0);
    expect(segundo.eventosAplicados).toEqual([]);
  });

  it('avançar para instante menor que o corrente lança AVANCO_INVALIDO', () => {
    pedidos.adicionar(novoPedidoAjudante(3, 4, 5));
    alocarEPersistir();
    const servico = criarServicoSimulacao({
      pedidos,
      frota,
      viagens,
      base: BASE,
      tempos: TEMPOS,
      mapa: MAPA_SEM_ZONAS,
    });
    servico.recomputar();
    servico.avancarPara(10);

    expect.assertions(2);
    try {
      servico.avancarPara(5);
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroDominio);
      expect((erro as ErroDominio).codigo).toBe('AVANCO_INVALIDO');
    }
  });

  it('avançar além do makespan conclui tudo: pedidos entregues, viagens concluídas, drones idle na base com bateria cheia', () => {
    pedidos.adicionar(novoPedidoAjudante(3, 4, 5));
    alocarEPersistir();
    const servico = criarServicoSimulacao({
      pedidos,
      frota,
      viagens,
      base: BASE,
      tempos: TEMPOS,
      mapa: MAPA_SEM_ZONAS,
    });
    const linha = servico.recomputar();

    const resultado = servico.avancarPara(linha.metricas.makespanMin + 1000);

    expect(resultado.instanteAtual).toBe(linha.metricas.makespanMin + 1000);
    for (const pedido of pedidos.listar()) {
      expect(pedido.status).toBe('entregue');
    }
    for (const viagem of viagens.listar()) {
      expect(viagem.status).toBe('concluida');
    }
    for (const drone of frota.listar()) {
      expect(drone.estado).toBe('idle');
      expect(drone.posicao).toEqual(BASE);
      expect(drone.bateriaQuadras).toBe(drone.alcanceQuadras);
    }
  });
});

describe('criarServicoSimulacao — boot segue protegido pela reconciliação D27 (D44)', () => {
  it('viagens e frota coerentes após reconciliação: recomputar() no construtor não lança', () => {
    const pedido = novoPedidoAjudante(3, 4, 5);
    const persistenciaPedidos = criarPersistenciaMemoriaPedidos([pedido]);
    const pedidosCoerentes = criarRepositorioPedidos(persistenciaPedidos);
    const frotaCoerente = criarRepositorioFrota({
      base: BASE,
      capacidadeKg: 10,
      alcanceQuadras: 40,
      quantidade: 1,
    });
    const droneId = frotaCoerente.listar()[0]!.id;
    const viagemCoerente = criarViagem({
      droneId,
      pedidos: [pedido],
      base: BASE,
      capacidadeKg: 10,
      alcanceQuadras: 40,
      mapa: MAPA_SEM_ZONAS,
      gerarId: () => 'viagem-boot',
    });
    // Reconciliação D27 acontece na criação do repositório de viagens, antes
    // de `criarServicoSimulacao` — mesma ordem de `src/index.ts`.
    const viagensCoerentes = criarRepositorioViagens({
      persistencia: criarPersistenciaMemoriaViagens([viagemCoerente]),
      droneIds: frotaCoerente.listar().map((d) => d.id),
    });

    expect(() =>
      criarServicoSimulacao({
        pedidos: pedidosCoerentes,
        frota: frotaCoerente,
        viagens: viagensCoerentes,
        base: BASE,
        tempos: TEMPOS,
        mapa: MAPA_SEM_ZONAS,
      }),
    ).not.toThrow();
  });
});

describe('criarServicoSimulacao — avancarPara grava uma vez por arquivo (D43)', () => {
  let persistenciaPedidos: PersistenciaPedidos;
  let persistenciaViagens: PersistenciaViagens;
  let pedidosLote: RepositorioPedidos;
  let frotaLote: RepositorioFrota;
  let viagensLote: RepositorioViagens;
  let contadorLote = 0;

  function novoPedidoLote(x: number, y: number, pesoKg = 1) {
    contadorLote += 1;
    const idFixo = `pedido-lote-${contadorLote}`;
    return criarPedido(
      { x, y, pesoKg, prioridade: 'baixa' },
      { limites: LIMITES, gerarId: () => idFixo },
    );
  }

  function alocarEPersistirLote() {
    const pendentes = pedidosLote.listar({ status: 'pendente' });
    const resultado = alocarPedidos({
      pedidos: pendentes,
      droneIds: frotaLote.listar().map((d) => d.id),
      base: BASE,
      // Capacidade de 1kg: cada pedido de 1kg vira sua própria viagem —
      // garante várias viagens para o teste de contagem de gravações.
      capacidadeKg: 1,
      alcanceQuadras: 40,
      mapa: MAPA_SEM_ZONAS,
    });
    if (resultado.viagens.length > 0) {
      pedidosLote.marcarComoAlocados(resultado.viagens.flatMap((v) => v.pedidoIds));
      viagensLote.substituirTodas([...viagensLote.listar(), ...resultado.viagens]);
    }
    return resultado;
  }

  beforeEach(() => {
    contadorLote = 0;
    persistenciaPedidos = criarPersistenciaMemoriaPedidos();
    pedidosLote = criarRepositorioPedidos(persistenciaPedidos);
    frotaLote = criarRepositorioFrota({
      base: BASE,
      capacidadeKg: 10,
      alcanceQuadras: 40,
      quantidade: 2,
    });
    persistenciaViagens = criarPersistenciaMemoriaViagens();
    viagensLote = criarRepositorioViagens({
      persistencia: persistenciaViagens,
      droneIds: frotaLote.listar().map((d) => d.id),
    });
  });

  it('avancarPara que aplica todos os eventos grava pedidos.json e viagens.json exatamente 1 vez cada', () => {
    pedidosLote.adicionar(novoPedidoLote(3, 4, 1));
    pedidosLote.adicionar(novoPedidoLote(1, 2, 1));
    pedidosLote.adicionar(novoPedidoLote(5, 6, 1));
    alocarEPersistirLote();

    const servico = criarServicoSimulacao({
      pedidos: pedidosLote,
      frota: frotaLote,
      viagens: viagensLote,
      base: BASE,
      tempos: TEMPOS,
      mapa: MAPA_SEM_ZONAS,
    });
    const linha = servico.recomputar();

    const espiaPedidos = vi.spyOn(persistenciaPedidos, 'salvar');
    const espiaViagens = vi.spyOn(persistenciaViagens, 'salvar');

    servico.avancarPara(linha.metricas.makespanMin + 1000);

    expect(espiaPedidos).toHaveBeenCalledTimes(1);
    expect(espiaViagens).toHaveBeenCalledTimes(1);

    // Regressão de estado: idêntico ao comportamento de hoje, só a contagem muda.
    for (const pedido of pedidosLote.listar()) {
      expect(pedido.status).toBe('entregue');
    }
    for (const viagem of viagensLote.listar()) {
      expect(viagem.status).toBe('concluida');
    }
    for (const drone of frotaLote.listar()) {
      expect(drone.estado).toBe('idle');
    }
  });

  it('avancarPara que não aplica nenhum evento não grava nada', () => {
    pedidosLote.adicionar(novoPedidoLote(3, 4, 1));
    alocarEPersistirLote();

    const servico = criarServicoSimulacao({
      pedidos: pedidosLote,
      frota: frotaLote,
      viagens: viagensLote,
      base: BASE,
      tempos: TEMPOS,
      mapa: MAPA_SEM_ZONAS,
    });
    servico.recomputar();

    const espiaPedidos = vi.spyOn(persistenciaPedidos, 'salvar');
    const espiaViagens = vi.spyOn(persistenciaViagens, 'salvar');

    servico.avancarPara(0);

    expect(espiaPedidos).not.toHaveBeenCalled();
    expect(espiaViagens).not.toHaveBeenCalled();
  });
});

describe('recomputar — replanejamento no meio da rodada (D46)', () => {
  function novoServico() {
    return criarServicoSimulacao({
      pedidos,
      frota,
      viagens,
      base: BASE,
      tempos: TEMPOS,
      mapa: MAPA_SEM_ZONAS,
    });
  }

  it('desfaz o progresso das viagens não concluídas, de modo que o avanço volta a funcionar', () => {
    const pedido = pedidos.adicionar(novoPedidoAjudante(1, 0, 1));
    alocarEPersistir();
    const servico = novoServico();
    servico.recomputar();
    servico.avancarPara(9);

    expect(pedidos.buscarPorId(pedido.id).status).toBe('entregue');
    expect(servico.instanteAtual()).toBe(9);

    // replanejamento: recomputar zera o relógio, então precisa zerar o mundo junto
    servico.recomputar();

    expect(servico.instanteAtual()).toBe(0);
    expect(pedidos.buscarPorId(pedido.id).status).toBe('alocado');
    expect(() => servico.avancarPara(9)).not.toThrow();
    expect(pedidos.buscarPorId(pedido.id).status).toBe('entregue');
  });

  it('não mexe em pedido de viagem já concluída', () => {
    const pedido = pedidos.adicionar(novoPedidoAjudante(1, 0, 1));
    alocarEPersistir();
    const servico = novoServico();
    servico.recomputar();
    servico.avancarPara(200);

    expect(viagens.listar()[0]?.status).toBe('concluida');

    servico.recomputar();

    expect(pedidos.buscarPorId(pedido.id).status).toBe('entregue');
  });
});
