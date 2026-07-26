import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Viagem } from '../domain/viagem.js';
import { ErroPersistencia } from './erros.js';
import { schemaArquivoViagens } from './schema-viagem.js';

/**
 * Porta de persistência das viagens. Síncrona de propósito, mesmo desenho de
 * `persistencia-pedidos.ts` (D6/D26).
 */
export type PersistenciaViagens = {
  carregar(): Viagem[];
  salvar(viagens: readonly Viagem[]): void;
};

/**
 * Formata os `issues` do Zod como `[índice].campo: motivo`, um por linha —
 * mesmo formato de `persistencia-pedidos.ts`.
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
 * Persistência em arquivo JSON local (D26), com o mesmo desenho de
 * `criarPersistenciaArquivo` dos pedidos: escrita atômica (arquivo temporário
 * + rename), `carregar()` devolve `[]` no primeiro boot e nunca apaga,
 * renomeia ou regrava um arquivo inválido — a falha acontece alto, no boot.
 */
export function criarPersistenciaArquivo(caminho: string): PersistenciaViagens {
  return {
    carregar(): Viagem[] {
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

      const resultado = schemaArquivoViagens.safeParse(bruto);
      if (!resultado.success) {
        throw new ErroPersistencia(
          `Erro ao carregar ${caminho}:\n` +
            `${formatarIssues(resultado.error.issues)}\n` +
            'O arquivo está corrompido ou foi editado à mão.',
        );
      }

      return resultado.data;
    },

    salvar(viagens: readonly Viagem[]): void {
      const diretorio = dirname(caminho);
      if (!existsSync(diretorio)) {
        mkdirSync(diretorio, { recursive: true });
      }
      const caminhoTemporario = `${caminho}.tmp`;
      writeFileSync(caminhoTemporario, JSON.stringify(viagens, null, 2), 'utf-8');
      renameSync(caminhoTemporario, caminho);
    },
  };
}

/** Persistência em memória — usada pelos testes, sem tocar o disco. */
export function criarPersistenciaMemoria(inicial: Viagem[] = []): PersistenciaViagens {
  let viagens: Viagem[] = [...inicial];

  return {
    carregar(): Viagem[] {
      return [...viagens];
    },

    salvar(novasViagens: readonly Viagem[]): void {
      viagens = [...novasViagens];
    },
  };
}
