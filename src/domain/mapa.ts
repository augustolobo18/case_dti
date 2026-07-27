import { dentroDaMalha, distanciaManhattan, saoIguais, type Coordenada } from './coordenada.js';
import { ErroDominio } from './erros.js';

/** Retângulo inclusivo de células bloqueadas na malha (E5-2/D17). */
export type ZonaExclusao = {
  readonly de: Coordenada;
  readonly ate: Coordenada;
};

/**
 * Mapa da cidade: sabe quais células estão bloqueadas por zonas de exclusão e
 * calcula a distância entre dois pontos contornando-as (BFS memoizado por
 * origem). Do ponto de vista do chamador é referencialmente transparente —
 * mesma entrada, mesma saída, sem I/O, relógio ou aleatoriedade (D13).
 */
export type MapaCidade = {
  readonly cidadeTamanho: number;
  readonly zonas: readonly ZonaExclusao[];
  /** Verifica se a célula está dentro de alguma zona de exclusão (bordas inclusivas). */
  bloqueada(coordenada: Coordenada): boolean;
  /**
   * Distância mínima entre `a` e `b` contornando as zonas de exclusão
   * (movimento em 4 direções, coerente com Manhattan, D16). Devolve `null`
   * quando não existe caminho (origem/destino bloqueado ou destino cercado).
   */
  distancia(a: Coordenada, b: Coordenada): number | null;
  /**
   * Sequência de células de `a` até `b`, contornando as zonas de exclusão
   * (E6-4/D39). Inclui as duas pontas; comprimento = `distancia(a,b) + 1`.
   * Devolve `null` exatamente quando `distancia(a,b) === null`.
   */
  caminho(a: Coordenada, b: Coordenada): readonly Coordenada[] | null;
};

/** Opções de criação do `MapaCidade`. */
export type OpcoesMapaCidade = {
  readonly cidadeTamanho: number;
  readonly zonas: readonly ZonaExclusao[];
};

/** Chave única de uma coordenada, para uso em `Set`/`Map`. */
function chave(coordenada: Coordenada): string {
  return `${coordenada.x},${coordenada.y}`;
}

/** Verifica se um número é um inteiro finito (rejeita fracionário, NaN e Infinity). */
function ehInteiroFinito(valor: number): boolean {
  return Number.isFinite(valor) && Number.isInteger(valor);
}

/** Parseia um ponto `"x,y"` em `Coordenada`, validando que x e y são inteiros. */
function parsearPonto(texto: string, trechoOriginal: string): Coordenada {
  const partes = texto.split(',');
  if (partes.length !== 2) {
    throw new ErroDominio(
      'COORDENADA_INVALIDA',
      `Zona de exclusão inválida: "${trechoOriginal}". Cada ponto deve ter o formato "x,y".`,
    );
  }

  const x = Number(partes[0]!.trim());
  const y = Number(partes[1]!.trim());

  if (!ehInteiroFinito(x) || !ehInteiroFinito(y)) {
    throw new ErroDominio(
      'COORDENADA_INVALIDA',
      `Zona de exclusão inválida: "${trechoOriginal}". As coordenadas devem ser inteiras.`,
    );
  }

  return { x, y };
}

/** Parseia um único retângulo `"x1,y1:x2,y2"` em `ZonaExclusao`. */
function parsearZona(trecho: string): ZonaExclusao {
  const pontos = trecho.split(':').map((parte) => parte.trim());
  if (pontos.length !== 2) {
    throw new ErroDominio(
      'COORDENADA_INVALIDA',
      `Zona de exclusão inválida: "${trecho}". Formato esperado "x1,y1:x2,y2".`,
    );
  }

  const de = parsearPonto(pontos[0]!, trecho);
  const ate = parsearPonto(pontos[1]!, trecho);

  if (de.x > ate.x || de.y > ate.y) {
    throw new ErroDominio(
      'COORDENADA_INVALIDA',
      `Zona de exclusão inválida: "${trecho}". O primeiro ponto deve ser menor ou igual ` +
        'ao segundo em cada eixo.',
    );
  }

  return { de, ate };
}

/**
 * Parseia a variável `ZONAS_EXCLUSAO` (retângulos `"x1,y1:x2,y2"` separados
 * por `;`, espaços tolerados) em uma lista de `ZonaExclusao`. Puro: só valida
 * a forma (par de pontos inteiros, `de <= ate`); não sabe nada sobre o
 * tamanho da malha — essa checagem é de `criarMapaCidade`.
 */
export function parsearZonasExclusao(texto: string): ZonaExclusao[] {
  const bruto = texto.trim();
  if (bruto.length === 0) {
    return [];
  }

  return bruto
    .split(';')
    .map((trecho) => trecho.trim())
    .filter((trecho) => trecho.length > 0)
    .map((trecho) => parsearZona(trecho));
}

