import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { paginaDashboard } from './pagina.js';

/**
 * Respostas mínimas por rota, no formato que o script embutido espera.
 * Cada caso de teste pode sobrescrever campos via `Object.assign` no chamador.
 */
const RESPOSTA_MAPA_PADRAO = {
  cidadeTamanho: 10,
  base: { x: 0, y: 0 },
  zonas: [],
};
const RESPOSTA_SIMULACAO_PADRAO = {
  instanteAtual: 0,
  metricas: {
    totalEntregas: 3,
    tempoMedioEntregaMin: 12,
    makespanMin: 45,
    droneMaisEficiente: 'drone-1',
  },
};
const RESPOSTA_DRONES_PADRAO: unknown[] = [];
const RESPOSTA_ROTA_PADRAO: unknown[] = [];
const RESPOSTA_PEDIDOS_PADRAO: unknown[] = [];

type RespostasPorRota = {
  readonly '/mapa'?: unknown;
  readonly '/simulacao'?: unknown;
  readonly '/drones'?: unknown;
  readonly '/entregas/rota?caminho=true'?: unknown;
  readonly '/pedidos'?: unknown;
};

/**
 * Monta `paginaDashboard()` num `JSDOM` real com `runScripts: 'dangerously'`,
 * de forma que o `<script>` embutido é executado de verdade — não apenas
 * verificado por presença de string. É a correção da dívida "o JS embutido
 * nunca é executado por teste" (metaspec, technical debt).
 *
 * `runScripts: 'dangerously'` é seguro aqui porque o único conteúdo montado é
 * a própria `paginaDashboard()` do projeto — nunca usar este padrão sobre
 * HTML de terceiros.
 */
async function montarPagina(respostas: RespostasPorRota = {}): Promise<Document> {
  const html = paginaDashboard();
  const porRota: Record<string, unknown> = {
    '/mapa': RESPOSTA_MAPA_PADRAO,
    '/simulacao': RESPOSTA_SIMULACAO_PADRAO,
    '/drones': RESPOSTA_DRONES_PADRAO,
    '/entregas/rota?caminho=true': RESPOSTA_ROTA_PADRAO,
    '/pedidos': RESPOSTA_PEDIDOS_PADRAO,
    ...respostas,
  };

  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    url: 'http://localhost/dashboard',
    beforeParse(window) {
      window.fetch = ((url: string) => {
        const corpo = porRota[url];
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(corpo),
        });
      }) as unknown as typeof fetch;
    },
  });

  // deixa o Promise.all de carregarTudo() resolver (fetch stub + duas cadeias de .then)
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));

  return dom.window.document;
}

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

  it('tem formulário de cadastro com x, y, peso e prioridade', () => {
    const html = paginaDashboard();

    expect(html).toContain('id="form-pedido"');
    expect(html).toContain('id="campo-x"');
    expect(html).toContain('id="campo-y"');
    expect(html).toContain('id="campo-peso"');
    expect(html).toContain('id="campo-prioridade"');
    expect(html).toMatch(/value="alta"/);
    expect(html).toMatch(/value="media"/);
    expect(html).toMatch(/value="baixa"/);
  });

  it('tem legenda estática nomeando base, zona, cliente e drone', () => {
    const html = paginaDashboard();

    expect(html).toContain('id="legenda"');
    expect(html).toMatch(/>\s*Base\s*</);
    expect(html).toMatch(/>\s*Zona de exclusão\s*</);
    expect(html).toMatch(/>\s*Cliente\s*</);
    expect(html).toMatch(/>\s*Drone\s*</);
  });
});

