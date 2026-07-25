import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Pedido } from '../domain/pedido.js';
import { ErroPersistencia } from './erros.js';
import { schemaArquivoPedidos } from './schema-pedido.js';

/**
 * Porta de persistência dos pedidos. Síncrona de propósito: mantém o
 * repositório simples e os testes sem `async` (D6).
 */
export type PersistenciaPedidos = {
  carregar(): Pedido[];
  salvar(pedidos: readonly Pedido[]): void;
};

/**
 * Formata os `issues` do Zod como `[índice].campo: motivo`, um por linha.
 * Quando o problema é a raiz do arquivo (path vazio — ex.: o conteúdo não é um
 * array), sai só o motivo, sem prefixo de caminho.
 */
function formatarIssues(issues: { path: (string | number)[]; message: string }[]): string {
  return issues
    .map((issue) => {
      if (issue.path.length === 0) {
        return `  ${issue.message}`;
      }
      const [indice, ...resto] = issue.path;
      const caminho = resto.length > 0 ? `[${indice}].${resto.join('.')}` : `[${indice}]`;
      return `  ${caminho}: ${issue.message}`;
    })
    .join('\n');
}

/**
 * Persistência em arquivo JSON local (D6). `salvar` grava de forma atômica
 * (arquivo temporário + rename) para evitar JSON truncado se o processo
 * morrer no meio.
 *
 * `carregar()` tem três saídas: `[]` se o arquivo ainda não existir (primeiro
 * boot, comportamento inalterado); o `Pedido[]` validado, se o conteúdo tiver
 * a forma esperada; ou `ErroPersistencia`, se o JSON estiver com sintaxe
 * quebrada ou com forma inválida. A falha é intencional e acontece no boot,
 * antes da primeira requisição — carregar parcialmente deixaria a próxima
 * gravação regravar o arquivo sem os pedidos descartados, transformando uma
 * corrupção recuperável à mão numa perda definitiva. O arquivo inválido nunca
 * é apagado, renomeado ou regravado por este método.
 */
export function criarPersistenciaArquivo(caminho: string): PersistenciaPedidos {
  return {
    carregar(): Pedido[] {
      if (!existsSync(caminho)) {
        return [];
      }

      let bruto: unknown;
      try {
        bruto = JSON.parse(readFileSync(caminho, 'utf-8'));
      } catch (causa) {
        throw new ErroPersistencia(
          `Erro ao carregar ${caminho}: JSON inválido.\n` +
            'O arquivo está corrompido ou foi editado à mão.',
          causa,
        );
      }

      const resultado = schemaArquivoPedidos.safeParse(bruto);
      if (!resultado.success) {
        throw new ErroPersistencia(
          `Erro ao carregar ${caminho}:\n` +
            `${formatarIssues(resultado.error.issues)}\n` +
            'O arquivo está corrompido ou foi editado à mão.',
        );
      }

      return resultado.data;
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
