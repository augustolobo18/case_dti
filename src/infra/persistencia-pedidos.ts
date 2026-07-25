import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Pedido } from '../domain/pedido.js';

/**
 * Porta de persistência dos pedidos. Síncrona de propósito: mantém o
 * repositório simples e os testes sem `async` (D6).
 */
export type PersistenciaPedidos = {
  carregar(): Pedido[];
  salvar(pedidos: readonly Pedido[]): void;
};

/**
 * Persistência em arquivo JSON local (D6). `carregar` devolve `[]` se o
 * arquivo ainda não existir; `salvar` grava de forma atômica (arquivo
 * temporário + rename) para evitar JSON truncado se o processo morrer no meio.
 */
export function criarPersistenciaArquivo(caminho: string): PersistenciaPedidos {
  return {
    carregar(): Pedido[] {
      if (!existsSync(caminho)) {
        return [];
      }
      const conteudo = readFileSync(caminho, 'utf-8');
      return JSON.parse(conteudo) as Pedido[];
    },

    salvar(pedidos: readonly Pedido[]): void {
      const diretorio = dirname(caminho);
      if (!existsSync(diretorio)) {
        mkdirSync(diretorio, { recursive: true });
      }
      const caminhoTemporario = `${caminho}.tmp`;
      writeFileSync(caminhoTemporario, JSON.stringify(pedidos, null, 2), 'utf-8');
      renameSync(caminhoTemporario, caminho);
    },
  };
}

/** Persistência em memória — usada pelos testes, sem tocar o disco. */
export function criarPersistenciaMemoria(inicial: Pedido[] = []): PersistenciaPedidos {
  let pedidos: Pedido[] = [...inicial];

  return {
    carregar(): Pedido[] {
      return [...pedidos];
    },

    salvar(novosPedidos: readonly Pedido[]): void {
      pedidos = [...novosPedidos];
    },
  };
}
