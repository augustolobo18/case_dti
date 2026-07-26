/**
 * Configurações globais do simulador.
 * Valores podem ser sobrescritos por variáveis de ambiente (ver .env.example).
 */
export const config = {
  /** Porta do servidor HTTP. */
  port: Number(process.env.PORT ?? 3000),

  /** Capacidade máxima de carga do drone, em kg (X). */
  droneCapacidadeKg: Number(process.env.DRONE_CAPACIDADE_KG ?? 10),

  /** Alcance máximo do drone por carga, em quadras (Y = ida + entregas + volta). */
  droneAlcanceQuadras: Number(process.env.DRONE_ALCANCE_QUADRAS ?? 40),

  /** Quantidade de drones da frota, instanciada de forma homogênea na inicialização. */
  droneQuantidade: Number(process.env.DRONE_QUANTIDADE ?? 3),

  /** Tamanho da malha da cidade: coordenadas válidas vão de 0 a N (inclusive) em cada eixo. */
  cidadeTamanho: Number(process.env.CIDADE_TAMANHO ?? 10),

  /** Coordenada da base de onde os drones partem e retornam. */
  base: {
    x: Number(process.env.BASE_X ?? 0),
    y: Number(process.env.BASE_Y ?? 0),
  },

  /** Caminho do arquivo JSON onde os pedidos são persistidos localmente (D6). */
  pedidosArquivo: process.env.PEDIDOS_ARQUIVO ?? 'data/pedidos.json',

  /** Caminho do arquivo JSON onde as viagens calculadas são persistidas localmente (D26). */
  viagensArquivo: process.env.VIAGENS_ARQUIVO ?? 'data/viagens.json',
} as const;
