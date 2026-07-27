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
  /**
   * Executa `fn` em modo de lote (D43): mutações dentro de `fn` continuam
   * mudando a memória imediatamente, mas a gravação em disco é adiada para o
   * fim de `fn` — uma única chamada a `salvar`, em vez de uma por mutação.
   * Reentrante: só o lote mais externo grava. Se `fn` lançar, a exceção
   * propaga e o progresso mutado até ali ainda é gravado (`finally`).
   */
  emLote<T>(fn: () => T): T;
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

  // Gravação da reconciliação do boot (D27): acontece aqui, na criação, fora
  // de qualquer emLote — não passa por `persistir()`/`adiandoGravacao`.
  if (pedidoIdsOrfaos.length > 0) {
    persistencia.salvar(viagens);
  }

  let adiandoGravacao = false;
  let sujo = false;

  /** Ponto único de gravação write-through das mutações pós-boot (D43). */
  function persistir(): void {
    if (adiandoGravacao) {
      sujo = true;
      return;
    }
    persistencia.salvar(viagens);
  }

  function emLote<T>(fn: () => T): T {
    if (adiandoGravacao) {
      // Reentrante: só o lote mais externo grava.
      return fn();
    }
    adiandoGravacao = true;
    try {
      return fn();
    } finally {
      adiandoGravacao = false;
      if (sujo) {
        sujo = false;
        persistencia.salvar(viagens);
      }
    }
  }

  return {
    listar(): Viagem[] {
      return [...viagens];
    },

    substituirTodas(novasViagens: readonly Viagem[]): Viagem[] {
      viagens = [...novasViagens];
      persistir();
      return [...viagens];
    },

    pedidoIdsOrfaos(): string[] {
      return [...pedidoIdsOrfaos];
    },

    emLote,
  };
}
