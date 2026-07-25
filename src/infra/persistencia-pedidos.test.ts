import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Pedido } from '../domain/pedido.js';
import { ErroPersistencia } from './erros.js';
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
  let diretorio: string;

  beforeEach(() => {
    diretorio = mkdtempSync(join(tmpdir(), 'drone-delivery-'));
  });

  afterEach(() => {
    rmSync(diretorio, { recursive: true, force: true });
  });

  it('devolve lista vazia quando o arquivo não existe, sem criar nada', () => {
    const caminho = join(diretorio, 'pedidos.json');
    const persistencia = criarPersistenciaArquivo(caminho);

    expect(persistencia.carregar()).toEqual([]);
    expect(existsSync(caminho)).toBe(false);
  });

  it('faz o round-trip salvar -> carregar na mesma instância', () => {
    const caminho = join(diretorio, 'pedidos.json');
    const persistencia = criarPersistenciaArquivo(caminho);

    persistencia.salvar([PEDIDO_EXEMPLO]);

    expect(persistencia.carregar()).toEqual([PEDIDO_EXEMPLO]);
  });

  it('sobrevive à criação de uma nova instância sobre o mesmo caminho (durabilidade, E1-1)', () => {
    const caminho = join(diretorio, 'pedidos.json');
    const persistencia1 = criarPersistenciaArquivo(caminho);
    persistencia1.salvar([PEDIDO_EXEMPLO]);

    const persistencia2 = criarPersistenciaArquivo(caminho);

    expect(persistencia2.carregar()).toEqual([PEDIDO_EXEMPLO]);
  });

  it('cria o diretório (inclusive aninhado) ao salvar, se ele ainda não existir', () => {
    const caminho = join(diretorio, 'aninhado', 'mais-fundo', 'pedidos.json');
    const persistencia = criarPersistenciaArquivo(caminho);

    persistencia.salvar([PEDIDO_EXEMPLO]);

    expect(existsSync(caminho)).toBe(true);
    expect(persistencia.carregar()).toEqual([PEDIDO_EXEMPLO]);
  });

  it('não deixa o arquivo temporário no diretório depois de salvar (prova do rename)', () => {
    const caminho = join(diretorio, 'pedidos.json');
    const persistencia = criarPersistenciaArquivo(caminho);

    persistencia.salvar([PEDIDO_EXEMPLO]);

    expect(readdirSync(diretorio)).toEqual(['pedidos.json']);
  });

  it('lança ErroPersistencia citando o caminho quando o JSON está sintaticamente quebrado', () => {
    const caminho = join(diretorio, 'pedidos.json');
    writeFileSync(caminho, '{ "id": "id-1", }', 'utf-8');
    const persistencia = criarPersistenciaArquivo(caminho);

    expect(() => persistencia.carregar()).toThrow(ErroPersistencia);
    expect(() => persistencia.carregar()).toThrow(caminho);
  });

  it('lança ErroPersistencia citando o campo quando pesoKg não é número', () => {
    const caminho = join(diretorio, 'pedidos.json');
    writeFileSync(caminho, JSON.stringify([{ ...PEDIDO_EXEMPLO, pesoKg: '5' }]), 'utf-8');
    const persistencia = criarPersistenciaArquivo(caminho);

    expect(() => persistencia.carregar()).toThrow(/pesoKg/);
  });

  it('lança ErroPersistencia citando o campo quando status está fora do enum', () => {
    const caminho = join(diretorio, 'pedidos.json');
    writeFileSync(caminho, JSON.stringify([{ ...PEDIDO_EXEMPLO, status: 'inexistente' }]), 'utf-8');
    const persistencia = criarPersistenciaArquivo(caminho);

    expect(() => persistencia.carregar()).toThrow(/status/);
  });

  it('lança ErroPersistencia citando o campo quando prioridade está fora do enum', () => {
    const caminho = join(diretorio, 'pedidos.json');
    writeFileSync(
      caminho,
      JSON.stringify([{ ...PEDIDO_EXEMPLO, prioridade: 'urgentissima' }]),
      'utf-8',
    );
    const persistencia = criarPersistenciaArquivo(caminho);

    expect(() => persistencia.carregar()).toThrow(/prioridade/);
  });

  it('lança ErroPersistencia citando o campo quando pesoKg é negativo', () => {
    const caminho = join(diretorio, 'pedidos.json');
    writeFileSync(caminho, JSON.stringify([{ ...PEDIDO_EXEMPLO, pesoKg: -5 }]), 'utf-8');
    const persistencia = criarPersistenciaArquivo(caminho);

    expect(() => persistencia.carregar()).toThrow(/pesoKg/);
  });

  it('lança ErroPersistencia citando o campo quando o destino é fracionário', () => {
    const caminho = join(diretorio, 'pedidos.json');
    writeFileSync(
      caminho,
      JSON.stringify([{ ...PEDIDO_EXEMPLO, destino: { x: 1.5, y: 2 } }]),
      'utf-8',
    );
    const persistencia = criarPersistenciaArquivo(caminho);

    expect(() => persistencia.carregar()).toThrow(/destino/);
  });

  it('lança ErroPersistencia citando o campo quando o id é vazio', () => {
    const caminho = join(diretorio, 'pedidos.json');
    writeFileSync(caminho, JSON.stringify([{ ...PEDIDO_EXEMPLO, id: '' }]), 'utf-8');
    const persistencia = criarPersistenciaArquivo(caminho);

    expect(() => persistencia.carregar()).toThrow(/id/);
  });

  it('lança ErroPersistencia quando o conteúdo do arquivo não é um array', () => {
    expect.assertions(3);
    const caminho = join(diretorio, 'pedidos.json');
    writeFileSync(caminho, JSON.stringify(PEDIDO_EXEMPLO), 'utf-8');
    const persistencia = criarPersistenciaArquivo(caminho);

    try {
      persistencia.carregar();
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroPersistencia);
      expect((erro as ErroPersistencia).message).toContain(caminho);
      // O problema é a raiz do arquivo (path vazio): a linha do motivo não pode
      // sair com prefixo de caminho solto, como "[Expected array".
      expect((erro as ErroPersistencia).message).not.toMatch(/\[\s*[A-Za-zÀ-ú]/);
    }
  });

  it('mantém o arquivo original intacto depois de uma falha de validação', () => {
    const caminho = join(diretorio, 'pedidos.json');
    const conteudoOriginal = JSON.stringify([{ ...PEDIDO_EXEMPLO, pesoKg: '5' }]);
    writeFileSync(caminho, conteudoOriginal, 'utf-8');
    const persistencia = criarPersistenciaArquivo(caminho);

    expect(() => persistencia.carregar()).toThrow(ErroPersistencia);
    expect(readFileSync(caminho, 'utf-8')).toBe(conteudoOriginal);
  });

  it('mantém o arquivo original intacto depois de uma falha de sintaxe', () => {
    const caminho = join(diretorio, 'pedidos.json');
    const conteudoOriginal = '{ "id": "id-1", }';
    writeFileSync(caminho, conteudoOriginal, 'utf-8');
    const persistencia = criarPersistenciaArquivo(caminho);

    expect(() => persistencia.carregar()).toThrow(ErroPersistencia);
    expect(readFileSync(caminho, 'utf-8')).toBe(conteudoOriginal);
  });
});
