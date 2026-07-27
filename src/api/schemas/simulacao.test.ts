import { describe, it, expect } from 'vitest';
import { schemaFiltrosViagem } from './simulacao.js';

describe('schemaFiltrosViagem — caminho', () => {
  it('caminho ausente é válido e fica undefined', () => {
    const resultado = schemaFiltrosViagem.parse({});

    expect(resultado.caminho).toBeUndefined();
  });

  it('caminho="true" é aceito', () => {
    const resultado = schemaFiltrosViagem.parse({ caminho: 'true' });

    expect(resultado.caminho).toBe('true');
  });

  it('caminho="false" é aceito e NÃO deve ligar o caminho na rota', () => {
    const resultado = schemaFiltrosViagem.parse({ caminho: 'false' });

    expect(resultado.caminho).toBe('false');
  });

  it('valor fora do conjunto {"true","false"} é rejeitado', () => {
    expect(() => schemaFiltrosViagem.parse({ caminho: 'sim' })).toThrow();
  });
});
