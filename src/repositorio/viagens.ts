import { reconciliarViagens, type Viagem } from '../domain/viagem.js';
import type { PersistenciaViagens } from '../infra/persistencia-viagens.js';

/** Opções de criação do repositório de viagens. */
export type OpcoesRepositorioViagens = {
  readonly persistencia: PersistenciaViagens;
  readonly droneIds: readonly string[];
};

/** Repositório de viagens: mantém a lista em memória e persiste a cada mutação (write-through). */
export type RepositorioViagens = {
  listar(): Viagem[];
  substituirTodas(viagens: readonly Viagem[]): Viagem[];
  pedidoIdsOrfaos(): string[];
};

/**
 * Cria o repositório de viagens sobre uma porta de persistência (D26).
 * Na criação, reconcilia as viagens carregadas contra a frota atual (D27):
 * viagem cujo `droneId` não existe mais é descartada e seus `pedidoIds` ficam
 * disponíveis via `pedidoIdsOrfaos()` — o boot os devolve a `pendente`. Só
 * grava de volta se a reconciliação mudou algo (frota completa não regrava à
 * toa).
 */
export function criarRepositorioViagens(opcoes: OpcoesRepositorioViagens): RepositorioViagens {
  const { persistencia, droneIds } = opcoes;

  const carregadas = persistencia.carregar();
  const { viagens: reconciliadas, pedidoIdsOrfaos } = reconciliarViagens(carregadas, droneIds);

  let viagens: Viagem[] = [...reconciliadas];

  if (pedidoIdsOrfaos.length > 0) {
    persistencia.salvar(viagens);
  }

  return {
    listar(): Viagem[] {
      return [...viagens];
    },

    substituirTodas(novasViagens: readonly Viagem[]): Viagem[] {
      viagens = [...novasViagens];
      persistencia.salvar(viagens);
      return [...viagens];
    },

    pedidoIdsOrfaos(): string[] {
      return [...pedidoIdsOrfaos];
    },
  };
}
