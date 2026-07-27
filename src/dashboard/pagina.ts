/**
 * Página do dashboard (E6-1/D18/D41): HTML, CSS e JS inline, sem nenhuma
 * requisição a host externo. `tsc` não copia `.html` — como módulo TS que
 * exporta o HTML como template string, compila junto e `npm start` serve o
 * dashboard igual ao `npm run dev` (D41).
 *
 * O JS faz `fetch` em `/mapa`, `/simulacao`, `/drones` e
 * `/entregas/rota?caminho=true`, desenha o mapa em SVG (malha, base, zonas,
 * clientes e as rotas contornando as zonas via `caminho`) e liga os botões de
 * `POST /entregas/alocar` e `POST /simulacao/avancar`. Todo texto vindo da API
 * é injetado via `textContent`, nunca `innerHTML`.
 */
export function paginaDashboard(): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>DroneDelivery — Dashboard</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    margin: 0;
    padding: 24px;
    background: #f4f5f7;
    color: #1a1a2e;
  }
  h1 { font-size: 1.4rem; margin: 0 0 16px; }
  .painel {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr;
    gap: 12px;
    margin-bottom: 20px;
  }
  .cartao {
    background: #fff;
    border-radius: 8px;
    padding: 12px 16px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }
  .cartao .rotulo { font-size: 0.75rem; color: #666; text-transform: uppercase; }
  .cartao .valor { font-size: 1.5rem; font-weight: 600; margin-top: 4px; }
  .controles { margin-bottom: 20px; display: flex; gap: 8px; align-items: center; }
  button {
    background: #2b59ff;
    color: #fff;
    border: none;
    border-radius: 6px;
    padding: 8px 14px;
    cursor: pointer;
    font-size: 0.9rem;
  }
  button:hover { background: #1e46d6; }
  input[type="number"] {
    width: 90px;
    padding: 7px 8px;
    border-radius: 6px;
    border: 1px solid #ccc;
  }
  #mapa-container {
    background: #fff;
    border-radius: 8px;
    padding: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    display: inline-block;
  }
  #status { font-size: 0.85rem; color: #666; margin-left: 8px; }
  svg { display: block; }
  .zona { fill: #ffdada; stroke: #e05555; stroke-width: 0.05; }
  .rota { fill: none; stroke: #2b59ff; stroke-width: 0.08; opacity: 0.7; }
  .base { fill: #1a1a2e; }
  .cliente { fill: #e0a500; }
</style>
</head>
<body>
<h1>DroneDelivery — Painel de operação</h1>

<section class="painel" id="metricas">
  <div class="cartao">
    <div class="rotulo">Entregas realizadas</div>
    <div class="valor" id="metrica-entregas">—</div>
  </div>
  <div class="cartao">
    <div class="rotulo">Tempo médio por entrega (min)</div>
    <div class="valor" id="metrica-tempo-medio">—</div>
  </div>
  <div class="cartao">
    <div class="rotulo">Makespan (min)</div>
    <div class="valor" id="metrica-makespan">—</div>
  </div>
  <div class="cartao">
    <div class="rotulo">Drone mais eficiente</div>
    <div class="valor" id="metrica-drone-eficiente">—</div>
  </div>
</section>

<section class="controles">
  <button id="botao-alocar" type="button">Alocar pedidos</button>
  <label for="campo-minutos">Avançar relógio (min):</label>
  <input id="campo-minutos" type="number" min="0" step="1" value="10" />
  <button id="botao-avancar" type="button">Avançar relógio</button>
  <span id="status"></span>
</section>

<section id="mapa-container">
  <svg id="mapa" xmlns="http://www.w3.org/2000/svg"></svg>
</section>

<script>
(function () {
  "use strict";

  var SVG_NS = "http://www.w3.org/2000/svg";
  var ESCALA = 32;
  var MARGEM = 1;

  function el(tag, attrs) {
    var node = document.createElementNS(SVG_NS, tag);
    for (var chave in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, chave)) {
        node.setAttribute(chave, String(attrs[chave]));
      }
    }
    return node;
  }

  function definirTexto(id, texto) {
    var node = document.getElementById(id);
    if (node) {
      node.textContent = texto;
    }
  }

  function definirStatus(texto) {
    definirTexto("status", texto);
  }

  function buscarJson(url, opcoes) {
    return fetch(url, opcoes).then(function (resposta) {
      return resposta.json().then(function (corpo) {
        if (!resposta.ok) {
          var mensagem =
            corpo && corpo.erro && corpo.erro.mensagem
              ? corpo.erro.mensagem
              : "Erro ao consultar " + url;
          throw new Error(mensagem);
        }
        return corpo;
      });
    });
  }

  function atualizarMetricas(simulacao) {
    var metricas = simulacao.metricas || {};
    definirTexto("metrica-entregas", String(metricas.totalEntregas != null ? metricas.totalEntregas : 0));
    definirTexto(
      "metrica-tempo-medio",
      String(metricas.tempoMedioEntregaMin != null ? metricas.tempoMedioEntregaMin : 0),
    );
    definirTexto("metrica-makespan", String(metricas.makespanMin != null ? metricas.makespanMin : 0));
    definirTexto(
      "metrica-drone-eficiente",
      metricas.droneMaisEficiente ? String(metricas.droneMaisEficiente) : "—",
    );
  }

  function desenharMapa(mapaResposta, drones, viagens) {
    var svg = document.getElementById("mapa");
    if (!svg) {
      return;
    }
    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }

    var tamanho = mapaResposta.cidadeTamanho || 0;
    var largura = (tamanho + MARGEM * 2) * ESCALA;
    svg.setAttribute("width", String(largura));
    svg.setAttribute("height", String(largura));
    svg.setAttribute("viewBox", "0 0 " + (tamanho + MARGEM * 2) + " " + (tamanho + MARGEM * 2));

    function px(x) {
      return x + MARGEM;
    }
    function py(y) {
      return tamanho - y + MARGEM;
    }

    var fundo = el("rect", {
      x: 0,
      y: 0,
      width: tamanho + MARGEM * 2,
      height: tamanho + MARGEM * 2,
      fill: "#fafafa",
      stroke: "#ddd",
      "stroke-width": 0.02,
    });
    svg.appendChild(fundo);

    var zonas = mapaResposta.zonas || [];
    for (var i = 0; i < zonas.length; i += 1) {
      var zona = zonas[i];
      var x0 = Math.min(zona.de.x, zona.ate.x);
      var y0 = Math.min(zona.de.y, zona.ate.y);
      var x1 = Math.max(zona.de.x, zona.ate.x);
      var y1 = Math.max(zona.de.y, zona.ate.y);
      svg.appendChild(
        el("rect", {
          class: "zona",
          x: px(x0) - 0.5,
          y: py(y1) - 0.5,
          width: x1 - x0 + 1,
          height: y1 - y0 + 1,
        }),
      );
    }

    for (var v = 0; v < viagens.length; v += 1) {
      var viagem = viagens[v];
      var pernas = viagem.caminho || [];
      for (var p = 0; p < pernas.length; p += 1) {
        var celulas = pernas[p].celulas || [];
        if (celulas.length === 0) {
          continue;
        }
        var pontos = celulas
          .map(function (celula) {
            return px(celula.x) + "," + py(celula.y);
          })
          .join(" ");
        svg.appendChild(el("polyline", { class: "rota", points: pontos }));
      }
    }

    var base = mapaResposta.base || { x: 0, y: 0 };
    svg.appendChild(el("circle", { class: "base", cx: px(base.x), cy: py(base.y), r: 0.28 }));

    for (var d = 0; d < drones.length; d += 1) {
      var drone = drones[d].posicao;
      if (drone) {
        svg.appendChild(
          el("circle", { class: "cliente", cx: px(drone.x), cy: py(drone.y), r: 0.2 }),
        );
      }
    }
  }

  function carregarTudo() {
    return Promise.all([
      buscarJson("/mapa"),
      buscarJson("/simulacao"),
      buscarJson("/drones"),
      buscarJson("/entregas/rota?caminho=true"),
    ]).then(function (resultados) {
      var mapaResposta = resultados[0];
      var simulacao = resultados[1];
      var drones = resultados[2];
      var viagens = resultados[3];
      atualizarMetricas(simulacao);
      desenharMapa(mapaResposta, drones, viagens);
    });
  }

  function aoClicarAlocar() {
    definirStatus("Alocando…");
    buscarJson("/entregas/alocar", { method: "POST" })
      .then(function () {
        definirStatus("Alocação concluída.");
        return carregarTudo();
      })
      .catch(function (erro) {
        definirStatus("Erro: " + erro.message);
      });
  }

  function aoClicarAvancar() {
    var campo = document.getElementById("campo-minutos");
    var minutos = campo ? Number(campo.value) : 0;
    definirStatus("Avançando o relógio…");
    buscarJson("/simulacao/avancar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ minutos: minutos }),
    })
      .then(function () {
        definirStatus("Relógio avançado.");
        return carregarTudo();
      })
      .catch(function (erro) {
        definirStatus("Erro: " + erro.message);
      });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var botaoAlocar = document.getElementById("botao-alocar");
    var botaoAvancar = document.getElementById("botao-avancar");
    if (botaoAlocar) {
      botaoAlocar.addEventListener("click", aoClicarAlocar);
    }
    if (botaoAvancar) {
      botaoAvancar.addEventListener("click", aoClicarAvancar);
    }
    carregarTudo().catch(function (erro) {
      definirStatus("Erro: " + erro.message);
    });
  });
})();
</script>
</body>
</html>
`;
}
