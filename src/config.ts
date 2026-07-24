/**
 * Configurações globais do simulador.
 * Valores podem ser sobrescritos por variáveis de ambiente (ver .env.example).
 */
export const config = {
  /** Porta do servidor HTTP. */
  port: Number(process.env.PORT ?? 3000),

  /** Capacidade máxima de carga do drone, em kg (X). */
  droneCapacidadeKg: Number(process.env.DRONE_CAPACIDADE_KG ?? 10),

  /** Alcance máximo do drone por carga, em km (Y = ida + entregas + volta). */
  droneAlcanceKm: Number(process.env.DRONE_ALCANCE_KM ?? 20),

  /** Coordenada da base de onde os drones partem e retornam. */
  base: {
    x: Number(process.env.BASE_X ?? 0),
    y: Number(process.env.BASE_Y ?? 0),
  },
} as const;
