import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import type { Pedido } from '../domain/pedido.js';
import { criarPersistenciaArquivo, criarPersistenciaMemoria } from './persistencia-pedidos.js';

const PEDIDO_EXEMPLO: Pedido = {
  id: 'id-1',
  destino: { x: 1, y: 2 },
  pesoKg: 3,
  prioridade: 'alta',
  status: 'pendente',
};

describe('criarPersistenciaMemoria', () => {
  it('devolve lista vazia quando nada foi salvo ainda', () => {
    const persistencia = criarPersistenciaMemoria();
    expect(persistencia.carregar()).toEqual([]);
  });

  it('faz o round-trip salvar -> carregar', () => {
    const persistencia = criarPersistenciaMemoria();

    persistencia.salvar([PEDIDO_EXEMPLO]);

    expect(persistencia.carregar()).toEqual([PEDIDO_EXEMPLO]);
  });

  it('mantém isolamento entre instâncias distintas', () => {
    const persistenciaA = criarPersistenciaMemoria();
    const persistenciaB = criarPersistenciaMemoria();

    persistenciaA.salvar([PEDIDO_EXEMPLO]);

    expect(persistenciaA.carregar()).toEqual([PEDIDO_EXEMPLO]);
    expect(persistenciaB.carregar()).toEqual([]);
  });

  it('parte do estado inicial informado', () => {
    const persistencia = criarPersistenciaMemoria([PEDIDO_EXEMPLO]);
    expect(persistencia.carregar()).toEqual([PEDIDO_EXEMPLO]);
  });
});

describe('criarPersistenciaArquivo', () => {
  it('devolve lista vazia quando o arquivo não existe, sem criar nada', () => {
    const caminhoInexistente = join(tmpdir(), `pedidos-inexistente-${Date.now()}.json`);
    const persistencia = criarPersistenciaArquivo(caminhoInexistente);

    expect(persistencia.carregar()).toEqual([]);
  });
});
