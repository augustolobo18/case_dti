import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Viagem } from '../domain/viagem.js';
import { ErroPersistencia } from './erros.js';
import { criarPersistenciaArquivo, criarPersistenciaMemoria } from './persistencia-viagens.js';

const VIAGEM_EXEMPLO: Viagem = {
  id: 'viagem-1',
  droneId: 'drone-1',
  pedidoIds: ['pedido-1', 'pedido-2'],
  paradas: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 0 },
  ],
  distanciaQuadras: 2,
  cargaKg: 4,
};

describe('criarPersistenciaMemoria', () => {
  it('devolve lista vazia quando nada foi salvo ainda', () => {
    const persistencia = criarPersistenciaMemoria();
    expect(persistencia.carregar()).toEqual([]);
  });

  it('faz o round-trip salvar -> carregar', () => {
    const persistencia = criarPersistenciaMemoria();

    persistencia.salvar([VIAGEM_EXEMPLO]);

    expect(persistencia.carregar()).toEqual([VIAGEM_EXEMPLO]);
  });

  it('desacopla o retorno por cópia — mutar o retorno não afeta a persistência', () => {
    const persistencia = criarPersistenciaMemoria();
    persistencia.salvar([VIAGEM_EXEMPLO]);

    const carregado = persistencia.carregar();
    carregado.push({ ...VIAGEM_EXEMPLO, id: 'outra' });

    expect(persistencia.carregar()).toEqual([VIAGEM_EXEMPLO]);
  });
});

describe('criarPersistenciaArquivo', () => {
  let diretorio: string;

  beforeEach(() => {
    diretorio = mkdtempSync(join(tmpdir(), 'drone-delivery-viagens-'));
  });

  afterEach(() => {
    rmSync(diretorio, { recursive: true, force: true });
  });

  it('devolve lista vazia quando o arquivo não existe (primeiro boot)', () => {
    const caminho = join(diretorio, 'viagens.json');
    const persistencia = criarPersistenciaArquivo(caminho);

    expect(persistencia.carregar()).toEqual([]);
    expect(existsSync(caminho)).toBe(false);
  });

  it('faz o round-trip salvar -> carregar na mesma instância', () => {
    const caminho = join(diretorio, 'viagens.json');
    const persistencia = criarPersistenciaArquivo(caminho);

    persistencia.salvar([VIAGEM_EXEMPLO]);

    expect(persistencia.carregar()).toEqual([VIAGEM_EXEMPLO]);
  });

  it('escreve de forma atômica: não deixa o arquivo .tmp no diretório', () => {
    const caminho = join(diretorio, 'viagens.json');
    const persistencia = criarPersistenciaArquivo(caminho);

    persistencia.salvar([VIAGEM_EXEMPLO]);

    expect(readdirSync(diretorio)).toEqual(['viagens.json']);
  });

  it('lança ErroPersistencia citando o caminho quando o JSON está sintaticamente quebrado', () => {
    const caminho = join(diretorio, 'viagens.json');
    writeFileSync(caminho, '{ "id": "viagem-1", }', 'utf-8');
    const persistencia = criarPersistenciaArquivo(caminho);

    expect(() => persistencia.carregar()).toThrow(ErroPersistencia);
    expect(() => persistencia.carregar()).toThrow(caminho);
  });

  it('lança ErroPersistencia citando o campo quando a forma é inválida', () => {
    const caminho = join(diretorio, 'viagens.json');
    writeFileSync(caminho, JSON.stringify([{ ...VIAGEM_EXEMPLO, cargaKg: '4' }]), 'utf-8');
    const persistencia = criarPersistenciaArquivo(caminho);

    expect(() => persistencia.carregar()).toThrow(/cargaKg/);
  });

  it('não apaga nem regrava o arquivo inválido depois de uma falha de validação', () => {
    const caminho = join(diretorio, 'viagens.json');
    const conteudoOriginal = JSON.stringify([{ ...VIAGEM_EXEMPLO, cargaKg: '4' }]);
    writeFileSync(caminho, conteudoOriginal, 'utf-8');
    const persistencia = criarPersistenciaArquivo(caminho);

    expect(() => persistencia.carregar()).toThrow(ErroPersistencia);
    expect(readFileSync(caminho, 'utf-8')).toBe(conteudoOriginal);
  });

  it('não apaga nem regrava o arquivo inválido depois de uma falha de sintaxe', () => {
    const caminho = join(diretorio, 'viagens.json');
    const conteudoOriginal = '{ "id": "viagem-1", }';
    writeFileSync(caminho, conteudoOriginal, 'utf-8');
    const persistencia = criarPersistenciaArquivo(caminho);

    expect(() => persistencia.carregar()).toThrow(ErroPersistencia);
    expect(readFileSync(caminho, 'utf-8')).toBe(conteudoOriginal);
  });

  it('cria o diretório (inclusive aninhado) ao salvar, se ele ainda não existir', () => {
    const caminho = join(diretorio, 'aninhado', 'mais-fundo', 'viagens.json');
    const persistencia = criarPersistenciaArquivo(caminho);

    persistencia.salvar([VIAGEM_EXEMPLO]);

    expect(existsSync(caminho)).toBe(true);
    expect(persistencia.carregar()).toEqual([VIAGEM_EXEMPLO]);
  });
});
