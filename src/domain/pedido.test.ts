import { describe, it, expect } from 'vitest';
import { ErroDominio } from './erros.js';
import {
  criarPedido,
  comStatus,
  cancelarPedido,
  alocarPedido,
  reverterParaPendente,
  type LimitesPedido,
} from './pedido.js';

const LIMITES: LimitesPedido = { capacidadeKg: 10, cidadeTamanho: 10 };
const gerarIdFixo = () => 'id-fixo-teste';

describe('criarPedido', () => {
  it('cria um pedido válido com status pendente e o id do gerador injetado', () => {
    const pedido = criarPedido(
      { x: 3, y: 4, pesoKg: 5, prioridade: 'alta' },
      { limites: LIMITES, gerarId: gerarIdFixo },
    );

    expect(pedido).toEqual({
      id: 'id-fixo-teste',
      destino: { x: 3, y: 4 },
      pesoKg: 5,
      prioridade: 'alta',
      status: 'pendente',
    });
  });

  it('aceita peso exatamente igual à capacidade do drone', () => {
    const pedido = criarPedido(
      { x: 0, y: 0, pesoKg: LIMITES.capacidadeKg, prioridade: 'baixa' },
      { limites: LIMITES, gerarId: gerarIdFixo },
    );
    expect(pedido.pesoKg).toBe(LIMITES.capacidadeKg);
  });

  it('rejeita peso acima da capacidade com PESO_ACIMA_CAPACIDADE', () => {
    expect.assertions(2);
    try {
      criarPedido(
        { x: 0, y: 0, pesoKg: LIMITES.capacidadeKg + 0.1, prioridade: 'baixa' },
        { limites: LIMITES, gerarId: gerarIdFixo },
      );
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroDominio);
      expect((erro as ErroDominio).codigo).toBe('PESO_ACIMA_CAPACIDADE');
    }
  });

  it('rejeita peso zero com PESO_INVALIDO', () => {
    expect.assertions(2);
    try {
      criarPedido(
        { x: 0, y: 0, pesoKg: 0, prioridade: 'baixa' },
        { limites: LIMITES, gerarId: gerarIdFixo },
      );
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroDominio);
      expect((erro as ErroDominio).codigo).toBe('PESO_INVALIDO');
    }
  });

  it('rejeita peso negativo com PESO_INVALIDO', () => {
    expect.assertions(2);
    try {
      criarPedido(
        { x: 0, y: 0, pesoKg: -5, prioridade: 'baixa' },
        { limites: LIMITES, gerarId: gerarIdFixo },
      );
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroDominio);
      expect((erro as ErroDominio).codigo).toBe('PESO_INVALIDO');
    }
  });

  it('rejeita prioridade desconhecida com PRIORIDADE_INVALIDA', () => {
    expect.assertions(2);
    try {
      criarPedido(
        { x: 0, y: 0, pesoKg: 1, prioridade: 'urgente' },
        { limites: LIMITES, gerarId: gerarIdFixo },
      );
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroDominio);
      expect((erro as ErroDominio).codigo).toBe('PRIORIDADE_INVALIDA');
    }
  });

  it('rejeita destino fora da malha propagando o erro de Coordenada', () => {
    expect.assertions(2);
    try {
      criarPedido(
        { x: LIMITES.cidadeTamanho + 1, y: 0, pesoKg: 1, prioridade: 'baixa' },
        { limites: LIMITES, gerarId: gerarIdFixo },
      );
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroDominio);
      expect((erro as ErroDominio).codigo).toBe('COORDENADA_FORA_DA_MALHA');
    }
  });

  it('usa crypto.randomUUID como gerador padrão quando nenhum é injetado', () => {
    const pedido = criarPedido(
      { x: 0, y: 0, pesoKg: 1, prioridade: 'baixa' },
      { limites: LIMITES },
    );
    expect(typeof pedido.id).toBe('string');
    expect(pedido.id.length).toBeGreaterThan(0);
  });
});

