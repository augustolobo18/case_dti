import { ErroDominio } from '../domain/erros.js';
import { criarFrota, criarGeradorIdSequencial, type Drone } from '../domain/drone.js';
import type { Coordenada } from '../domain/coordenada.js';

/** Opções para montar a frota (D8): mesmos limites para todos os drones. */
export type OpcoesFrota = {
  readonly base: Coordenada;
  readonly capacidadeKg: number;
  readonly alcanceQuadras: number;
  readonly quantidade: number;
};

/** Repositório de frota: expõe consulta sobre os drones em memória. */
export type RepositorioFrota = {
  listar(): Drone[];
  buscarPorId(id: string): Drone;
};

/**
 * Cria o repositório de frota a partir da config (D8): a frota é homogênea,
 * fixa por reinício, e **derivada da config a cada boot** — não é persistida.
 * Persistir a frota criaria divergência entre o arquivo salvo e o `.env`
 * alterado pelo operador; reconstruí-la sempre a partir da config evita esse
 * problema, ao custo de ids determinísticos (`criarGeradorIdSequencial`) em
 * vez de aleatórios, para que permaneçam estáveis entre reinícios.
 */
export function criarRepositorioFrota(opcoes: OpcoesFrota): RepositorioFrota {
  const { base, capacidadeKg, alcanceQuadras, quantidade } = opcoes;

  const frota = criarFrota(quantidade, {
    base,
    capacidadeKg,
    alcanceQuadras,
    gerarId: criarGeradorIdSequencial('drone'),
  });

  function buscarPorId(id: string): Drone {
    const drone = frota.find((item) => item.id === id);
    if (!drone) {
      throw new ErroDominio('DRONE_NAO_ENCONTRADO', `Drone não encontrado: id="${id}".`);
    }
    return drone;
  }

  return {
    listar(): Drone[] {
      return [...frota];
    },

    buscarPorId,
  };
}
