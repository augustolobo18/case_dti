import { describe, it, expect } from 'vitest';
import { paginaDashboard } from './pagina.js';

describe('paginaDashboard', () => {
  it('devolve HTML com doctype, title e os contêineres que o JS usa', () => {
    const html = paginaDashboard();

    expect(html).toMatch(/^<!doctype html>/i);
    expect(html).toMatch(/<title>.*<\/title>/i);
    expect(html).toContain('id="metricas"');
    expect(html).toContain('id="mapa"');
  });

  it('é autossuficiente: sem src="http, href="http nem //cdn', () => {
    const html = paginaDashboard();

    expect(html).not.toMatch(/src="http/i);
    expect(html).not.toMatch(/href="http/i);
    expect(html).not.toContain('//cdn');
  });

  it('é determinística: duas chamadas devolvem exatamente a mesma string', () => {
    expect(paginaDashboard()).toBe(paginaDashboard());
  });
});
