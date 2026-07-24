import { describe, it, expect } from 'vitest';
import { config } from './config.js';

describe('config', () => {
  it('define capacidade e alcance padrão do drone', () => {
    expect(config.droneCapacidadeKg).toBeGreaterThan(0);
    expect(config.droneAlcanceKm).toBeGreaterThan(0);
  });

  it('define a base na origem por padrão', () => {
    expect(config.base).toEqual({ x: 0, y: 0 });
  });
});