describe('comStatus', () => {
  it('devolve uma nova cópia com o status alterado, sem mutar o original', () => {
    const original = criarPedido(
      { x: 0, y: 0, pesoKg: 1, prioridade: 'baixa' },
      { limites: LIMITES, gerarId: gerarIdFixo },
    );

    const atualizado = comStatus(original, 'alocado');

    expect(atualizado.status).toBe('alocado');
    expect(original.status).toBe('pendente');
    expect(atualizado).not.toBe(original);
  });
});

describe('cancelarPedido', () => {
  it('cancela um pedido pendente, devolvendo nova cópia sem mutar o original', () => {
    const original = criarPedido(
      { x: 0, y: 0, pesoKg: 1, prioridade: 'baixa' },
      { limites: LIMITES, gerarId: gerarIdFixo },
    );

    const cancelado = cancelarPedido(original);

    expect(cancelado.status).toBe('cancelado');
    expect(original.status).toBe('pendente');
    expect(cancelado).not.toBe(original);
  });

  it.each(['alocado', 'em_voo', 'entregue', 'cancelado'] as const)(
    'rejeita cancelar pedido com status "%s" com CANCELAMENTO_NAO_PERMITIDO',
    (status) => {
      expect.assertions(2);
      const pedido = comStatus(
        criarPedido(
          { x: 0, y: 0, pesoKg: 1, prioridade: 'baixa' },
          { limites: LIMITES, gerarId: gerarIdFixo },
        ),
        status,
      );

      try {
        cancelarPedido(pedido);
      } catch (erro) {
        expect(erro).toBeInstanceOf(ErroDominio);
        expect((erro as ErroDominio).codigo).toBe('CANCELAMENTO_NAO_PERMITIDO');
      }
    },
  );
});

describe('alocarPedido', () => {
  it('aloca um pedido pendente, devolvendo nova cópia sem mutar o original', () => {
    const original = criarPedido(
      { x: 0, y: 0, pesoKg: 1, prioridade: 'baixa' },
      { limites: LIMITES, gerarId: gerarIdFixo },
    );

    const alocado = alocarPedido(original);

    expect(alocado.status).toBe('alocado');
    expect(original.status).toBe('pendente');
    expect(alocado).not.toBe(original);
  });

  it.each(['alocado', 'em_voo', 'entregue', 'cancelado'] as const)(
    'rejeita alocar pedido com status "%s" com ALOCACAO_NAO_PERMITIDA',
    (status) => {
      expect.assertions(2);
      const pedido = comStatus(
        criarPedido(
          { x: 0, y: 0, pesoKg: 1, prioridade: 'baixa' },
          { limites: LIMITES, gerarId: gerarIdFixo },
        ),
        status,
      );

      try {
        alocarPedido(pedido);
      } catch (erro) {
        expect(erro).toBeInstanceOf(ErroDominio);
        expect((erro as ErroDominio).codigo).toBe('ALOCACAO_NAO_PERMITIDA');
      }
    },
  );
});

describe('reverterParaPendente', () => {
  it('reverte um pedido alocado para pendente, devolvendo nova cópia sem mutar o original', () => {
    const original = comStatus(
      criarPedido(
        { x: 0, y: 0, pesoKg: 1, prioridade: 'baixa' },
        { limites: LIMITES, gerarId: gerarIdFixo },
      ),
      'alocado',
    );

    const revertido = reverterParaPendente(original);

    expect(revertido.status).toBe('pendente');
    expect(original.status).toBe('alocado');
    expect(revertido).not.toBe(original);
  });

  it.each(['pendente', 'em_voo', 'entregue', 'cancelado'] as const)(
    'rejeita reverter pedido com status "%s" com ALOCACAO_NAO_PERMITIDA',
    (status) => {
      expect.assertions(2);
      const pedido = comStatus(
        criarPedido(
          { x: 0, y: 0, pesoKg: 1, prioridade: 'baixa' },
          { limites: LIMITES, gerarId: gerarIdFixo },
        ),
        status,
      );

      try {
        reverterParaPendente(pedido);
      } catch (erro) {
        expect(erro).toBeInstanceOf(ErroDominio);
        expect((erro as ErroDominio).codigo).toBe('ALOCACAO_NAO_PERMITIDA');
      }
    },
  );
});