const DELTAS_VIZINHOS: readonly Coordenada[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

/**
 * Compara duas coordenadas para desempate determinístico: menor `x` primeiro,
 * depois menor `y` (D12) — o mesmo critério do roteamento nearest-neighbor,
 * aqui reaplicado ao backtracking do caminho (D39).
 */
function compararPorXY(a: Coordenada, b: Coordenada): number {
  if (a.x !== b.x) {
    return a.x - b.x;
  }
  return a.y - b.y;
}

/**
 * Cria o `MapaCidade`, validando que todas as zonas estão dentro da malha
 * `0..cidadeTamanho` (D4). A distância é calculada por BFS a partir da
 * origem na primeira chamada, memoizado por origem — chamadas seguintes com
 * a mesma origem são O(1); o custo total do pathfinding é O(P × células),
 * nunca por par de pontos.
 */
export function criarMapaCidade(opcoes: OpcoesMapaCidade): MapaCidade {
  const { cidadeTamanho, zonas } = opcoes;

  for (const zona of zonas) {
    if (!dentroDaMalha(zona.de, cidadeTamanho) || !dentroDaMalha(zona.ate, cidadeTamanho)) {
      throw new ErroDominio(
        'COORDENADA_FORA_DA_MALHA',
        `Zona de exclusão fora da malha: (${zona.de.x},${zona.de.y})-(${zona.ate.x},${zona.ate.y}) ` +
          `deve estar dentro de 0..${cidadeTamanho}.`,
      );
    }
  }

  const celulasBloqueadas = new Set<string>();
  for (const zona of zonas) {
    for (let x = zona.de.x; x <= zona.ate.x; x += 1) {
      for (let y = zona.de.y; y <= zona.ate.y; y += 1) {
        celulasBloqueadas.add(chave({ x, y }));
      }
    }
  }

  function bloqueada(coordenada: Coordenada): boolean {
    return celulasBloqueadas.has(chave(coordenada));
  }

  const memoDistanciasPorOrigem = new Map<string, Map<string, number>>();

  /** BFS a partir de `origem`, cobrindo toda a componente conexa alcançável. */
  function bfsDe(origem: Coordenada): Map<string, number> {
    const distancias = new Map<string, number>();

    if (bloqueada(origem)) {
      return distancias;
    }

    const fila: Coordenada[] = [origem];
    distancias.set(chave(origem), 0);
    let indice = 0;

    while (indice < fila.length) {
      const atual = fila[indice]!;
      indice += 1;
      const distanciaAtual = distancias.get(chave(atual))!;

      for (const delta of DELTAS_VIZINHOS) {
        const vizinho: Coordenada = { x: atual.x + delta.x, y: atual.y + delta.y };
        if (!dentroDaMalha(vizinho, cidadeTamanho) || bloqueada(vizinho)) {
          continue;
        }
        const chaveVizinho = chave(vizinho);
        if (!distancias.has(chaveVizinho)) {
          distancias.set(chaveVizinho, distanciaAtual + 1);
          fila.push(vizinho);
        }
      }
    }

    return distancias;
  }

  /**
   * Devolve uma função `destino -> distância` a partir de `origem` — o mesmo
   * campo de distâncias usado por `distancia` e por `caminho` (helper único,
   * é o que garante a constraint de compatibilidade em código, e não só em
   * teste). Sem zonas, é o atalho Manhattan em O(1) por consulta; com zonas,
   * é o memo do BFS por origem.
   */
  function campoDistanciasDe(origem: Coordenada): (destino: Coordenada) => number | null {
    if (zonas.length === 0) {
      return (destino: Coordenada) => distanciaManhattan(origem, destino);
    }

    const chaveOrigem = chave(origem);
    let distanciasDaOrigem = memoDistanciasPorOrigem.get(chaveOrigem);
    if (!distanciasDaOrigem) {
      distanciasDaOrigem = bfsDe(origem);
      memoDistanciasPorOrigem.set(chaveOrigem, distanciasDaOrigem);
    }

    const distancias = distanciasDaOrigem;
    return (destino: Coordenada) => distancias.get(chave(destino)) ?? null;
  }

  function distancia(a: Coordenada, b: Coordenada): number | null {
    return campoDistanciasDe(a)(b);
  }

  /**
   * Backtracking a partir de `b` até `a` (D39): a cada passo, entre os
   * vizinhos com distância `d - 1` até `a`, escolhe o de menor `x`, depois
   * menor `y` (D12/`compararPorXY`). Única rotina para os dois casos — com ou
   * sem zonas — porque `distanciaAte` já abstrai a origem do campo.
   */
  function caminho(a: Coordenada, b: Coordenada): readonly Coordenada[] | null {
    if (saoIguais(a, b)) {
      return [a];
    }

    const distanciaAte = campoDistanciasDe(a);
    const distanciaTotal = distanciaAte(b);
    if (distanciaTotal === null) {
      return null;
    }

    const reverso: Coordenada[] = [b];
    let atual = b;
    let distanciaAtual = distanciaTotal;
    let passos = 0;

    while (!saoIguais(atual, a)) {
      passos += 1;
      if (passos > distanciaTotal) {
        // Guarda de segurança: o campo de distâncias já garantiu que existe
        // caminho (distanciaTotal !== null); não achar o próximo passo dentro
        // do número de passos esperado é bug do campo de distâncias, não
        // entrada inválida.
        throw new ErroDominio(
          'ROTA_IMPOSSIVEL',
          `Backtracking de (${a.x},${a.y}) até (${b.x},${b.y}) excedeu o número de passos ` +
            'esperado — estado inconsistente no campo de distâncias.',
        );
      }

      let proximo: Coordenada | null = null;
      for (const delta of DELTAS_VIZINHOS) {
        const vizinho: Coordenada = { x: atual.x + delta.x, y: atual.y + delta.y };
        if (!dentroDaMalha(vizinho, cidadeTamanho) || bloqueada(vizinho)) {
          continue;
        }
        if (distanciaAte(vizinho) !== distanciaAtual - 1) {
          continue;
        }
        if (proximo === null || compararPorXY(vizinho, proximo) < 0) {
          proximo = vizinho;
        }
      }

      if (proximo === null) {
        throw new ErroDominio(
          'ROTA_IMPOSSIVEL',
          `Backtracking de (${a.x},${a.y}) até (${b.x},${b.y}) não encontrou vizinho com ` +
            'distância decrescente — estado inconsistente no campo de distâncias.',
        );
      }

      atual = proximo;
      distanciaAtual -= 1;
      reverso.push(atual);
    }

    return reverso.reverse();
  }

  return { cidadeTamanho, zonas, bloqueada, distancia, caminho };
}