describe('paginaDashboard — comportamento do script embutido (jsdom)', () => {
  it('preenche as métricas a partir do fetch stubado, provando que o script executou', async () => {
    const documento = await montarPagina();

    expect(documento.getElementById('metrica-entregas')?.textContent).toBe('3');
    expect(documento.getElementById('metrica-tempo-medio')?.textContent).toBe('12');
    expect(documento.getElementById('metrica-makespan')?.textContent).toBe('45');
    expect(documento.getElementById('metrica-drone-eficiente')?.textContent).toBe('drone-1');
  });

  it('desenha a grade da malha com linhas e rótulos de extremidade nos dois eixos', async () => {
    const documento = await montarPagina({
      '/mapa': { cidadeTamanho: 10, base: { x: 0, y: 0 }, zonas: [] },
    });

    const svg = documento.getElementById('mapa');
    const linhasGrade = svg?.querySelectorAll('.grade') ?? [];
    expect(linhasGrade.length).toBe(2 * (10 + 1));

    const rotulos = Array.from(svg?.querySelectorAll('.rotulo-eixo') ?? []).map(
      (no) => no.textContent,
    );
    expect(rotulos).toContain('0');
    expect(rotulos).toContain('10');
  });

  it('lista um drone por linha, com fase legível, posição, carga e bateria', async () => {
    const drones = [
      {
        id: 'drone-1',
        estado: 'em_voo',
        posicao: { x: 3, y: 4 },
        cargaKg: 6,
        capacidadeKg: 10,
        bateriaQuadras: 26,
        alcanceQuadras: 40,
        bateriaPercentual: 65,
      },
      {
        id: 'drone-2',
        estado: 'idle',
        posicao: { x: 0, y: 0 },
        cargaKg: 0,
        capacidadeKg: 10,
        bateriaQuadras: 40,
        alcanceQuadras: 40,
        bateriaPercentual: 100,
      },
    ];

    const documento = await montarPagina({ '/drones': drones });

    const linhas = documento.querySelectorAll('#lista-drones tbody tr');
    expect(linhas.length).toBe(2);

    const primeira = linhas[0]?.textContent ?? '';
    expect(primeira).toContain('drone-1');
    // fase em linguagem de operação, não o valor cru do enum
    expect(primeira).toContain('Em voo');
    expect(primeira).toContain('(3, 4)');
    expect(primeira).toContain('6');
    expect(primeira).toContain('65%');
    expect(primeira).toContain('26');

    expect(linhas[1]?.textContent ?? '').toContain('Ocioso');
  });

  it('lista um pedido por linha, com botão cancelar apenas nos pendentes', async () => {
    const pedidos = [
      { id: 'p1', destino: { x: 2, y: 3 }, pesoKg: 1, prioridade: 'alta', status: 'pendente' },
      { id: 'p2', destino: { x: 4, y: 5 }, pesoKg: 2, prioridade: 'media', status: 'alocado' },
      { id: 'p3', destino: { x: 6, y: 7 }, pesoKg: 3, prioridade: 'baixa', status: 'entregue' },
    ];

    const documento = await montarPagina({ '/pedidos': pedidos });

    const linhas = documento.querySelectorAll('#lista-pedidos tbody tr');
    expect(linhas.length).toBe(3);

    const botoesCancelar = documento.querySelectorAll('#lista-pedidos .botao-cancelar');
    expect(botoesCancelar.length).toBe(1);
    expect(botoesCancelar[0]?.getAttribute('data-pedido-id')).toBe('p1');
  });

  it('desenha um .cliente por pedido não entregue e um .drone por drone, seletores disjuntos', async () => {
    const pedidos = [
      { id: 'p1', destino: { x: 2, y: 3 }, pesoKg: 1, prioridade: 'alta', status: 'pendente' },
      { id: 'p2', destino: { x: 4, y: 5 }, pesoKg: 1, prioridade: 'media', status: 'alocado' },
      { id: 'p3', destino: { x: 6, y: 7 }, pesoKg: 1, prioridade: 'baixa', status: 'em_voo' },
      { id: 'p4', destino: { x: 1, y: 1 }, pesoKg: 1, prioridade: 'alta', status: 'entregue' },
      { id: 'p5', destino: { x: 8, y: 8 }, pesoKg: 1, prioridade: 'alta', status: 'cancelado' },
    ];
    const drones = [
      { id: 'drone-1', posicao: { x: 0, y: 0 } },
      { id: 'drone-2', posicao: { x: 9, y: 9 } },
    ];

    const documento = await montarPagina({
      '/mapa': { cidadeTamanho: 10, base: { x: 0, y: 0 }, zonas: [] },
      '/pedidos': pedidos,
      '/drones': drones,
    });

    const svg = documento.getElementById('mapa');
    const clientes = Array.from(svg?.querySelectorAll('.cliente') ?? []);
    const dronesDesenhados = Array.from(svg?.querySelectorAll('.drone') ?? []);

    expect(clientes.length).toBe(3);
    expect(dronesDesenhados.length).toBe(2);

    // seletores disjuntos: nenhum nó tem as duas classes ao mesmo tempo
    const interseccao = clientes.filter((no) => dronesDesenhados.includes(no));
    expect(interseccao.length).toBe(0);

    // posição do primeiro pedido pendente (x=2,y=3), respeitando a inversão do eixo y (py = tamanho - y + margem)
    const margem = 1;
    const tamanho = 10;
    const esperadoCx = 2 + margem;
    const esperadoCy = tamanho - 3 + margem;
    const clientePendente = clientes.find(
      (no) =>
        no.getAttribute('cx') === String(esperadoCx) &&
        no.getAttribute('cy') === String(esperadoCy),
    );
    expect(clientePendente).toBeDefined();
  });
});
